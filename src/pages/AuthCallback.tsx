import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"processing" | "success" | "pwa-handoff" | "error">("processing");
  const [handoffCode, setHandoffCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Check if this is running in a standalone PWA
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;

      if (isStandalone) {
        // We're in the PWA - session should already be set by Supabase
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/");
        } else {
          // Show the code entry UI
          navigate("/auth?showCodeEntry=true");
        }
        return;
      }

      // We're in Safari - the magic link was clicked here
      try {
        // Let Supabase handle the URL parsing and session creation
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          throw error;
        }
        
        if (!session) {
          // Try to exchange tokens from URL hash/params
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token");
          
          if (accessToken && refreshToken) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setSessionError) throw setSessionError;
          } else {
            throw new Error("No session found");
          }
        }

        // Get the session again after potentially setting it
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          // Generate a short-lived handoff code
          const code = generateHandoffCode();
          
          // Store the code and tokens in the database via edge function
          const response = await supabase.functions.invoke("store-handoff-code", {
            body: {
              code,
              accessToken: currentSession.access_token,
              refreshToken: currentSession.refresh_token,
            },
          });
          
          if (response.error) {
            console.error("Failed to store handoff code:", response.error);
            // Fallback: still show the code, it might work via localStorage in same browser
          }
          
          // Also store in localStorage as fallback (same browser scenario)
          const handoffData = {
            accessToken: currentSession.access_token,
            refreshToken: currentSession.refresh_token,
            expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
          };
          localStorage.setItem(`pwa_handoff_${code}`, JSON.stringify(handoffData));
          
          setHandoffCode(code);
          setStatus("pwa-handoff");
        } else {
          throw new Error("Failed to establish session");
        }
      } catch (error: any) {
        console.error("Auth callback error:", error);
        setStatus("error");
        toast({
          title: "Authentication failed",
          description: error.message || "Failed to complete sign in",
          variant: "destructive",
        });
      }
    };

    handleCallback();
  }, [searchParams, navigate, toast]);

  const generateHandoffCode = () => {
    // Generate a 6-character alphanumeric code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding ambiguous chars
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const copyCode = async () => {
    if (handoffCode) {
      await navigator.clipboard.writeText(handoffCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (status === "processing") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    );
  }

  if (status === "pwa-handoff") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-8 shadow-lg border border-border max-w-md w-full text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Sign in successful!
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Copy this code and paste it in the Multiball app to complete sign in.
          </p>

          <div className="bg-muted rounded-lg p-4 mb-6">
            <div className="font-mono text-3xl tracking-[0.3em] text-foreground font-bold">
              {handoffCode}
            </div>
          </div>

          <Button 
            onClick={copyCode} 
            variant="gradient" 
            className="w-full mb-4"
            size="lg"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5 mr-2" />
                Copy Code
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground">
            This code expires in 5 minutes. Now return to the Multiball app and enter this code.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-8 shadow-lg border border-border max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Something went wrong
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            We couldn't complete your sign in. Please try again.
          </p>
          <Button onClick={() => navigate("/auth")} variant="gradient" className="w-full">
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;
