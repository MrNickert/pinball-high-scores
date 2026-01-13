import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Bell, Shield, Trash2, User, Loader2, Upload, Globe, Lock, Eye, EyeOff } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { PageLayout } from "@/components/PageLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const { language, setLanguage, useMetric, setUseMetric } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [notifyScoreUpdates, setNotifyScoreUpdates] = useState(true);
  const [notifyFriendActivity, setNotifyFriendActivity] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [isEmailProvider, setIsEmailProvider] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      checkAuthProvider();
    }
  }, [user]);

  const checkAuthProvider = async () => {
    if (!user) return;
    // Check if user signed up with email/password (not OAuth)
    const { data } = await supabase.auth.getSession();
    const provider = data.session?.user?.app_metadata?.provider;
    setIsEmailProvider(provider === "email");
  };

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url, first_name, last_name, is_public, notify_score_updates, notify_friend_activity")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setUsername(data.username || "");
        setAvatarUrl(data.avatar_url || "");
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setIsPublic(data.is_public ?? true);
        setNotifyScoreUpdates(data.notify_score_updates ?? true);
        setNotifyFriendActivity(data.notify_friend_activity ?? true);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL with cache-busting timestamp
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Add cache-busting timestamp to force browser to load new image
      const urlWithTimestamp = `${publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          avatar_url: urlWithTimestamp,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithTimestamp);
      toast.success("Avatar updated successfully!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid username");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: parsed.data,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          is_public: isPublic,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);

      if (error?.code === "23505") {
        toast.error("This username is already taken. Please choose another.");
      } else if (error?.code === "23514") {
        toast.error("Username must be 3–30 chars and use only letters, numbers, _ or -");
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async (checked: boolean) => {
    if (!user) return;
    
    setIsPublic(checked);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_public: checked,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(checked ? "Profile is now public" : "Profile is now private");
    } catch (error) {
      console.error("Error updating privacy:", error);
      setIsPublic(!checked); // Revert on error
      toast.error("Failed to update privacy setting");
    }
  };

  const handleToggleScoreNotifications = async (checked: boolean) => {
    if (!user) return;
    
    setNotifyScoreUpdates(checked);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          notify_score_updates: checked,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(checked ? "Score notifications enabled" : "Score notifications disabled");
    } catch (error) {
      console.error("Error updating notification setting:", error);
      setNotifyScoreUpdates(!checked);
      toast.error("Failed to update notification setting");
    }
  };

  const handleToggleFriendNotifications = async (checked: boolean) => {
    if (!user) return;
    
    setNotifyFriendActivity(checked);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          notify_friend_activity: checked,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success(checked ? "Friend notifications enabled" : "Friend notifications disabled");
    } catch (error) {
      console.error("Error updating notification setting:", error);
      setNotifyFriendActivity(!checked);
      toast.error("Failed to update notification setting");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in again to delete your account");
        return;
      }

      const response = await supabase.functions.invoke("delete-user", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to delete account");
      }

      // Sign out and redirect
      await signOut();
      toast.success("Your account has been deleted");
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error(error.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  if (loading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <PageLayout>
      <Navbar />
      <div className="pt-24 pb-24 px-4">
        <div className="container mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
              <SettingsIcon className="text-primary" />
              {t("settings.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("settings.managePreferences")}
            </p>
          </motion.div>

          {/* Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl border border-border p-6 mb-6"
          >
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <User size={18} className="text-primary" />
              {t("settings.profile")}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-foreground">{t("settings.firstName")}</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-foreground">{t("settings.lastName")}</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    maxLength={50}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground">{t("settings.username")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.usernameVisible")}</p>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{t("settings.avatar")}</Label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🎯</span>
                    )}
                  </div>
                  <div className="flex-1">
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
                      {uploading ? t("onboarding.uploading") : t("onboarding.uploadPhoto")}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">{t("settings.maxFileSize")}</p>
                  </div>
                </div>
              </div>
              <Button variant="gradient" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {t("settings.saveProfile")}
              </Button>
            </div>
          </motion.div>

          {/* Notifications Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card rounded-2xl border border-border p-6 mb-6"
          >
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Bell size={18} className="text-secondary" />
              {t("settings.notifications")}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="score-notifications" className="text-foreground">{t("settings.scoreUpdates")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.scoreUpdatesDesc")}</p>
                </div>
                <Switch 
                  id="score-notifications" 
                  checked={notifyScoreUpdates}
                  onCheckedChange={handleToggleScoreNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="friend-notifications" className="text-foreground">{t("settings.friendActivity")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.friendActivityDesc")}</p>
                </div>
                <Switch 
                  id="friend-notifications" 
                  checked={notifyFriendActivity}
                  onCheckedChange={handleToggleFriendNotifications}
                />
              </div>
            </div>
          </motion.div>

          {/* Privacy Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card rounded-2xl border border-border p-6 mb-6"
          >
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Shield size={18} className="text-primary" />
              {t("settings.privacy")}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="public-profile" className="text-foreground">{t("settings.publicProfile")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.publicProfileDesc")}</p>
                </div>
                <Switch 
                  id="public-profile" 
                  checked={isPublic}
                  onCheckedChange={handleTogglePublic}
                />
              </div>
            </div>
          </motion.div>

          {/* Preferences Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl border border-border p-6 mb-6"
          >
            <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Globe size={18} className="text-primary" />
              {t("settings.preferences")}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">{t("settings.language")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.languageDesc")}</p>
                </div>
                <Select
                  value={language}
                  onValueChange={(value: "en" | "nl") => setLanguage(value)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t("onboarding.english")}</SelectItem>
                    <SelectItem value="nl">{t("onboarding.dutch")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">{t("settings.units")}</Label>
                  <p className="text-sm text-muted-foreground">{t("settings.unitsDesc")}</p>
                </div>
                <Select
                  value={useMetric ? "metric" : "imperial"}
                  onValueChange={(value) => setUseMetric(value === "metric")}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">{t("settings.metric")}</SelectItem>
                    <SelectItem value="imperial">{t("settings.imperial")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>

          {/* Change Password Section - only for email/password users */}
          {isEmailProvider && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-card rounded-2xl border border-border p-6 mb-6"
            >
              <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Lock size={18} className="text-primary" />
                {t("settings.changePassword")}
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-foreground">{t("settings.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">{t("settings.confirmPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-10"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <Button
                  variant="gradient"
                  onClick={async () => {
                    if (newPassword.length < 6) {
                      toast.error(t("settings.passwordMinLength"));
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      toast.error(t("settings.passwordsDontMatch"));
                      return;
                    }
                    setChangingPassword(true);
                    try {
                      const { error } = await supabase.auth.updateUser({ password: newPassword });
                      if (error) throw error;
                      toast.success(t("settings.passwordChanged"));
                      setNewPassword("");
                      setConfirmPassword("");
                    } catch (error: any) {
                      toast.error(error.message || t("settings.passwordChangeFailed"));
                    } finally {
                      setChangingPassword(false);
                    }
                  }}
                  disabled={changingPassword || !newPassword || !confirmPassword}
                >
                  {changingPassword ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  {t("settings.updatePassword")}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Danger Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card rounded-2xl border border-destructive/30 p-6"
          >
            <h2 className="font-semibold text-destructive flex items-center gap-2 mb-4">
              <Trash2 size={18} />
              {t("settings.dangerZone")}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {t("settings.deleteWarning")}
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting}>
                  {deleting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  {t("settings.deleteAccount")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("settings.deleteConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("settings.deleteConfirmDesc")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("settings.yesDelete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </motion.div>
        </div>
      </div>
      <div className="h-20 md:h-0" />
    </PageLayout>
  );
};

export default Settings;
