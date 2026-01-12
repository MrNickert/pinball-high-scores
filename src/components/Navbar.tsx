import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, User, Camera, Home, LogIn, LogOut, Eye, Users, Settings, ChevronDown } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Nav items for non-authenticated users
  const publicNavItems = [
    { path: "/", label: t("navbar.home"), icon: Home },
    { path: "/capture", label: t("navbar.capture"), icon: Camera },
    { path: "/leaderboard", label: t("navbar.leaderboard"), icon: Trophy },
  ];

  // Nav items for authenticated users
  const authNavItems = [
    { path: "/", label: t("navbar.home"), icon: Home },
    { path: "/capture", label: t("navbar.capture"), icon: Camera },
    { path: "/verify", label: t("navbar.verify"), icon: Eye },
    { path: "/leaderboard", label: t("navbar.leaderboard"), icon: Trophy },
  ];

  const navItems = user ? authNavItems : publicNavItems;

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Ignore "session not found" errors - user is already signed out
        if (error.message?.includes("session") || error.message?.includes("Session")) {
          toast.success(t("auth.signOut"));
          navigate("/");
          return;
        }
        toast.error(t("errors.somethingWrong"));
      } else {
        toast.success(t("auth.signOut"));
        navigate("/");
      }
    } catch (err) {
      // Handle any unexpected errors gracefully
      toast.success(t("auth.signOut"));
      navigate("/");
    }
  };

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!user) return;

      try {
        // Get all pending scores (not the user's own)
        const { data: pendingScores } = await supabase
          .from("scores")
          .select("id")
          .eq("validation_status", "pending")
          .neq("user_id", user.id);

        if (!pendingScores || pendingScores.length === 0) {
          setPendingCount(0);
          return;
        }

        // Get scores the user has already voted on
        const scoreIds = pendingScores.map((s) => s.id);
        const { data: userVotes } = await supabase
          .from("score_votes")
          .select("score_id")
          .eq("user_id", user.id)
          .in("score_id", scoreIds);

        // Count scores user hasn't voted on yet
        const votedScoreIds = new Set(userVotes?.map((v) => v.score_id) || []);
        const reviewableCount = pendingScores.filter((s) => !votedScoreIds.has(s.id)).length;

        setPendingCount(reviewableCount);
      } catch (error) {
        console.error("Error fetching pending count:", error);
      }
    };

    const fetchUserProfile = async () => {
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setUsername(data.username);
        setAvatarUrl(data.avatar_url);
      }
    };

    fetchPendingCount();
    fetchUserProfile();

    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Multiball" className="h-16 w-auto py-1" />
            <span className="font-bold text-lg text-foreground">Multiball</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const showBadge = item.path === "/verify" && pendingCount > 0;
              return (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-foreground text-background text-[10px] font-bold rounded-full px-1">
                        {pendingCount > 99 ? "99+" : pendingCount}
                      </span>
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User size={14} className="text-primary" />
                        )}
                      </div>
                      <span className="hidden sm:inline max-w-[100px] truncate">{username || "Account"}</span>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-background border border-border z-50">
                    <DropdownMenuItem asChild className={location.pathname === "/profile" 
                      ? "bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"}>
                      <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                        <User size={16} />
                        {t("navbar.profile")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={location.pathname === "/friends" 
                      ? "bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"}>
                      <Link to="/friends" className="flex items-center gap-2 cursor-pointer">
                        <Users size={16} />
                        {t("navbar.friends")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className={location.pathname === "/settings" 
                      ? "bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"}>
                      <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                        <Settings size={16} />
                        {t("navbar.settings")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="flex items-center gap-2 cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                    >
                      <LogOut size={16} />
                      {t("auth.signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="gradient" size="sm">
                  <LogIn size={16} />
                  <span className="hidden sm:inline">{t("auth.signIn")}</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
        <div className="flex justify-around items-center py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const showBadge = item.path === "/verify" && pendingCount > 0;
            return (
              <Link key={item.path} to={item.path}>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`relative flex flex-col items-center p-2 rounded-lg ${
                    isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <item.icon size={20} className={isActive ? "text-primary" : ""} />
                  <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                  {showBadge && (
                    <span className="absolute -top-0.5 right-0 min-w-[16px] h-[16px] flex items-center justify-center bg-foreground text-background text-[9px] font-bold rounded-full px-1">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </motion.div>
              </Link>
            );
          })}
          
          {/* Mobile notification bell + user menu */}
          {user ? (
            <>
              <div className="flex flex-col items-center p-2">
                <NotificationBell />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className={`relative flex flex-col items-center p-2 rounded-lg cursor-pointer ${
                      ["/profile", "/friends", "/settings"].some(p => location.pathname.startsWith(p))
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={12} />
                      )}
                    </div>
                    <span className="text-[10px] mt-1 font-medium">Menu</span>
                  </motion.div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="w-48 mb-2 bg-background border border-border z-50">
                  <DropdownMenuItem asChild className={location.pathname === "/profile" 
                    ? "bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"}>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User size={16} />
                      {t("navbar.profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className={location.pathname === "/friends" 
                    ? "bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"}>
                    <Link to="/friends" className="flex items-center gap-2 cursor-pointer">
                      <Users size={16} />
                      {t("navbar.friends")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className={location.pathname === "/settings" 
                    ? "bg-primary text-primary-foreground font-semibold focus:bg-primary focus:text-primary-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted focus:bg-muted focus:text-foreground"}>
                    <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                      <Settings size={16} />
                      {t("navbar.settings")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="flex items-center gap-2 cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                  >
                    <LogOut size={16} />
                    {t("auth.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/auth">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`relative flex flex-col items-center p-2 rounded-lg ${
                  location.pathname === "/auth" ? "text-foreground font-semibold" : "text-muted-foreground"
                }`}
              >
                <LogIn size={20} />
                <span className="text-[10px] mt-1 font-medium">{t("auth.signIn")}</span>
              </motion.div>
            </Link>
          )}
        </div>
      </div>
    </motion.nav>
  );
};