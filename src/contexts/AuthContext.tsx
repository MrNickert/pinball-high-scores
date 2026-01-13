import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // If user just signed in and "remember device" is not checked,
        // store session in sessionStorage instead (expires on browser close)
        if (event === 'SIGNED_IN' && session) {
          const rememberDevice = localStorage.getItem("rememberDevice") === "true";
          if (!rememberDevice) {
            // Mark session as temporary - will be cleared on tab/browser close
            sessionStorage.setItem("tempSession", "true");
          } else {
            sessionStorage.removeItem("tempSession");
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Check if this was a temporary session that should have expired
      const isTempSession = sessionStorage.getItem("tempSession") === "true";
      const isNewBrowserSession = !sessionStorage.getItem("browserSessionActive");
      
      if (isTempSession && isNewBrowserSession && session) {
        // This is a new browser session but we have a "temp" session stored
        // Sign out to clear it
        supabase.auth.signOut();
        sessionStorage.removeItem("tempSession");
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      
      // Mark browser session as active
      sessionStorage.setItem("browserSessionActive", "true");
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
