import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, Camera, TrendingUp, Clock, Target, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { enUS, nl } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

interface Stats {
  totalScores: number;
  verifiedScores: number;
  machinesPlayed: number;
  recentMachine: string | null;
}

interface FriendActivity {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  machine_name: string;
  created_at: string;
}

export const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [stats, setStats] = useState<Stats>({
    totalScores: 0,
    verifiedScores: 0,
    machinesPlayed: 0,
    recentMachine: null,
  });
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [friendActivity, setFriendActivity] = useState<FriendActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  const dateLocale = language === "nl" ? nl : enUS;

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
        const uniqueMachines = new Set(allScores.map((s) => s.machine_name)).size;

        setStats({
          totalScores: allScoresQuery.count || 0,
          verifiedScores: allScores.filter((s) => s.verified).length,
          machinesPlayed: uniqueMachines,
          recentMachine: allScores[0]?.machine_name || null,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchFriendActivity = async () => {
      if (!user) return;

      try {
        // Get accepted friendships
        const { data: friendships } = await supabase
          .from("friendships")
          .select("requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

        if (!friendships || friendships.length === 0) {
          setActivityLoading(false);
          return;
        }

        // Get friend IDs
        const friendIds = friendships.map((f) =>
          f.requester_id === user.id ? f.addressee_id : f.requester_id
        );

        // Get recent scores from friends
        const { data: scores } = await supabase
          .from("scores")
          .select("id, score, machine_name, created_at, user_id")
          .in("user_id", friendIds)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!scores || scores.length === 0) {
          setActivityLoading(false);
          return;
        }

        // Get profiles for these friends
        const { data: profiles } = await supabase
          .from("public_profiles")
          .select("user_id, username, avatar_url")
          .in("user_id", friendIds);

        // Combine data
        const activity: FriendActivity[] = scores.map((score) => {
          const profile = profiles?.find((p) => p.user_id === score.user_id);
          return {
            id: score.id,
            user_id: score.user_id,
            username: profile?.username || "Unknown",
            avatar_url: profile?.avatar_url || null,
            score: score.score,
            machine_name: score.machine_name,
            created_at: score.created_at,
          };
        });

        setFriendActivity(activity);
      } catch (error) {
        console.error("Error fetching friend activity:", error);
      } finally {
        setActivityLoading(false);
      }
    };

    fetchData();
    fetchFriendActivity();
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
            {t("dashboard.welcome")}{username ? `, ${username}` : ""}! 👋
          </h1>
          <p className="text-muted-foreground">
            {language === "nl" ? "Klaar om je volgende high score vast te leggen?" : "Ready to capture your next high score?"}
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
              {language === "nl" ? "Nieuwe Score Vastleggen" : "Capture New Score"}
            </Button>
          </Link>
          <Link to="/verify" className="flex-1">
            <Button variant="outline" size="xl" className="w-full">
              <Target size={20} />
              {t("verify.title")}
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
              <span className="text-xs font-medium">{language === "nl" ? "Totale Scores" : "Total Scores"}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loading ? "-" : stats.totalScores}
            </p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy size={16} />
              <span className="text-xs font-medium">{language === "nl" ? "Geverifieerd" : "Verified"}</span>
            </div>
            <p className="text-2xl font-bold text-primary">
              {loading ? "-" : stats.verifiedScores}
            </p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp size={16} />
              <span className="text-xs font-medium">{language === "nl" ? "Machines Gespeeld" : "Machines Played"}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {loading ? "-" : stats.machinesPlayed}
            </p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock size={16} />
              <span className="text-xs font-medium">{language === "nl" ? "Laatste Machine" : "Last Machine"}</span>
            </div>
            <p className="text-lg font-semibold text-foreground truncate">
              {loading ? "-" : stats.recentMachine || (language === "nl" ? "Nog geen" : "None yet")}
            </p>
          </div>
        </motion.div>

        {/* Friends Activity Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Users size={18} className="text-secondary" />
              {language === "nl" ? "Vriendenactiviteit" : "Friends Activity"}
            </h2>
            <Link to="/friends" className="text-sm text-primary hover:underline flex items-center gap-1">
              {language === "nl" ? "Alles bekijken" : "View all"} <ChevronRight size={14} />
            </Link>
          </div>

          {activityLoading ? (
            <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
          ) : friendActivity.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                {language === "nl" 
                  ? "Nog geen vriendenactiviteit. Maak contact met andere spelers!" 
                  : "No friend activity yet. Connect with other players!"}
              </p>
              <Link to="/friends">
                <Button variant="outline" size="sm">
                  <Users size={16} />
                  {language === "nl" ? "Vind Vrienden" : "Find Friends"}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {friendActivity.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  <Link to={`/profile/${activity.user_id}`} className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-lg flex-shrink-0 hover:opacity-80 transition-opacity">
                    {activity.avatar_url ? (
                      <img src={activity.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      "👤"
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <Link to={`/profile/${activity.user_id}`} className="font-semibold hover:text-primary transition-colors">
                        {activity.username}
                      </Link>
                      <span className="text-muted-foreground"> {language === "nl" ? "scoorde" : "scored"} </span>
                      <span className="font-bold text-primary">{formatScore(activity.score)}</span>
                      <span className="text-muted-foreground"> {language === "nl" ? "op" : "on"} </span>
                      <span className="font-medium">{activity.machine_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </div>
  );
};