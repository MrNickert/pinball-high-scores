import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Trophy, Target, Calendar, Settings, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ValidationBadge } from "@/components/ValidationBadge";

interface Profile {
  username: string;
  avatar_url: string | null;
  created_at: string;
}

interface Score {
  id: string;
  machine_name: string;
  score: number;
  created_at: string;
  validation_status: "ai_validated" | "score_only" | "not_validated" | null;
}

const Profile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      fetchProfileAndScores();
    }
  }, [user, loading, navigate]);

  const fetchProfileAndScores = async () => {
    if (!user) return;

    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch user's scores
      const { data: scoresData } = await supabase
        .from("scores")
        .select("id, machine_name, score, created_at, validation_status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (scoresData) {
        setScores(scoresData as Score[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };


  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="animate-spin text-primary" size={32} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-24 flex items-center justify-center min-h-[80vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center bg-card rounded-2xl p-10 max-w-md border border-border shadow-sm"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="text-primary" size={32} />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">
              Sign in required
            </h1>
            <p className="text-muted-foreground mb-6">
              Create an account or sign in to view your profile and track your scores.
            </p>
            <Link to="/auth">
              <Button variant="gradient" size="lg">
                Sign In
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Total Scores", value: scores.length.toString(), icon: Target },
    { label: "Best Score", value: scores.length > 0 ? Math.max(...scores.map(s => s.score)).toLocaleString() : "0", icon: Trophy },
    { label: "Machines Played", value: new Set(scores.map(s => s.machine_name)).size.toString(), icon: Target },
    { label: "Member Since", value: profile?.created_at ? new Date(profile.created_at).getFullYear().toString() : "2025", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-24 max-w-4xl">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-6 mb-6 border border-border shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-4xl"
            >
              🎯
            </motion.div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-xl font-bold text-foreground mb-1">
                {profile?.username || "Player"}
              </h1>
              <p className="text-muted-foreground text-sm">{user.email}</p>
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                  {scores.length > 10 ? "Pro Player" : "New Player"}
                </span>
              </div>
            </div>
            <Link to="/settings">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings size={16} />
                Edit Profile
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card rounded-xl p-4 text-center border border-border shadow-sm"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <stat.icon className="text-primary" size={20} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent Scores */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent Scores</h2>
            <Link to="/capture">
              <Button variant="ghost" size="sm">Add Score</Button>
            </Link>
          </div>
          {scores.length === 0 ? (
            <div className="p-8 text-center">
              <Trophy className="mx-auto mb-4 text-muted-foreground" size={48} />
              <p className="text-muted-foreground mb-4">No scores yet</p>
              <Link to="/capture">
                <Button variant="gradient">Submit Your First Score</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {scores.map((score, index) => (
                <motion.div
                  key={score.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-center gap-4 p-4"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Trophy className="text-primary" size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{score.machine_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(score.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ValidationBadge status={score.validation_status} size="sm" />
                    <p className="font-bold text-primary">
                      {score.score.toLocaleString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Profile;
