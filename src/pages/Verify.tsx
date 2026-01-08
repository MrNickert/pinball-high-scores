import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Loader2, MapPin, Calendar, ExternalLink, ThumbsUp, ThumbsDown, CheckCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ValidationBadge } from "@/components/ValidationBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface PendingScore {
  id: string;
  score: number;
  machine_name: string;
  location_name: string | null;
  photo_url: string | null;
  created_at: string;
  username: string;
  user_id: string;
  validation_status: "ai_validated" | "score_only" | "not_validated" | null;
  user_vote?: "approve" | "reject" | null;
  approve_count: number;
  reject_count: number;
}

const rejectionReasons = [
  { value: "score_not_visible", label: "Score not visible in photo" },
  { value: "score_mismatch", label: "Score doesn't match claim" },
  { value: "wrong_machine", label: "Wrong machine shown" },
  { value: "photo_unclear", label: "Photo too blurry/unclear" },
  { value: "suspected_fake", label: "Suspected manipulation" },
  { value: "other", label: "Other reason" },
] as const;

const Verify = () => {
  const [scores, setScores] = useState<PendingScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingScoreId, setVotingScoreId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [rejectingScoreId, setRejectingScoreId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingScores();
  }, [user]);

  const fetchPendingScores = async () => {
    try {
      // Fetch scores that need verification (not_validated or score_only)
      const { data: pendingScores, error } = await supabase
        .from("scores")
        .select(`
          id,
          score,
          machine_name,
          location_name,
          photo_url,
          created_at,
          user_id,
          validation_status
        `)
        .in("validation_status", ["not_validated", "score_only"])
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) throw error;

      if (pendingScores && pendingScores.length > 0) {
        const userIds = [...new Set(pendingScores.map(s => s.user_id))];
        const scoreIds = pendingScores.map(s => s.id);

        // Fetch profiles
        const { data: profiles } = await supabase
          .from("public_profiles")
          .select("user_id, username")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.username]) || []);

        // Fetch all votes for these scores
        const { data: votes } = await supabase
          .from("score_votes")
          .select("score_id, user_id, vote")
          .in("score_id", scoreIds);

        // Calculate vote counts and user's vote
        const voteMap = new Map<string, { approve: number; reject: number; userVote: string | null }>();
        
        scoreIds.forEach(id => {
          voteMap.set(id, { approve: 0, reject: 0, userVote: null });
        });

        votes?.forEach(vote => {
          const current = voteMap.get(vote.score_id);
          if (current) {
            if (vote.vote === "approve") current.approve++;
            if (vote.vote === "reject") current.reject++;
            if (user && vote.user_id === user.id) {
              current.userVote = vote.vote;
            }
          }
        });

        const scoresWithData = pendingScores.map(score => {
          const voteData = voteMap.get(score.id) || { approve: 0, reject: 0, userVote: null };
          return {
            id: score.id,
            score: score.score,
            machine_name: score.machine_name,
            location_name: score.location_name,
            photo_url: score.photo_url,
            created_at: score.created_at,
            user_id: score.user_id,
            username: profileMap.get(score.user_id) || "Anonymous",
            validation_status: score.validation_status as PendingScore["validation_status"],
            user_vote: voteData.userVote as PendingScore["user_vote"],
            approve_count: voteData.approve,
            reject_count: voteData.reject,
          };
        });

        setScores(scoresWithData);
      }
    } catch (error) {
      console.error("Error fetching pending scores:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (scoreId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to verify scores",
        variant: "destructive",
      });
      return;
    }

    setVotingScoreId(scoreId);

    try {
      // First try to update existing vote
      const { data: existingVote } = await supabase
        .from("score_votes")
        .select("id")
        .eq("score_id", scoreId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingVote) {
        const { error } = await supabase
          .from("score_votes")
          .update({
            vote: "approve",
            rejection_reason: null,
          })
          .eq("id", existingVote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("score_votes")
          .insert({
            score_id: scoreId,
            user_id: user.id,
            vote: "approve",
          });
        if (error) throw error;
      }

      // Update local state
      setScores(prev => prev.map(s => 
        s.id === scoreId 
          ? { 
              ...s, 
              user_vote: "approve",
              approve_count: s.user_vote === "reject" ? s.approve_count + 1 : (s.user_vote === null ? s.approve_count + 1 : s.approve_count),
              reject_count: s.user_vote === "reject" ? s.reject_count - 1 : s.reject_count,
            }
          : s
      ));

      toast({
        title: "Vote recorded! ✅",
        description: "Thanks for helping verify this score",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record vote",
        variant: "destructive",
      });
    } finally {
      setVotingScoreId(null);
    }
  };

  const openRejectDialog = (scoreId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to verify scores",
        variant: "destructive",
      });
      return;
    }
    setRejectingScoreId(scoreId);
    setSelectedReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!user || !rejectingScoreId || !selectedReason) return;

    setVotingScoreId(rejectingScoreId);
    setRejectDialogOpen(false);

    try {
      // First try to update existing vote
      const { data: existingVote } = await supabase
        .from("score_votes")
        .select("id")
        .eq("score_id", rejectingScoreId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingVote) {
        const { error } = await supabase
          .from("score_votes")
          .update({
            vote: "reject",
            rejection_reason: selectedReason as any,
          })
          .eq("id", existingVote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("score_votes")
          .insert({
            score_id: rejectingScoreId,
            user_id: user.id,
            vote: "reject",
            rejection_reason: selectedReason as any,
          });
        if (error) throw error;
      }

      // Update local state
      setScores(prev => prev.map(s => 
        s.id === rejectingScoreId 
          ? { 
              ...s, 
              user_vote: "reject",
              reject_count: s.user_vote === "approve" ? s.reject_count + 1 : (s.user_vote === null ? s.reject_count + 1 : s.reject_count),
              approve_count: s.user_vote === "approve" ? s.approve_count - 1 : s.approve_count,
            }
          : s
      ));

      toast({
        title: "Vote recorded! 👎",
        description: "Thanks for your feedback",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record vote",
        variant: "destructive",
      });
    } finally {
      setVotingScoreId(null);
      setRejectingScoreId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-3 mb-4">
            <Eye className="text-primary" size={28} />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Verify Scores</h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Help the community by verifying scores that couldn't be automatically validated. 
            Oldest submissions are shown first.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center gap-6 mb-8"
        >
          <div className="bg-card rounded-xl px-6 py-3 border border-border">
            <p className="text-2xl font-bold text-primary">{scores.length}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </div>
        </motion.div>

        {!user && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 max-w-4xl mx-auto text-center"
          >
            <p className="text-amber-600 dark:text-amber-400">
              <Link to="/auth" className="font-semibold underline">Sign in</Link> to vote on scores
            </p>
          </motion.div>
        )}

        {scores.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">All caught up!</h2>
            <p className="text-muted-foreground">No scores pending verification</p>
          </motion.div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {scores.map((score, index) => (
              <motion.div
                key={score.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * Math.min(index, 10) }}
                className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden"
              >
                <div className="flex flex-col md:flex-row">
                  {/* Photo */}
                  {score.photo_url ? (
                    <a
                      href={score.photo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="md:w-48 h-48 md:h-auto flex-shrink-0 bg-muted relative group"
                    >
                      <img
                        src={score.photo_url}
                        alt="Score photo"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ExternalLink className="text-white" size={24} />
                      </div>
                    </a>
                  ) : (
                    <div className="md:w-48 h-48 md:h-auto flex-shrink-0 bg-muted flex items-center justify-center">
                      <p className="text-muted-foreground text-sm">No photo</p>
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="font-semibold text-foreground text-lg">
                          {score.machine_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          by {score.username}
                        </p>
                      </div>
                      <ValidationBadge status={score.validation_status} size="md" showLabel />
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                      {score.location_name && (
                        <div className="flex items-center gap-1">
                          <MapPin size={14} />
                          <span>{score.location_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{formatDate(score.created_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {score.score.toLocaleString()}
                        </p>
                        {/* Vote counts */}
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            👍 {score.approve_count}
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            👎 {score.reject_count}
                          </span>
                        </div>
                      </div>
                      
                      {/* Voting buttons */}
                      <div className="flex gap-2">
                        {score.user_vote ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm">
                            <CheckCircle size={16} />
                            Voted {score.user_vote === "approve" ? "👍" : "👎"}
                          </div>
                        ) : (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openRejectDialog(score.id)}
                              disabled={!user || votingScoreId === score.id || score.user_id === user?.id}
                              className="gap-1 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30"
                            >
                              {votingScoreId === score.id ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <ThumbsDown size={14} />
                              )}
                              Reject
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => handleApprove(score.id)}
                              disabled={!user || votingScoreId === score.id || score.user_id === user?.id}
                              className="gap-1"
                            >
                              {votingScoreId === score.id ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : (
                                <ThumbsUp size={14} />
                              )}
                              Verify
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {score.user_id === user?.id && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        This is your score - you can't vote on it
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why are you rejecting this score?</DialogTitle>
            <DialogDescription>
              Select the main reason for rejecting this submission
            </DialogDescription>
          </DialogHeader>
          
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason} className="mt-4">
            {rejectionReasons.map((reason) => (
              <div key={reason.value} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted">
                <RadioGroupItem value={reason.value} id={reason.value} />
                <Label htmlFor={reason.value} className="flex-1 cursor-pointer">
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!selectedReason}
            >
              Reject Score
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Verify;
