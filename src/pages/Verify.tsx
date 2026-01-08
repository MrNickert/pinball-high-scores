import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Eye, Loader2, MapPin, Calendar, ExternalLink } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ValidationBadge } from "@/components/ValidationBadge";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface PendingScore {
  id: string;
  score: number;
  machine_name: string;
  location_name: string | null;
  photo_url: string | null;
  created_at: string;
  username: string;
  validation_status: "ai_validated" | "score_only" | "not_validated" | null;
}

const Verify = () => {
  const [scores, setScores] = useState<PendingScore[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchPendingScores();
  }, []);

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
        .order("created_at", { ascending: true }) // Oldest first
        .limit(50);

      if (error) throw error;

      if (pendingScores && pendingScores.length > 0) {
        const userIds = [...new Set(pendingScores.map(s => s.user_id))];
        const { data: profiles } = await supabase
          .from("public_profiles")
          .select("user_id, username")
          .in("user_id", userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.username]) || []);

        const scoresWithUsernames = pendingScores.map(score => ({
          id: score.id,
          score: score.score,
          machine_name: score.machine_name,
          location_name: score.location_name,
          photo_url: score.photo_url,
          created_at: score.created_at,
          username: profileMap.get(score.user_id) || "Anonymous",
          validation_status: score.validation_status as PendingScore["validation_status"],
        }));

        setScores(scoresWithUsernames);
      }
    } catch (error) {
      console.error("Error fetching pending scores:", error);
    } finally {
      setLoading(false);
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
                      <p className="text-2xl font-bold text-primary">
                        {score.score.toLocaleString()}
                      </p>
                      
                      {/* Future: Add verification buttons here */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled>
                          👎 Reject
                        </Button>
                        <Button variant="default" size="sm" disabled>
                          👍 Verify
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Info note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-sm text-muted-foreground mt-8 max-w-lg mx-auto"
        >
          💡 Community verification coming soon! For now, browse scores that need review.
        </motion.p>
      </div>

      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Verify;
