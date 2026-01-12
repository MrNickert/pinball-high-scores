import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Trophy, Target, Calendar, Settings, Loader2, MapPin, CheckCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ValidationBadge } from "@/components/ValidationBadge";
import { useTranslation } from "react-i18next";

interface Profile {
  username: string;
  avatar_url: string | null;
  created_at: string;
  last_location_name?: string | null;
  last_location_updated_at?: string | null;
}

interface Score {
  id: string;
  machine_name: string;
  score: number;
  created_at: string;
  validation_status: "accepted" | "pending" | "declined" | null;
}

const Profile = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Determine if viewing own profile or someone else's
  const isOwnProfile = !userId || userId === user?.id;
  const targetUserId = userId || user?.id;

  useEffect(() => {
    // Redirect to auth if not logged in (for any profile view)
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (targetUserId) {
      fetchProfileAndScores(targetUserId);
    }
  }, [user, loading, navigate, targetUserId]);

  const fetchProfileAndScores = async (profileUserId: string) => {
    try {
      // Fetch profile - use public_profiles for other users, profiles for own
      let profileData: Profile | null = null;
      
      if (isOwnProfile) {
        const { data } = await supabase
          .from("profiles")
          .select("username, avatar_url, created_at, last_location_name, last_location_updated_at")
          .eq("user_id", profileUserId)
          .maybeSingle();
        profileData = data;
      } else {
        // For other users, fetch from public_profiles (doesn't have location) 
        // and also get last location from their most recent score
        const { data } = await supabase
          .from("public_profiles")
          .select("username, avatar_url, created_at")
          .eq("user_id", profileUserId)
          .maybeSingle();
        
        // Get last location from most recent score
        const { data: lastScore } = await supabase
          .from("scores")
          .select("location_name, created_at")
          .eq("user_id", profileUserId)
          .not("location_name", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          profileData = {
            ...data,
            last_location_name: lastScore?.location_name || null,
            last_location_updated_at: lastScore?.created_at || null,
          };
        }
      }

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch user's scores
      const { data: scoresData } = await supabase
        .from("scores")
        .select("id, machine_name, score, created_at, validation_status")
        .eq("user_id", profileUserId)
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
            <h1 className="text-xl font-bold text-foreground mb-2">{t("common.signInRequired")}</h1>
            <p className="text-muted-foreground mb-6">
              {t("auth.signInToViewProfiles")}
            </p>
            <Link to="/auth">
              <Button variant="gradient" size="lg">
                {t("auth.signIn")}
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!targetUserId || (!isOwnProfile && !profile)) {
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
            <h1 className="text-xl font-bold text-foreground mb-2">{t("profile.profileNotFound")}</h1>
            <p className="text-muted-foreground mb-6">
              {t("profile.profileNotFoundDesc")}
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  const verifiedScoresCount = scores.filter(s => s.validation_status === "accepted").length;

  const stats = [
    { label: t("profile.totalScores"), value: scores.length.toString(), icon: Target },
    { label: t("profile.verifiedScores"), value: verifiedScoresCount.toString(), icon: CheckCircle },
    { label: t("profile.machinesPlayed"), value: new Set(scores.map(s => s.machine_name)).size.toString(), icon: Target },
    { label: t("profile.memberSince"), value: profile?.created_at ? new Date(profile.created_at).getFullYear().toString() : "2025", icon: Calendar },
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
              className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-4xl overflow-hidden"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                "🎯"
              )}
            </motion.div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-xl font-bold text-foreground mb-1">
                {profile?.username || "Player"}
              </h1>
              {isOwnProfile && user?.email && (
                <p className="text-muted-foreground text-sm">{user.email}</p>
              )}
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start flex-wrap">
                <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                  {scores.length > 10 ? t("profile.proPlayer") : t("profile.newPlayer")}
                </span>
                {profile?.last_location_name && (
                  <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-full flex items-center gap-1">
                    <MapPin size={12} />
                    {profile.last_location_name}
                    {profile.last_location_updated_at && (
                      <span className="opacity-70">
                        · {new Date(profile.last_location_updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            {isOwnProfile && (
              <Link to="/settings">
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings size={16} />
                  {t("profile.editProfile")}
                </Button>
              </Link>
          </div>
        </motion.div>
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
            <h2 className="font-semibold text-foreground">{t("profile.recentScores")}</h2>
            {isOwnProfile && (
              <Link to="/capture">
                <Button variant="ghost" size="sm">{t("profile.addScore")}</Button>
              </Link>
            )}
          </div>
          {scores.length === 0 ? (
            <div className="p-8 text-center">
              <Trophy className="mx-auto mb-4 text-muted-foreground" size={48} />
              <p className="text-muted-foreground mb-4">{t("profile.noScoresYet")}</p>
              {isOwnProfile && (
                <Link to="/capture">
                  <Button variant="gradient">{t("profile.submitFirstScore")}</Button>
                </Link>
              )}
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
