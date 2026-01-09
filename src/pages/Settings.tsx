import { motion } from "framer-motion";
import { Settings as SettingsIcon, Bell, Shield, Trash2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Navigate } from "react-router-dom";

const Settings = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
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

          {/* Notifications Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
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
                <Switch id="score-notifications" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="friend-notifications" className="text-foreground">Friend Activity</Label>
                  <p className="text-sm text-muted-foreground">Get notified about friend requests</p>
                </div>
                <Switch id="friend-notifications" defaultChecked />
              </div>
            </div>
          </motion.div>

          {/* Privacy Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
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
                <Switch id="public-profile" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="show-activity" className="text-foreground">Show Activity</Label>
                  <p className="text-sm text-muted-foreground">Show your recent scores to friends</p>
                </div>
                <Switch id="show-activity" defaultChecked />
              </div>
            </div>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
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
