import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, User, Camera, Home, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { path: "/capture", label: "Capture", icon: Camera },
  { path: "/profile", label: "Profile", icon: User },
];

export const Navbar = () => {
  const location = useLocation();

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <motion.div 
              className="text-primary text-2xl"
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              🎯
            </motion.div>
            <span className="font-arcade text-xs text-primary neon-text hidden sm:block">
              PINBALL
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive 
                        ? "bg-primary/20 text-primary neon-border" 
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <item.icon size={18} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </div>

          <Link to="/auth">
            <Button variant="neon" size="sm">
              <LogIn size={16} />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-card border-t border-border">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={`flex flex-col items-center p-2 rounded-lg ${
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon size={20} />
                  <span className="text-[10px] mt-1">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
};
