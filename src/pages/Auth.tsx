import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowLeft, Loader2, Circle, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@/components/PageLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { createNotification, NotificationTypes } from "@/hooks/useNotifications";

const getPasswordStrength = (password: string): { level: number; label: string } => {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: "passwordWeak" };
  if (score === 2) return { level: 2, label: "passwordFair" };
  if (score === 3) return { level: 3, label: "passwordGood" };
  return { level: 4, label: "passwordStrong" };
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { signIn, signUp, user, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      // Redirect back to origin; Index page handles onboarding redirect for new users
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!loading && user) {
        // Check if user has completed onboarding
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        // Don't navigate here - let the useEffect handle redirect after checking onboarding status
      } else {
        // Generate a temporary username from email for signup
        const tempUsername = email.split("@")[0].replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 20);
        const { error, data } = await signUp(email, password, tempUsername);
        if (error) throw error;

        // Create welcome notification for new user
        if (data?.user) {
          await createNotification({
            userId: data.user.id,
            type: NotificationTypes.WELCOME,
            title: "Welcome to Multiball! 🎉",
            message: "Start capturing your pinball scores and compete with friends.",
          });
        }

        toast({
          title: t("auth.accountCreated"),
          description: t("auth.letsSetupProfile"),
        });
        // Navigate to onboarding for new users
        navigate("/onboarding");
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("errors.somethingWrong"),
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
                <Circle
                  className="w-4 h-4 text-primary fill-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  strokeWidth={0}
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isLogin ? t("auth.signInToTrack") : t("auth.startTracking")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div>
              <Label htmlFor="password" className="text-foreground">
                {t("auth.password")}
              </Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Password strength indicator - only show during signup */}
              {!isLogin && password && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => {
                      const strength = getPasswordStrength(password);
                      const isActive = level <= strength.level;
                      return (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            isActive
                              ? strength.level <= 1
                                ? "bg-destructive"
                                : strength.level === 2
                                ? "bg-amber-500"
                                : strength.level === 3
                                ? "bg-primary"
                                : "bg-green-500"
                              : "bg-muted"
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className={`text-xs ${
                    getPasswordStrength(password).level <= 1
                      ? "text-destructive"
                      : getPasswordStrength(password).level === 2
                      ? "text-amber-500"
                      : getPasswordStrength(password).level === 3
                      ? "text-primary"
                      : "text-green-500"
                  }`}>
                    {t(`settings.${getPasswordStrength(password).label}`)}
                  </p>
                </div>
              )}

              {/* Password requirements - only show during signup */}
              {!isLogin && (
                <div className="text-xs text-muted-foreground space-y-1 mt-3">
                  <p className="font-medium">{t("settings.passwordRequirements")}</p>
                  <ul className="space-y-0.5 ml-1">
                    <li className={`flex items-center gap-1.5 ${password.length >= 6 ? "text-green-500" : ""}`}>
                      <Check size={12} className={password.length >= 6 ? "opacity-100" : "opacity-0"} />
                      {t("settings.reqMinLength")}
                    </li>
                    <li className={`flex items-center gap-1.5 ${/[A-Z]/.test(password) ? "text-green-500" : ""}`}>
                      <Check size={12} className={/[A-Z]/.test(password) ? "opacity-100" : "opacity-0"} />
                      {t("settings.reqUppercase")}
                    </li>
                    <li className={`flex items-center gap-1.5 ${/[a-z]/.test(password) ? "text-green-500" : ""}`}>
                      <Check size={12} className={/[a-z]/.test(password) ? "opacity-100" : "opacity-0"} />
                      {t("settings.reqLowercase")}
                    </li>
                    <li className={`flex items-center gap-1.5 ${/[0-9]/.test(password) ? "text-green-500" : ""}`}>
                      <Check size={12} className={/[0-9]/.test(password) ? "opacity-100" : "opacity-0"} />
                      {t("settings.reqNumber")}
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : isLogin ? t("auth.signIn") : t("auth.createAccount")}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t("auth.orContinueWith")}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t("auth.continueWithGoogle")}
              </>
            )}
          </Button>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
              <span className="text-primary font-medium ml-1">{isLogin ? t("auth.signUp") : t("auth.signIn")}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </PageLayout>
  );
};

export default Auth;