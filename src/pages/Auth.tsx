import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowLeft, Loader2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createNotification, NotificationTypes } from "@/hooks/useNotifications";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const { toast } = useToast();
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast({
          title: "Welcome back!",
          description: "You've successfully signed in.",
        });
        navigate("/");
      } else {
        if (!username.trim()) {
          toast({
            title: "Username required",
            description: "Please enter a username.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        const { error, data } = await signUp(email, password, username);
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
          title: "Account created!",
          description: "Welcome to Multiball!",
        });
        navigate("/");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
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
            <h1 className="text-2xl font-bold text-foreground mb-2">{isLogin ? "Welcome back" : "Create account"}</h1>
            <p className="text-muted-foreground text-sm">
              {isLogin ? "Sign in to track your scores" : "Start tracking your achievements"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Label htmlFor="username" className="text-foreground">
                  Username
                </Label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="yourname"
                    className="pl-10"
                    required={!isLogin}
                  />
                </div>
              </motion.div>
            )}

            <div>
              <Label htmlFor="email" className="text-foreground">
                Email
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
                Password
              </Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" variant="gradient" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <span className="text-primary font-medium">{isLogin ? "Sign Up" : "Sign In"}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
