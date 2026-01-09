import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Loader2, MapPin, Calendar, ExternalLink, ThumbsUp, ThumbsDown, CheckCircle, Clock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ValidationBadge } from "@/components/ValidationBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
  validation_status: "accepted" | "pending" | "declined" | null;
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

const VOTES_REQUIRED = 2;

const Verify = () => {
  const [communityScores, setCommunityScores] = useState<PendingScore[]>([]);
  const [myPendingScores, setMyPendingScores] = useState<PendingScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingScoreId, setVotingScoreId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
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
        .eq("validation_status", "pending")
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

        // Check for scores that should be auto-validated/invalidated
        const scoresToUpdate: { id: string; status: string; verified: boolean }[] = [];
        
        for (const [scoreId, voteData] of voteMap.entries()) {
          if (voteData.approve >= VOTES_REQUIRED) {
            scoresToUpdate.push({ id: scoreId, status: "accepted", verified: true });
          } else if (voteData.reject >= VOTES_REQUIRED) {
            scoresToUpdate.push({ id: scoreId, status: "declined", verified: false });
          }
        }

        // Update any scores that need it
        for (const update of scoresToUpdate) {
          await supabase
            .from("scores")
            .update({ validation_status: update.status, verified: update.verified })
            .eq("id", update.id);
        }

        // Filter out scores that were just updated
        const updatedIds = new Set(scoresToUpdate.map(s => s.id));

        const scoresWithData = pendingScores
          .filter(score => !updatedIds.has(score.id))
          .map(score => {
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

        // Split into community scores (can review) and my pending scores
        const community = scoresWithData.filter(s => 
          s.user_id !== user?.id && !s.user_vote
        );
        const myPending = scoresWithData.filter(s => s.user_id === user?.id);

        setCommunityScores(community);
        setMyPendingScores(myPending);
      } else {
        setCommunityScores([]);
        setMyPendingScores([]);
      }
    } catch (error) {
      console.error("Error fetching pending scores:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkAndUpdateValidation = async (scoreId: string, newApproveCount: number, newRejectCount: number) => {
    // Get the score owner info for notification
    const score = [...communityScores, ...myPendingScores].find(s => s.id === scoreId);
    
    if (newApproveCount >= VOTES_REQUIRED) {
      // Auto-validate: update score to accepted
      await supabase
        .from("scores")
        .update({ validation_status: "accepted", verified: true })
        .eq("id", scoreId);
      
      // Create a notification for the score owner
      if (score) {
        await supabase
          .from("notifications")
          .insert({
            user_id: score.user_id,
            type: "score_accepted",
            title: "Score accepted! 🎉",
            message: `Your ${score.machine_name} score of ${score.score.toLocaleString()} was verified by the community!`,
            data: { score_id: scoreId, machine_name: score.machine_name, score: score.score },
          });
      }
      
      // Remove from local lists
      setCommunityScores(prev => prev.filter(s => s.id !== scoreId));
      setMyPendingScores(prev => prev.filter(s => s.id !== scoreId));
      
      toast({
        title: "Score accepted! ✅",
        description: "This score has been verified by the community",
      });
      return true;
    }
    
    if (newRejectCount >= VOTES_REQUIRED) {
      // Auto-decline: update score to declined
      await supabase
        .from("scores")
        .update({ validation_status: "declined", verified: false })
        .eq("id", scoreId);
      
      // Create a notification for the score owner
      if (score) {
        await supabase
          .from("notifications")
          .insert({
            user_id: score.user_id,
            type: "score_declined",
            title: "Score not verified ❌",
            message: `Your ${score.machine_name} score could not be verified by the community.`,
            data: { score_id: scoreId, machine_name: score.machine_name, score: score.score },
          });
      }
      
      // Remove from local lists
      setCommunityScores(prev => prev.filter(s => s.id !== scoreId));
      setMyPendingScores(prev => prev.filter(s => s.id !== scoreId));
      
      toast({
        title: "Score rejected ❌",
        description: "This score has been marked as invalid",
      });
      return true;
    }
    
    return false;
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
      const score = communityScores.find(s => s.id === scoreId);
      if (!score) return;

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

      // Calculate new counts
      const newApproveCount = score.user_vote === "reject" 
        ? score.approve_count + 1 
        : (score.user_vote === null ? score.approve_count + 1 : score.approve_count);
      const newRejectCount = score.user_vote === "reject" 
        ? score.reject_count - 1 
        : score.reject_count;

      // Check if we should auto-validate/invalidate
      const wasUpdated = await checkAndUpdateValidation(scoreId, newApproveCount, newRejectCount);

      if (!wasUpdated) {
        // Remove from community list (user has voted)
        setCommunityScores(prev => prev.filter(s => s.id !== scoreId));

        toast({
          title: "Vote recorded! ✅",
          description: "Thanks for helping verify this score",
        });
      }
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
    setSelectedReasons([]);
    setRejectDialogOpen(true);
  };

  const toggleReason = (value: string) => {
    setSelectedReasons(prev => 
      prev.includes(value) 
        ? prev.filter(r => r !== value)
        : [...prev, value]
    );
  };

  const handleReject = async () => {
    if (!user || !rejectingScoreId || selectedReasons.length === 0) return;

    const scoreId = rejectingScoreId;
    const score = communityScores.find(s => s.id === scoreId);
    if (!score) return;

    setVotingScoreId(scoreId);
    setRejectDialogOpen(false);

    try {
      // Use the first reason for the database (since column only stores one)
      const primaryReason = selectedReasons[0];

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
            vote: "reject",
            rejection_reason: primaryReason as any,
          })
          .eq("id", existingVote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("score_votes")
          .insert({
            score_id: scoreId,
            user_id: user.id,
            vote: "reject",
            rejection_reason: primaryReason as any,
          });
        if (error) throw error;
      }

      // Calculate new counts
      const newRejectCount = score.user_vote === "approve" 
        ? score.reject_count + 1 
        : (score.user_vote === null ? score.reject_count + 1 : score.reject_count);
      const newApproveCount = score.user_vote === "approve" 
        ? score.approve_count - 1 
        : score.approve_count;

      // Check if we should auto-validate/invalidate
      const wasUpdated = await checkAndUpdateValidation(scoreId, newApproveCount, newRejectCount);

      if (!wasUpdated) {
        // Remove from community list (user has voted)
        setCommunityScores(prev => prev.filter(s => s.id !== scoreId));

        toast({
          title: "Vote recorded! 👎",
          description: "Thanks for your feedback",
        });
      }
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

  const renderScoreCard = (score: PendingScore, isMyScore: boolean = false) => (
    <motion.div
      key={score.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
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
              {!isMyScore && (
                <p className="text-sm text-muted-foreground">
                  by {score.username}
                </p>
              )}
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
            
            {/* Voting buttons - only show for community scores */}
            {!isMyScore && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => openRejectDialog(score.id)}
                  disabled={!user || votingScoreId === score.id}
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
                  disabled={!user || votingScoreId === score.id}
                  className="gap-1"
                >
                  {votingScoreId === score.id ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <ThumbsUp size={14} />
                  )}
                  Verify
                </Button>
              </div>
            )}

            {/* Status for my scores */}
            {isMyScore && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-sm">
                <Clock size={16} />
                Awaiting {VOTES_REQUIRED - score.approve_count} more votes
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

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
          </p>
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

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-4xl mx-auto"
        >
          <Tabs defaultValue="community">
            <TabsList className="w-full mb-6">
              <TabsTrigger value="community" className="flex-1 gap-2">
                <Eye size={16} />
                Community Reviews
                {communityScores.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                    {communityScores.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 gap-2">
                <Clock size={16} />
                My Pending
                {myPendingScores.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full">
                    {myPendingScores.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="community">
              {communityScores.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-4xl">✅</span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">All caught up!</h2>
                  <p className="text-muted-foreground">No scores pending your review</p>
                </motion.div>
              ) : (
                <div className="grid gap-4">
                  {communityScores.map((score, index) => (
                    <motion.div
                      key={score.id}
                      transition={{ delay: 0.05 * Math.min(index, 10) }}
                    >
                      {renderScoreCard(score, false)}
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="pending">
              {!user ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <p className="text-muted-foreground">Sign in to see your pending scores</p>
                </motion.div>
              ) : myPendingScores.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-primary" size={40} />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">No pending scores</h2>
                  <p className="text-muted-foreground mb-4">All your scores have been verified</p>
                  <Link to="/capture">
                    <Button>Submit a Score</Button>
                  </Link>
                </motion.div>
              ) : (
                <div className="grid gap-4">
                  {myPendingScores.map((score, index) => (
                    <motion.div
                      key={score.id}
                      transition={{ delay: 0.05 * Math.min(index, 10) }}
                    >
                      {renderScoreCard(score, true)}
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Rejection Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Why are you rejecting this score?</DialogTitle>
            <DialogDescription>
              Select all reasons that apply
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-2">
            {rejectionReasons.map((reason) => (
              <div 
                key={reason.value} 
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => toggleReason(reason.value)}
              >
                <Checkbox 
                  id={reason.value} 
                  checked={selectedReasons.includes(reason.value)}
                  onCheckedChange={() => toggleReason(reason.value)}
                />
                <Label htmlFor={reason.value} className="flex-1 cursor-pointer">
                  {reason.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={selectedReasons.length === 0}
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