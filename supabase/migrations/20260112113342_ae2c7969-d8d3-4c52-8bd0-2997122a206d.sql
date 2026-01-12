-- Fix: notify on community verification even if user was notified about a different event before
-- The issue is that user_notified_at is set on initial submission if AI validated,
-- so community verification notification never fires.

-- Replace the trigger function with improved logic
CREATE OR REPLACE FUNCTION public.notify_score_validated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_notify BOOLEAN := FALSE;
BEGIN
  -- Only process if validation_status actually changed
  IF NEW.validation_status IS NOT DISTINCT FROM OLD.validation_status THEN
    RETURN NEW;
  END IF;

  -- Notify on acceptance if:
  -- 1. Status changed to 'accepted' AND
  -- 2. Either never notified OR previously notified with different status
  IF NEW.validation_status = 'accepted' THEN
    -- Check if we already sent an 'accepted' notification for this score
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE data->>'score_id' = NEW.id::text 
        AND type = 'score_accepted'
    ) THEN
      should_notify := TRUE;
    END IF;
  END IF;

  -- Notify on decline if:
  -- Status changed to 'declined' and no decline notification sent yet
  IF NEW.validation_status = 'declined' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications 
      WHERE data->>'score_id' = NEW.id::text 
        AND type = 'score_declined'
    ) THEN
      should_notify := TRUE;
    END IF;
  END IF;

  IF should_notify AND NEW.validation_status = 'accepted' THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'score_accepted',
      'Score accepted! 🎉',
      'Your ' || NEW.machine_name || ' score of ' || NEW.score::text || ' was verified by the community!',
      jsonb_build_object('score_id', NEW.id, 'machine_name', NEW.machine_name, 'score', NEW.score)
    );
    NEW.user_notified_at := now();
  END IF;

  IF should_notify AND NEW.validation_status = 'declined' THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'score_declined',
      'Score not verified ❌',
      'Your ' || NEW.machine_name || ' score did not pass community verification.',
      jsonb_build_object('score_id', NEW.id, 'machine_name', NEW.machine_name, 'score', NEW.score)
    );
    NEW.user_notified_at := now();
  END IF;

  RETURN NEW;
END;
$$;