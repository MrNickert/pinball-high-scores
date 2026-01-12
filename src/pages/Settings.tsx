import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Bell, Shield, Trash2, User, Loader2, Upload } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be 30 characters or less")
  .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, numbers, underscore, or dash");

const Settings = () => {
  const { user, loading } = useAuth();
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

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
    <div className="min-h-screen bg-background">
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
              Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your account preferences
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
              Profile
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-foreground">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-foreground">Last Name</Label>
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
                <Label htmlFor="username" className="text-foreground">Username</Label>
                <p className="text-xs text-muted-foreground">Visible to other players</p>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Avatar</Label>
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
                      {uploading ? "Uploading..." : "Upload Photo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">Max 2MB, JPG/PNG</p>
                  </div>
                </div>
              </div>
              <Button variant="gradient" onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Save Profile
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
              Notifications
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="score-notifications" className="text-foreground">Score Updates</Label>
                  <p className="text-sm text-muted-foreground">Get notified when your scores are verified</p>
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
                  <Label htmlFor="friend-notifications" className="text-foreground">Friend Activity</Label>
                  <p className="text-sm text-muted-foreground">Get notified about friend requests</p>
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
              Privacy
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="public-profile" className="text-foreground">Public Profile</Label>
                  <p className="text-sm text-muted-foreground">Allow others to see your profile and scores</p>
                </div>
                <Switch 
                  id="public-profile" 
                  checked={isPublic}
                  onCheckedChange={handleTogglePublic}
                />
              </div>
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card rounded-2xl border border-destructive/30 p-6"
          >
            <h2 className="font-semibold text-destructive flex items-center gap-2 mb-4">
              <Trash2 size={18} />
              Danger Zone
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          </motion.div>
        </div>
      </div>
      <div className="h-20 md:h-0" />
    </div>
  );
};

export default Settings;
