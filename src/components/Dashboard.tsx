import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, Camera, TrendingUp, Clock, Target, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Score {
  id: string;
  score: number;
  machine_name: string;
  created_at: string;
  validation_status: string | null;
  verified: boolean | null;
}

interface Stats {
  totalScores: number;
  verifiedScores: number;
  highestScore: number;
  recentMachine: string | null;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const [recentScores, setRecentScores] = useState<Score[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalScores: 0,
    verifiedScores: 0,
    highestScore: 0,
    recentMachine: null,
  });
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch profile for username
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          setUsername(profile.username);
        }

        // Fetch recent scores
        const { data: scores, error } = await supabase
          .from("scores")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!error && scores) {
          setRecentScores(scores);

          // Calculate stats
          const verifiedCount = scores.filter((s) => s.verified).length;
          const allScoresQuery = await supabase
            .from("scores")
            .select("score, verified", { count: "exact" })
            .eq("user_id", user.id);

          const allScores = allScoresQuery.data || [];
          const highest = allScores.length > 0 
            ? Math.max(...allScores.map((s) => s.score)) 
            : 0;

          setStats({
            totalScores: allScoresQuery.count || 0,
            verifiedScores: allScores.filter((s) => s.verified).length,
            highestScore: highest,
            recentMachine: scores[0]?.machine_name || null,
          });
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const formatScore = (score: number) => {
    return score.toLocaleString();
  };

  const getStatusBadge = (score: Score) => {
    if (score.verified) {
      return <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Verified</span>;
    }
    if (score.validation_status === "rejected") {
      return <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full">Rejected</span>;
    }
    return <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">Pending</span>;
  };

  return (
    <div className="pt-24 pb-24 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Welcome back{username ? `, ${username}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground">
            Ready to capture your next high score?
          </p>
        </motion.div>

        {/* Quick Capture Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Link to="/capture">
            <Button variant="gradient" size="xl" className="w-full sm:w-auto">
              <Camera size={20} />
              Capture New Score
            </Button>
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Target size={16} />
              <span className="text-xs font-medium">Total Scores</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loading ? "-" : stats.totalScores}
            </p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy size={16} />
              <span className="text-xs font-medium">Verified</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {loading ? "-" : stats.verifiedScores}
            </p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">High Score</span>
            </div>
            <p className="text-2xl font-bold text-foreground truncate">
              {loading ? "-" : formatScore(stats.highestScore)}
            </p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock size={16} />
              <span className="text-xs font-medium">Last Machine</span>
            </div>
            <p className="text-lg font-semibold text-foreground truncate">
              {loading ? "-" : stats.recentMachine || "None yet"}
            </p>
          </div>
        </motion.div>

        {/* Recent Scores */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Recent Scores</h2>
            <Link to="/profile" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : recentScores.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No scores yet. Capture your first one!</p>
              <Link to="/capture">
                <Button variant="outline" size="sm">
                  <Camera size={16} />
                  Capture Score
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentScores.map((score, index) => (
                <motion.div
                  key={score.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{score.machine_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(score.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(score)}
                    <span className="font-bold text-foreground score-display">
                      {formatScore(score.score)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8 grid grid-cols-2 gap-4"
        >
          <Link to="/leaderboard">
            <div className="bg-card rounded-xl p-4 border border-border hover:border-primary/50 transition-colors group">
              <Trophy size={24} className="text-primary mb-2" />
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Leaderboard</h3>
              <p className="text-sm text-muted-foreground">See top scores</p>
            </div>
          </Link>
          <Link to="/verify">
            <div className="bg-card rounded-xl p-4 border border-border hover:border-secondary/50 transition-colors group">
              <Target size={24} className="text-secondary mb-2" />
              <h3 className="font-semibold text-foreground group-hover:text-secondary transition-colors">Verify Scores</h3>
              <p className="text-sm text-muted-foreground">Help the community</p>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};
