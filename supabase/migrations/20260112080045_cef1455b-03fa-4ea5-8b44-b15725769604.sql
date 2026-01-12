-- Fix 1: Create notification trigger functions for secure cross-user notifications
-- This replaces the overly permissive INSERT policy

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create function for friend request notifications
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_username TEXT;
BEGIN
  -- Get the requester's username
  SELECT username INTO requester_username 
  FROM public.profiles 
  WHERE user_id = NEW.requester_id;
  
  -- Insert notification for the addressee
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.addressee_id,
    'friend_request',
    'New Friend Request',
    COALESCE(requester_username, 'Someone') || ' sent you a friend request',
    jsonb_build_object('requesterId', NEW.requester_id)
  );
  
  RETURN NEW;
END;
$$;

-- Create function for friend accepted notifications
CREATE OR REPLACE FUNCTION public.notify_friend_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepter_username TEXT;
BEGIN
  -- Only trigger when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status <> 'accepted') THEN
    -- Get the accepter's username (addressee accepts the request)
    SELECT username INTO accepter_username 
    FROM public.profiles 
    WHERE user_id = NEW.addressee_id;
    
    -- Insert notification for the requester
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.requester_id,
      'friend_accepted',
      'Friend Request Accepted',
      COALESCE(accepter_username, 'Someone') || ' accepted your friend request',
      jsonb_build_object('friendId', NEW.addressee_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create function for score validation notifications
CREATE OR REPLACE FUNCTION public.notify_score_validated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if validation_status changed and user hasn't been notified yet
  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status AND NEW.user_notified_at IS NULL THEN
    IF NEW.validation_status = 'accepted' THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        NEW.user_id,
        'score_accepted',
        'Score accepted! 🎉',
        'Your ' || NEW.machine_name || ' score of ' || NEW.score::text || ' was verified by the community!',
        jsonb_build_object('score_id', NEW.id, 'machine_name', NEW.machine_name, 'score', NEW.score)
      );
      
      -- Mark as notified
      NEW.user_notified_at := now();
    ELSIF NEW.validation_status = 'declined' THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (
        NEW.user_id,
        'score_declined',
        'Score not verified ❌',
        'Your ' || NEW.machine_name || ' score did not pass community verification.',
        jsonb_build_object('score_id', NEW.id, 'machine_name', NEW.machine_name, 'score', NEW.score)
      );
      
      -- Mark as notified
      NEW.user_notified_at := now();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_friendship_created
AFTER INSERT ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.notify_friend_request();

CREATE TRIGGER on_friendship_accepted
AFTER UPDATE ON public.friendships
FOR EACH ROW
EXECUTE FUNCTION public.notify_friend_accepted();

CREATE TRIGGER on_score_validation_changed
BEFORE UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.notify_score_validated();

-- Create a new restricted policy: users can only create notifications for themselves
CREATE POLICY "Users can create own notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);