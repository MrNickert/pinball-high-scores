import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, Circle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLayout } from "@/components/PageLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [rememberDevice, setRememberDevice] = useState(() => {
    return localStorage.getItem("rememberDevice") === "true";
  });
  
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!loading && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile && !profile.onboarding_completed) {
          navigate("/onboarding");
        } else {
          navigate("/");
        }
      }
    };
    
    checkOnboardingStatus();
  }, [user, loading, navigate]);

  // Start countdown when magic link is sent
  useEffect(() => {
    if (magicLinkSent && !canResend) {
      setResendCountdown(60);
      const timer = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [magicLinkSent, canResend]);

  const handleMagicLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email) {
      toast({
        title: t("common.error"),
        description: t("auth.enterEmail"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Save remember device preference
    localStorage.setItem("rememberDevice", rememberDevice.toString());
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      setCanResend(false);
      toast({
        title: t("common.success"),
        description: t("auth.magicLinkSent"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("auth.magicLinkFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // Check if running as PWA
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );

  return (
    <PageLayout className="flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          <span>{t("auth.backToHome")}</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-8 shadow-lg border border-border"
        >
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Circle className="w-12 h-12 text-primary fill-primary/20" strokeWidth={2.5} />
                <Mail
                  className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  strokeWidth={2}
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {magicLinkSent ? t("auth.checkYourEmail") : t("auth.signInTitle")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {magicLinkSent ? t("auth.magicLinkSentDesc") : t("auth.magicLinkDesc")}
            </p>
          </div>

          {magicLinkSent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("auth.magicLinkSentTo")} <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              
              {/* iOS PWA hint */}
              {isStandalone && (
                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      {t("auth.iosPwaHint", {
                        defaultValue: "On iOS home screen apps: The link will open in Safari. After signing in, return to this app manually."
                      })}
                    </p>
                  </div>
                </div>
              )}
              
              <Button
                variant="gradient"
                className="w-full"
                onClick={() => handleMagicLink()}
                disabled={!canResend || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : canResend ? (
                  t("auth.resendMagicLink")
                ) : (
                  t("auth.resendIn", { seconds: resendCountdown })
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setMagicLinkSent(false);
                  setEmail("");
                  setCanResend(false);
                }}
              >
                {t("auth.tryDifferentEmail")}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-5">
              <div>
                <Label htmlFor="email" className="text-foreground">
                  {t("auth.email")}
                </Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberDevice"
                  checked={rememberDevice}
                  onCheckedChange={(checked) => setRememberDevice(checked === true)}
                />
                <Label
                  htmlFor="rememberDevice"
                  className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5"
                >
                  <Smartphone size={14} />
                  {t("auth.rememberDevice")}
                </Label>
              </div>

              <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : t("auth.sendMagicLink")}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </PageLayout>
  );
};

export default Auth;
