import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, User, Camera, Home, LogIn, LogOut, Circle, Eye, Users, Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Nav items for non-authenticated users
const publicNavItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { path: "/capture", label: "Capture", icon: Camera },
];

// Nav items for authenticated users
const authNavItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { path: "/capture", label: "Capture", icon: Camera },
  { path: "/verify", label: "Verify", icon: Eye },
  { path: "/friends", label: "Friends", icon: Users },
];

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [username, setUsername] = useState<string | null>(null);

  const navItems = user ? authNavItems : publicNavItems;

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!user) return;
      
      try {
        let query = supabase
          .from("scores")
          .select("id", { count: "exact", head: true })
          .in("validation_status", ["not_validated", "score_only"])
          .neq("user_id", user.id);

        const { count, error } = await query;
        if (!error && count !== null) {
          setPendingCount(count);
        }
      } catch (error) {
        console.error("Error fetching pending count:", error);
      }
    };

    const fetchUsername = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data) {
        setUsername(data.username);
      }
    };

    fetchPendingCount();
    fetchUsername();

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
          <Link to="/" className="flex items-center gap-2.5">
            <div className="relative">
              <Circle className="w-8 h-8 text-primary fill-primary/20" strokeWidth={2.5} />
              <Circle className="w-3 h-3 text-primary fill-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" strokeWidth={0} />
            </div>
            <span className="font-bold text-lg text-foreground">
              Multiball
            </span>
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
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1">
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
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <User size={14} className="text-primary" />
                      </div>
                      <span className="hidden sm:inline max-w-[100px] truncate">
                        {username || "Account"}
                      </span>
                      <ChevronDown size={14} className="text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                        <User size={16} />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
                        <Settings size={16} />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleSignOut}
                      className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link to="/auth">
                <Button variant="gradient" size="sm">
                  <LogIn size={16} />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const showBadge = item.path === "/verify" && pendingCount > 0;
            return (
              <Link key={item.path} to={item.path}>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`relative flex flex-col items-center p-2 rounded-lg ${
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon size={20} />
                  <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                  {showBadge && (
                    <span className="absolute -top-0.5 right-0 min-w-[16px] h-[16px] flex items-center justify-center bg-primary text-primary-foreground text-[9px] font-bold rounded-full px-1">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </span>
                  )}
                </motion.div>
              </Link>
            );
          })}
          {/* Mobile user menu icon */}
          {user && (
            <Link to="/profile">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`relative flex flex-col items-center p-2 rounded-lg ${
                  location.pathname === "/profile" 
                    ? "text-primary" 
                    : "text-muted-foreground"
                }`}
              >
                <User size={20} />
                <span className="text-[10px] mt-1 font-medium">Profile</span>
              </motion.div>
            </Link>
          )}
        </div>
      </div>
    </motion.nav>
  );
};
