import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = (claimsData.claims.sub as string | undefined) ?? "";
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    if (!userId || !isUuid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit BEFORE expensive AI work
    const { data: allowed, error: rlError } = await supabaseClient.rpc("check_rate_limit", {
      p_user_id: userId,
      p_action: "ai_extract",
      p_max_count: 20,
      p_window_minutes: 60,
    });

    if (rlError) {
      console.error("Rate limit check failed:", rlError);
      throw new Error("Rate limit check failed");
    }

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { imageBase64, validateMachine, validateScore } = body;

    if (typeof imageBase64 !== "string" || imageBase64.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only accept data URLs for images; reject overly large payloads
    if (!imageBase64.startsWith("data:image/")) {
      return new Response(
        JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (imageBase64.length > 8_000_000) {
      return new Response(
        JSON.stringify({ error: "Image too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (validateMachine !== undefined && typeof validateMachine !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid validateMachine" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (validateMachine && validateMachine.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid validateMachine" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (validateScore !== undefined && (typeof validateScore !== "number" || !Number.isFinite(validateScore))) {
      return new Response(
        JSON.stringify({ error: "Invalid validateScore" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // If validation is requested, use a different prompt
    const isValidation = validateMachine && validateScore !== undefined;
    
    const prompt = isValidation
      ? `Analyze this pinball machine backglass/display photo and validate the following:

1. MACHINE NAME: Does this image show the pinball machine "${validateMachine}"? Look for:
   - The machine's name/title on the backglass
   - Recognizable artwork, characters, or themes associated with this machine
   - Any text or branding that identifies the machine

2. SCORE: Is the score ${validateScore.toLocaleString()} visible in this image? Look for:
   - Player score displays (usually numbered 1, 2, 3, 4)
   - High score displays
   - Any numeric displays showing this exact score

Return ONLY a JSON object with:
{
  "machineMatch": boolean (true if the machine name matches or is clearly this machine),
  "scoreMatch": boolean (true if the exact score ${validateScore.toLocaleString()} is visible),
  "detectedMachine": string (the machine name you can see, or null if unclear),
  "detectedScores": array of numbers (all scores visible in the image),
  "confidence": {
    "machine": "high" | "medium" | "low" | "none",
    "score": "high" | "medium" | "low" | "none"
  }
}

IMPORTANT: Return ONLY the JSON object, no other text.`
      : `Analyze this pinball machine backglass photo and extract ALL visible scores. 
                
Look for:
- Player scores (usually numbered 1, 2, 3, 4 on the left side)
- High score displays
- Any numeric displays that could be scores

Return ONLY a JSON array of objects, each with:
- "player": the player number or label (e.g., "1", "2", "High Score", etc.)
- "score": the numeric score as a number (no commas)
- "formatted": the score formatted with commas for display

Example response:
[
  {"player": "1", "score": 202840, "formatted": "202,840"},
  {"player": "2", "score": 198730, "formatted": "198,730"}
]

If no scores are found, return an empty array: []

IMPORTANT: Return ONLY the JSON array, no other text.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || (isValidation ? "{}" : "[]");

    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent.slice(7);
    }
    if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith("```")) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    if (isValidation) {
      // Parse validation response
      try {
        const validation = JSON.parse(cleanedContent);
        return new Response(
          JSON.stringify({ validation }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (parseError) {
        console.error("Failed to parse validation response:", content);
        return new Response(
          JSON.stringify({ 
            validation: { 
              machineMatch: false, 
              scoreMatch: false, 
              confidence: { machine: "none", score: "none" } 
            } 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Parse score extraction response
      let scores = [];
      try {
        scores = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("Failed to parse AI response:", content);
        scores = [];
      }

      return new Response(
        JSON.stringify({ scores }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in extract-scores:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
