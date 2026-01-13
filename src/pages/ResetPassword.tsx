import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Lock, ArrowLeft, Loader2, Circle, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLayout } from "@/components/PageLayout";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

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

const ResetPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      }
      setCheckingSession(false);
    };

    checkSession();

    // Listen for auth state changes (recovery link sets up a session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
        setCheckingSession(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: t("common.error"),
        description: t("settings.passwordMinLength"),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: t("common.error"),
        description: t("settings.passwordsDontMatch"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("auth.passwordResetSuccess"),
      });
      
      navigate("/");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("auth.passwordResetFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <PageLayout className="flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </PageLayout>
    );
  }

  if (!isValidSession) {
    return (
      <PageLayout className="flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
            <h1 className="text-2xl font-bold text-foreground mb-4">
              {t("auth.invalidResetLink")}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t("auth.invalidResetLinkDesc")}
            </p>
            <Link to="/auth">
              <Button variant="gradient">{t("auth.backToSignIn")}</Button>
            </Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          <span>{t("auth.backToSignIn")}</span>
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
                <Lock
                  className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  strokeWidth={2}
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {t("auth.setNewPassword")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("auth.enterNewPassword")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="password" className="text-foreground">
                {t("settings.newPassword")}
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

              {/* Password strength indicator */}
              {password && (
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

              {/* Password requirements */}
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
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-foreground">
                {t("settings.confirmPassword")}
              </Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive mt-2">{t("settings.passwordsDontMatch")}</p>
              )}
            </div>

            <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : t("auth.resetPassword")}
            </Button>
          </form>
        </motion.div>
      </div>
    </PageLayout>
  );
};

export default ResetPassword;
