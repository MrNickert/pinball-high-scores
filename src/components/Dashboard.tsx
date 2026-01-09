import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, Camera, TrendingUp, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalScores: number;
  verifiedScores: number;
  highestScore: number;
  recentMachine: string | null;
}

export const Dashboard = () => {
  const { user } = useAuth();
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

        // Fetch stats
        const allScoresQuery = await supabase
          .from("scores")
          .select("score, verified, machine_name, created_at", { count: "exact" })
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        const allScores = allScoresQuery.data || [];
        const highest = allScores.length > 0 
          ? Math.max(...allScores.map((s) => s.score)) 
          : 0;

        setStats({
          totalScores: allScoresQuery.count || 0,
          verifiedScores: allScores.filter((s) => s.verified).length,
          highestScore: highest,
          recentMachine: allScores[0]?.machine_name || null,
        });
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

        {/* Quick Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          <Link to="/capture" className="flex-1">
            <Button variant="gradient" size="xl" className="w-full">
              <Camera size={20} />
              Capture New Score
            </Button>
          </Link>
          <Link to="/verify" className="flex-1">
            <Button variant="outline" size="xl" className="w-full">
              <Target size={20} />
              Verify Scores
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

      </div>
    </div>
  );
};
