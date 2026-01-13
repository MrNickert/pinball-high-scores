import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, Camera, MapPin, Zap, ArrowRight, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Dashboard } from "@/components/Dashboard";
import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

interface LatestScore {
  score: number;
  machine_name: string;
  username: string;
  created_at: string;
}

const Index = () => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [latestScore, setLatestScore] = useState<LatestScore | null>(null);
  const [loadingLatestScore, setLoadingLatestScore] = useState(true);

  const features = [
    {
      icon: Trophy,
      title: t("landing.globalLeaderboards"),
      description: t("landing.globalLeaderboardsDesc"),
    },
    {
      icon: Camera,
      title: t("landing.photoCapture"),
      description: t("landing.photoCaptureDesc"),
    },
    {
      icon: MapPin,
      title: t("landing.locationBased"),
      description: t("landing.locationBasedDesc"),
    },
    {
      icon: Zap,
      title: t("landing.instantSubmit"),
      description: t("landing.instantSubmitDesc"),
    },
  ];

  // Fetch most recent score
  useEffect(() => {
    const fetchLatestScore = async () => {
      try {
        const { data: scores, error } = await supabase
          .from("scores")
          .select("score, machine_name, user_id, created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw error;

        if (scores && scores.length > 0) {
          const recentScore = scores[0];
          
          // Fetch username
          const { data: profile } = await supabase
            .from("public_profiles")
            .select("username")
            .eq("user_id", recentScore.user_id)
            .maybeSingle();

          setLatestScore({
            score: recentScore.score,
            machine_name: recentScore.machine_name,
            username: profile?.username || "Anonymous",
            created_at: recentScore.created_at,
          });
        }
      } catch (error) {
        console.error("Error fetching latest score:", error);
      } finally {
        setLoadingLatestScore(false);
      }
    };

    fetchLatestScore();
  }, []);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!loading && user) {
        setCheckingOnboarding(true);
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile && !profile.onboarding_completed) {
            navigate("/onboarding");
            return;
          }
        } catch (error) {
          console.error("Error checking onboarding status:", error);
        } finally {
          setCheckingOnboarding(false);
        }
      }
    };

    checkOnboardingStatus();
  }, [user, loading, navigate]);

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Show dashboard for authenticated users
  if (user) {
    return (
      <PageLayout>
        <Navbar />
        <Dashboard />
        <div className="h-20 md:h-0" />
      </PageLayout>
    );
  }

  // Landing page for non-authenticated users
  return (
    <PageLayout>
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">

        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-block mb-6"
            ></motion.div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
              <span className="text-foreground">{t("landing.tagline")}</span>
              <br className="mb-2" />
              <span className="gradient-text mt-2 inline-block">{t("landing.multiball")}</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
              {t("landing.description")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/auth">
                <Button variant="gradient" size="xl">
                  {t("landing.getStarted")}
                  <ArrowRight size={18} />
                </Button>
              </Link>
              <Link to="/leaderboard">
                <Button variant="outline" size="xl">
                  {t("landing.viewLeaderboards")}
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Score Display Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-16 max-w-md mx-auto"
          >
            <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">{t("landing.latestScore")}</p>
                {loadingLatestScore ? (
                  <div className="py-4">
                    <Loader2 className="animate-spin text-primary mx-auto" size={24} />
                  </div>
                ) : latestScore ? (
                  <>
                    <motion.div
                      className="text-4xl font-bold text-foreground score-display"
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5, type: "spring" }}
                    >
                      {latestScore.score.toLocaleString()}
                    </motion.div>
                    <p className="text-primary mt-2 font-semibold">{latestScore.machine_name}</p>
                    <p className="text-muted-foreground text-sm">by @{latestScore.username}</p>
                    <p className="text-muted-foreground/70 text-xs mt-1">
                      {formatDistanceToNow(new Date(latestScore.created_at), { addSuffix: true })}
                    </p>
                  </>
                ) : (
                  <div className="py-2">
                    <p className="text-muted-foreground text-lg">{t("landing.noScoresYet")}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t("landing.beTheFirst")}</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{t("landing.howItWorks")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("landing.simpleSteps")}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-card rounded-2xl p-6 text-center border border-border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                  <feature.icon size={24} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 rounded-3xl p-10 md:p-16 text-center border border-border"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{t("landing.readyToStart")}</h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8">
              {t("landing.joinPlayers")}
            </p>
            <Link to="/auth">
              <Button variant="gradient" size="xl">
                {t("landing.createFreeAccount")}
                <ArrowRight size={18} />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Bottom padding for mobile nav */}
      <div className="h-20 md:h-0" />
    </PageLayout>
  );
};

export default Index;