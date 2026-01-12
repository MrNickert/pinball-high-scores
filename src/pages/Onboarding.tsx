import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Upload, Loader2, ArrowRight, ArrowLeft, Shield, Check, Circle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be 30 characters or less")
  .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore, or dash");

const nameSchema = z
  .string()
  .trim()
  .max(50, "Name must be 50 characters or less")
  .optional();

const Onboarding = () => {
  const { user, loading } = useAuth();
  const { language, setLanguage, useMetric, setUseMetric } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const totalSteps = 4;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkOnboardingStatus();
    }
  }, [user, loading, navigate]);

  const checkOnboardingStatus = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, first_name, last_name, avatar_url, is_public, onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        // If onboarding is completed, redirect to home
        if (profile.onboarding_completed) {
          navigate("/");
          return;
        }

        // Pre-fill existing data
        setUsername(profile.username || "");
        setFirstName(profile.first_name || "");
        setLastName(profile.last_name || "");
        setAvatarUrl(profile.avatar_url || "");
        setIsPublic(profile.is_public ?? true);
      }
    } catch (error) {
      console.error("Error checking profile:", error);
    } finally {
      setCheckingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(urlWithTimestamp);
      toast.success("Photo uploaded!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleNext = async () => {
    setUsernameError("");
    
    if (step === 1) {
      // Validate username format
      const parsed = usernameSchema.safeParse(username);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || "Invalid username";
        setUsernameError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Check if username is already taken using secure database function
      setCheckingUsername(true);
      try {
        const { data: isAvailable, error } = await supabase
          .rpc("is_username_available", {
            check_username: parsed.data,
            exclude_user_id: user?.id || null,
          });

        if (error) throw error;

        if (!isAvailable) {
          const errorMsg = "This username is already taken. Please choose another.";
          setUsernameError(errorMsg);
          toast.error(errorMsg);
          return;
        }
      } catch (error) {
        console.error("Error checking username:", error);
        toast.error("Failed to verify username availability");
        return;
      } finally {
        setCheckingUsername(false);
      }
    }
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleComplete = async () => {
    if (!user) return;

    const parsedUsername = usernameSchema.safeParse(username);
    if (!parsedUsername.success) {
      toast.error(parsedUsername.error.issues[0]?.message || "Invalid username");
      setStep(1);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: parsedUsername.data,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          avatar_url: avatarUrl || null,
          is_public: isPublic,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Profile set up successfully!");
      navigate("/");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      if (error?.code === "23505") {
        toast.error("This username is already taken. Please choose another.");
        setStep(1);
      } else if (error?.code === "23514") {
        toast.error("Username must be 3–30 chars and use only letters, numbers, _ or -");
        setStep(1);
      } else {
        toast.error("Failed to save profile");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-8 shadow-lg border border-border"
        >
          {/* Header */}
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
            <h1 className="text-2xl font-bold text-foreground mb-2">{t("onboarding.setupProfile")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("onboarding.readyToTrack")}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 w-10 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            {/* Step 1: Name & Username */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <User size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{t("onboarding.yourName")}</span>
                </div>

                <div>
                  <Label htmlFor="firstName" className="text-foreground">
                    {t("onboarding.firstName")}
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="mt-2"
                    maxLength={50}
                  />
                </div>

                <div>
                  <Label htmlFor="lastName" className="text-foreground">
                    {t("onboarding.lastName")}
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="mt-2"
                    maxLength={50}
                  />
                </div>

                <div>
                  <Label htmlFor="username" className="text-foreground">
                    {t("onboarding.username")} <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1 mb-2">
                    {t("onboarding.usernameVisible")}
                  </p>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setUsernameError("");
                    }}
                    placeholder="pinball_wizard"
                    maxLength={30}
                    className={usernameError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {usernameError && (
                    <p className="text-sm text-destructive mt-2">{usernameError}</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Language & Distance */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Globe size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{t("onboarding.preferences")}</span>
                </div>

                <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-foreground font-medium">{t("onboarding.language")}</Label>
                      <p className="text-sm text-muted-foreground mt-1">{t("onboarding.languageDesc")}</p>
                    </div>
                    <Select
                      value={language}
                      onValueChange={(value: "en" | "nl") => setLanguage(value)}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">{t("onboarding.english")}</SelectItem>
                        <SelectItem value="nl">{t("onboarding.dutch")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-foreground font-medium">{t("onboarding.units")}</Label>
                        <p className="text-sm text-muted-foreground mt-1">{t("onboarding.unitsDesc")}</p>
                      </div>
                      <Select
                        value={useMetric ? "metric" : "imperial"}
                        onValueChange={(value) => setUseMetric(value === "metric")}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="metric">{t("onboarding.metric")}</SelectItem>
                          <SelectItem value="imperial">{t("onboarding.imperial")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Profile Picture */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Upload size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{t("onboarding.profilePicture")}</span>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🎯</span>
                    )}
                  </div>
                  <div className="text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="animate-spin mr-2" size={16} />
                      ) : (
                        <Upload size={16} className="mr-2" />
                      )}
                      {uploading ? t("onboarding.uploading") : avatarUrl ? t("onboarding.changePhoto") : t("onboarding.uploadPhoto")}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">{t("onboarding.maxFileSize")}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Privacy */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{t("onboarding.privacySettings")}</span>
                </div>

                <div className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="public-profile" className="text-foreground font-medium">
                        {t("onboarding.publicProfile")}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("onboarding.publicProfileDesc")}
                      </p>
                    </div>
                    <Switch
                      id="public-profile"
                      checked={isPublic}
                      onCheckedChange={setIsPublic}
                    />
                  </div>
                </div>

                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                  <h3 className="font-medium text-foreground flex items-center gap-2 mb-2">
                    <Check size={16} className="text-primary" />
                    {t("onboarding.readyToGo")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("onboarding.changeSettingsLater")}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft size={16} className="mr-2" />
                {t("common.back")}
              </Button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <Button variant="gradient" onClick={handleNext} disabled={checkingUsername}>
                {checkingUsername ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {t("common.next")}
                <ArrowRight size={16} className="ml-2" />
              </Button>
            ) : (
              <Button variant="gradient" onClick={handleComplete} disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {t("onboarding.completeSetup")}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Onboarding;
