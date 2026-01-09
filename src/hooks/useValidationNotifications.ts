import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export const useValidationNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (!user || hasChecked.current) return;
    hasChecked.current = true;

    const checkForValidatedScores = async () => {
      try {
        // Find scores that are now validated but user hasn't been notified
        const { data: validatedScores, error } = await supabase
          .from("scores")
          .select("id, machine_name, score")
          .eq("user_id", user.id)
          .eq("validation_status", "accepted")
          .is("user_notified_at", null);

        if (error) throw error;

        if (validatedScores && validatedScores.length > 0) {
          // Show notification for each validated score
          if (validatedScores.length === 1) {
            const score = validatedScores[0];
            toast({
              title: "Score accepted! 🎉",
              description: `Your ${score.machine_name} score of ${score.score.toLocaleString()} was verified by the community!`,
            });
          } else {
            toast({
              title: `${validatedScores.length} scores accepted! 🎉`,
              description: "The community has verified your submitted scores!",
            });
          }

          // Mark all as notified
          const scoreIds = validatedScores.map((s) => s.id);
          await supabase
            .from("scores")
            .update({ user_notified_at: new Date().toISOString() })
            .in("id", scoreIds);
        }

        // Also check for declined scores
        const { data: rejectedScores, error: rejError } = await supabase
          .from("scores")
          .select("id, machine_name, score")
          .eq("user_id", user.id)
          .eq("validation_status", "declined")
          .is("user_notified_at", null);

        if (!rejError && rejectedScores && rejectedScores.length > 0) {
          if (rejectedScores.length === 1) {
            const score = rejectedScores[0];
            toast({
              title: "Score not verified ❌",
              description: `Your ${score.machine_name} score could not be verified by the community.`,
              variant: "destructive",
            });
          } else {
            toast({
              title: `${rejectedScores.length} scores not verified`,
              description: "Some of your scores could not be verified by the community.",
              variant: "destructive",
            });
          }

          // Mark as notified
          const scoreIds = rejectedScores.map((s) => s.id);
          await supabase
            .from("scores")
            .update({ user_notified_at: new Date().toISOString() })
            .in("id", scoreIds);
        }
      } catch (error) {
        console.error("Error checking for validated scores:", error);
      }
    };

    // Small delay to let the app settle
    const timeout = setTimeout(checkForValidatedScores, 1000);
    return () => clearTimeout(timeout);
  }, [user, toast]);
};
