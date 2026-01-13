import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Upload, Loader2, ArrowRight, ArrowLeft, Shield, Check, Circle, Globe, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageLayout } from "@/components/PageLayout";
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

  // Generate a unique DiceBear avatar URL based on user ID
  const defaultAvatarUrl = user?.id 
    ? `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${user.id}` 
    : "";

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
    
    // Step 2 validates username
    if (step === 2) {
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
      setStep(2);
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
          avatar_url: avatarUrl || defaultAvatarUrl || null,
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
        setStep(2);
      } else if (error?.code === "23514") {
        toast.error("Username must be 3–30 chars and use only letters, numbers, _ or -");
        setStep(2);
      } else {
        toast.error("Failed to save profile");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || checkingProfile) {
    return (
      <PageLayout className="flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </PageLayout>
    );
  }

  if (!user) {
    return null;
  }

  const languages = [
    { code: "en", name: "English", flag: "🇬🇧", nativeName: "English" },
    { code: "nl", name: "Dutch", flag: "🇳🇱", nativeName: "Nederlands" },
  ];

  return (
    <PageLayout className="flex items-center justify-center px-4">
      <div className="w-full max-w-md">
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
            {/* Step 1: Language Selector */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Globe size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{t("onboarding.chooseLanguage")}</span>
                </div>

                <div className="flex justify-center gap-6 py-8">
                  {languages.map((lang) => (
                    <motion.button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code as "en" | "nl")}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative w-20 h-20 text-5xl rounded-2xl border-2 transition-all flex items-center justify-center ${
                        language === lang.code
                          ? "border-primary bg-primary/10 shadow-lg ring-2 ring-primary/30"
                          : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      {lang.flag}
                      {language === lang.code && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md"
                        >
                          <Check size={14} className="text-primary-foreground" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Username & Avatar */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <User size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{t("onboarding.yourIdentity")}</span>
                </div>

                {/* Username first */}
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

                {/* Avatar second */}
                <div className="flex flex-col items-center gap-4 pt-4">
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden ring-4 ring-primary/20">
                    <img 
                      src={avatarUrl || defaultAvatarUrl} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                    />
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
                      size="sm"
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

            {/* Step 3: First Name & Last Name */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <User size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{t("onboarding.yourName")}</span>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {t("onboarding.nameOptional")}
                </p>

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
              </motion.div>
            )}

            {/* Step 4: Settings (Metric/Imperial & Privacy) */}
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
                  <span className="font-medium text-foreground">{t("onboarding.finalSettings")}</span>
                </div>

                <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                  {/* Distance Units */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Ruler size={18} className="text-primary" />
                      </div>
                      <div>
                        <Label className="text-foreground font-medium">{t("onboarding.units")}</Label>
                        <p className="text-sm text-muted-foreground">{t("onboarding.unitsDesc")}</p>
                      </div>
                    </div>
                    <Select
                      value={useMetric ? "metric" : "imperial"}
                      onValueChange={(value) => setUseMetric(value === "metric")}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">{t("onboarding.metric")}</SelectItem>
                        <SelectItem value="imperial">{t("onboarding.imperial")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="border-t border-border" />

                  {/* Public Profile */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Globe size={18} className="text-primary" />
                      </div>
                      <div>
                        <Label htmlFor="public-profile" className="text-foreground font-medium">
                          {t("onboarding.publicProfile")}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {t("onboarding.publicProfileDesc")}
                        </p>
                      </div>
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
              <Button variant="gradient" onClick={handleNext} disabled={checkingUsername || (step === 2 && !username.trim())}>
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
    </PageLayout>
  );
};

export default Onboarding;
