import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Shared store - Note: In a real production environment, 
// you'd want to use a database table or Redis for persistence across function invocations
// For now, we'll use the database as the source of truth

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { code } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Code is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the code in the database
    const { data, error } = await supabase
      .from("auth_handoff_codes")
      .select("access_token, refresh_token, expires_at")
      .eq("code", code.toUpperCase())
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      // Delete expired code
      await supabase
        .from("auth_handoff_codes")
        .delete()
        .eq("code", code.toUpperCase());

      return new Response(
        JSON.stringify({ error: "Code has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete the code after use (one-time use)
    await supabase
      .from("auth_handoff_codes")
      .delete()
      .eq("code", code.toUpperCase());

    return new Response(
      JSON.stringify({ 
        accessToken: data.access_token, 
        refreshToken: data.refresh_token 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error verifying handoff code:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
