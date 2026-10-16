import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { lead, interactions } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured. Set OPENAI_API_KEY." }),
        { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build context from lead + interactions
    const leadContext = [
      `Name: ${lead.name || "N/A"}`,
      `Company: ${lead.company || "N/A"}`,
      `Industry: ${lead.industry || "N/A"}`,
      `Title: ${lead.title || "N/A"}`,
      `Status: ${lead.status || "new"}`,
      lead.company_size ? `Company Size: ${lead.company_size} employees` : "",
    ].filter(Boolean).join("\n");

    const interactionSummary = (interactions || []).slice(0, 10).map((i: any) => {
      return `- ${i.type} (${i.direction})${i.subject ? `: ${i.subject}` : ""}${i.summary ? ` — ${i.summary}` : ""}${i.replied ? " [replied]" : ""}${i.meeting_booked ? " [meeting booked]" : ""}`;
    }).join("\n");

    const prompt = `You are a sales assistant writing a personalized follow-up email.

Lead information:
${leadContext}

Recent interactions:
${interactionSummary || "No prior interactions."}

Write a concise, professional follow-up email. Include a subject line. Reference relevant context from the interactions if available. Keep it friendly but not pushy. End with a clear call to action (e.g., scheduling a brief call).

Format:
Subject: <subject line>

<email body>`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful sales assistant that writes personalized follow-up emails." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", errText);
      return new Response(
        JSON.stringify({ error: "AI generation failed. Please try again." }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const openaiData = await openaiResponse.json();
    const email = openaiData.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to generate email. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
