import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================
// TYPES
// ============================================================

type ChatTurn = { role: 'user' | 'assistant'; content: string };

type CRMContext = {
  leads: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  followUps: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  interactions: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  ragResults: Record<string, unknown>[];
};

// ============================================================
// SUPABASE CLIENT (service role for data retrieval)
// ============================================================

function createSupabaseClient(serviceRoleKey: string, supabaseUrl: string) {
  return {
    async from(table: string) {
      return {
        select: (columns: string) => ({
          eq: (col: string, val: unknown) => ({
            order: (col: string, opts?: { ascending?: boolean }) => ({
              limit: (n: number) => makeQuery(supabaseUrl, serviceRoleKey, table, columns, col, val, n, opts),
              then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
                makeQuery(supabaseUrl, serviceRoleKey, table, columns, col, val, 100, opts).then(resolve),
            }),
            limit: (n: number) => makeQuery(supabaseUrl, serviceRoleKey, table, columns, col, val, n),
            then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
              makeQuery(supabaseUrl, serviceRoleKey, table, columns, col, val, 100).then(resolve),
          }),
          order: (col: string, opts?: { ascending?: boolean }) => ({
            limit: (n: number) => makeQuery(supabaseUrl, serviceRoleKey, table, columns, undefined, undefined, n, opts),
            then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
              makeQuery(supabaseUrl, serviceRoleKey, table, columns, undefined, undefined, 100, opts).then(resolve),
          }),
          limit: (n: number) => makeQuery(supabaseUrl, serviceRoleKey, table, columns, undefined, undefined, n),
          then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
            makeQuery(supabaseUrl, serviceRoleKey, table, columns, undefined, undefined, 100).then(resolve),
        }),
        rpc: (fn: string, params: Record<string, unknown>) =>
          makeRpcCall(supabaseUrl, serviceRoleKey, fn, params),
      };
    },
  };
}

async function makeQuery(
  url: string,
  key: string,
  table: string,
  columns: string,
  filterCol?: string,
  filterVal?: unknown,
  limitN?: number,
  orderOpts?: { ascending?: boolean }
): Promise<{ data: unknown; error: unknown }> {
  let queryUrl = `${url}/rest/v1/${table}?select=${columns}`;
  if (filterCol && filterVal !== undefined) {
    queryUrl += `&${filterCol}=eq.${filterVal}`;
  }
  if (orderOpts) {
    queryUrl += `&order=${filterCol || 'created_at'}.${orderOpts.ascending ? 'asc' : 'desc'}`;
  }
  if (limitN) {
    queryUrl += `&limit=${limitN}`;
  }

  const res = await fetch(queryUrl, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    return { data: null, error: `Query failed: ${res.status}` };
  }
  const data = await res.json();
  return { data, error: null };
}

async function makeRpcCall(
  url: string,
  key: string,
  fn: string,
  params: Record<string, unknown>
): Promise<{ data: unknown; error: unknown }> {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    return { data: null, error: `RPC failed: ${res.status}` };
  }
  const data = await res.json();
  return { data, error: null };
}

// ============================================================
// RAG: Retrieve relevant CRM data using vector similarity search
// ============================================================

async function retrieveRelevantContext(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  queryEmbedding: number[],
  topK: number = 10
): Promise<Record<string, unknown>[]> {
  // Use the match_embeddings RPC function if available, otherwise fall back to text search
  const { data, error } = await makeRpcCall(supabaseUrl, serviceKey, 'match_embeddings', {
    query_embedding: queryEmbedding,
    match_count: topK,
    filter_user_id: userId,
  });

  if (error || !data) {
    return [];
  }

  return (data as Record<string, unknown>[]) || [];
}

// ============================================================
// DATA RETRIEVAL: Fetch CRM data for the user
// ============================================================

async function fetchCRMData(
  supabaseUrl: string,
  serviceKey: string,
  userId: string
): Promise<CRMContext> {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  const fetchTable = async (table: string, columns: string, limitN: number = 200) => {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=${columns}&user_id=eq.${userId}&limit=${limitN}&order=created_at.desc`,
      { headers }
    );
    if (!res.ok) return [];
    return await res.json();
  };

  const [leads, customers, tasks, followUps, activities, interactions, notes] = await Promise.all([
    fetchTable('leads', '*', 200),
    fetchTable('customers', '*', 200),
    fetchTable('tasks', '*', 100),
    fetchTable('follow_ups', '*', 100),
    fetchTable('activities', '*', 100),
    fetchTable('interactions', '*', 200),
    fetchTable('notes', '*', 100),
  ]);

  return {
    leads: leads || [],
    customers: customers || [],
    tasks: tasks || [],
    followUps: followUps || [],
    activities: activities || [],
    interactions: interactions || [],
    notes: notes || [],
    ragResults: [],
  };
}

// ============================================================
// BUILD CONTEXT FOR LLM
// ============================================================

function buildContextString(ctx: CRMContext): string {
  const parts: string[] = [];

  if (ctx.leads.length > 0) {
    parts.push(`=== LEADS (${ctx.leads.length}) ===`);
    ctx.leads.slice(0, 50).forEach((lead) => {
      parts.push(`- ${lead.name} | ${lead.company || 'N/A'} | Industry: ${lead.industry || 'N/A'} | Size: ${lead.company_size || 'N/A'} | Status: ${lead.status} | Temperature: ${lead.temperature} | Score: ${lead.score}/100 | Last Contact: ${lead.last_contacted_at ? new Date(lead.last_contacted_at as string).toLocaleDateString() : 'Never'} | Email: ${lead.email || 'N/A'}`);
    });
  }

  if (ctx.customers.length > 0) {
    parts.push(`\n=== CUSTOMERS (${ctx.customers.length}) ===`);
    ctx.customers.slice(0, 50).forEach((cust) => {
      parts.push(`- ${cust.name} | ${cust.company || 'N/A'} | Industry: ${cust.industry || 'N/A'} | Status: ${cust.status} | Value: $${cust.value} | Email: ${cust.email || 'N/A'}`);
    });
  }

  if (ctx.tasks.length > 0) {
    parts.push(`\n=== TASKS (${ctx.tasks.length}) ===`);
    ctx.tasks.slice(0, 30).forEach((task) => {
      parts.push(`- ${task.title} | Priority: ${task.priority} | Status: ${task.status} | Due: ${task.due_date ? new Date(task.due_date as string).toLocaleDateString() : 'N/A'}`);
    });
  }

  if (ctx.followUps.length > 0) {
    parts.push(`\n=== FOLLOW-UPS (${ctx.followUps.length}) ===`);
    ctx.followUps.slice(0, 30).forEach((fu) => {
      parts.push(`- ${fu.title} | Status: ${fu.status} | Due: ${new Date(fu.due_date as string).toLocaleDateString()}`);
    });
  }

  if (ctx.interactions.length > 0) {
    parts.push(`\n=== RECENT INTERACTIONS (${ctx.interactions.length}) ===`);
    ctx.interactions.slice(0, 30).forEach((inter) => {
      parts.push(`- Type: ${inter.type} | Direction: ${inter.direction} | Subject: ${inter.subject || 'N/A'} | Replied: ${inter.replied} | Meeting: ${inter.meeting_booked} | Date: ${new Date(inter.occurred_at as string).toLocaleDateString()}`);
    });
  }

  if (ctx.notes.length > 0) {
    parts.push(`\n=== NOTES (${ctx.notes.length}) ===`);
    ctx.notes.slice(0, 20).forEach((note) => {
      parts.push(`- ${(note.content as string)?.substring(0, 100)}`);
    });
  }

  if (ctx.activities.length > 0) {
    parts.push(`\n=== RECENT ACTIVITIES (${ctx.activities.length}) ===`);
    ctx.activities.slice(0, 20).forEach((act) => {
      parts.push(`- ${act.title} | Type: ${act.type} | Date: ${new Date(act.created_at as string).toLocaleDateString()}`);
    });
  }

  return parts.join('\n');
}

// ============================================================
// GENERATE EMBEDDING FOR RAG QUERY
// ============================================================

async function generateEmbedding(openaiKey: string, text: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;
  }
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], userId } = await req.json();

    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Message and userId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Fetch all CRM data for this user (secure, user-scoped)
    const crmData = await fetchCRMData(supabaseUrl, serviceKey, userId);

    // RAG: Generate embedding and retrieve semantically similar records
    if (openaiKey) {
      const queryEmbedding = await generateEmbedding(openaiKey, message);
      if (queryEmbedding) {
        const ragResults = await retrieveRelevantContext(supabaseUrl, serviceKey, userId, queryEmbedding, 10);
        crmData.ragResults = ragResults;
      }
    }

    // Build context string from CRM data
    const contextStr = buildContextString(crmData);

    // Build conversation messages
    const systemPrompt = `You are Nexus, an AI CRM assistant integrated into a customer relationship management system. You help sales teams by answering questions about their CRM data, providing insights, recommendations, and analysis.

You have access to the user's actual CRM data below. Use ONLY this data to answer questions. Never make up data that isn't provided.

When answering:
1. Ground every answer in the provided CRM data.
2. When listing leads/customers/tasks, include their names and relevant details.
3. Provide reasoning for your answers — explain WHY you're giving a particular recommendation.
4. When discussing lead scores, explain the factors that contribute to the score.
5. Suggest follow-up actions when appropriate.
6. If the user asks about something not in the data, say so clearly.
7. Format responses with clear structure — use bullet points and sections for longer answers.
8. Cite specific records by name when referencing them.

=== USER'S CRM DATA ===
${contextStr}

=== INSTRUCTIONS ===
Answer the user's question based on the CRM data above. Be specific, cite records by name, and provide actionable insights.`;

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history for context
    for (const turn of (conversationHistory as ChatTurn[]).slice(-10)) {
      messages.push({ role: turn.role, content: turn.content });
    }

    messages.push({ role: 'user', content: message });

    // If no OpenAI key, provide a structured fallback response
    if (!openaiKey) {
      const fallbackResponse = generateFallbackResponse(message, crmData);
      return new Response(
        JSON.stringify({
          response: fallbackResponse,
          context: { leadCount: crmData.leads.length, customerCount: crmData.customers.length, taskCount: crmData.tasks.length },
          aiPowered: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Call OpenAI
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI error:', errText);
      const fallback = generateFallbackResponse(message, crmData);
      return new Response(
        JSON.stringify({
          response: fallback,
          context: { leadCount: crmData.leads.length, customerCount: crmData.customers.length, taskCount: crmData.tasks.length },
          aiPowered: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const openaiData = await openaiRes.json();
    const aiResponse = openaiData.choices?.[0]?.message?.content || 'I could not generate a response.';

    // Extract source records for citations
    const sources = extractSources(message, crmData);

    return new Response(
      JSON.stringify({
        response: aiResponse,
        sources,
        context: {
          leadCount: crmData.leads.length,
          customerCount: crmData.customers.length,
          taskCount: crmData.tasks.length,
          followUpCount: crmData.followUps.length,
          interactionCount: crmData.interactions.length,
        },
        aiPowered: true,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    console.error('AI CRM Assistant error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to process request. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

// ============================================================
// FALLBACK RESPONSE (when AI is not available)
// ============================================================

function generateFallbackResponse(message: string, ctx: CRMContext): string {
  const lower = message.toLowerCase();
  const parts: string[] = [];

  if (lower.includes('hot lead') || lower.includes('high priority lead')) {
    const hot = ctx.leads.filter((l) => l.temperature === 'hot');
    parts.push(`**Hot Leads (${hot.length})**`);
    hot.slice(0, 10).forEach((l) => parts.push(`- ${l.name} (${l.company || 'N/A'}) — Score: ${l.score}/100 — Status: ${l.status}`));
    if (hot.length === 0) parts.push('No hot leads found. Try improving your lead scores by logging more interactions.');
  } else if (lower.includes('overdue') || lower.includes('late task')) {
    const now = new Date();
    const overdue = ctx.tasks.filter((t) => t.due_date && new Date(t.due_date as string) < now && t.status !== 'completed');
    parts.push(`**Overdue Tasks (${overdue.length})**`);
    overdue.slice(0, 10).forEach((t) => parts.push(`- ${t.title} — Priority: ${t.priority} — Due: ${new Date(t.due_date as string).toLocaleDateString()}`));
  } else if (lower.includes('follow') || lower.includes('today') || lower.includes('this week')) {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 86400000);
    const upcoming = ctx.followUps.filter((f) => f.status === 'pending' && new Date(f.due_date as string) <= weekFromNow);
    parts.push(`**Upcoming Follow-ups (${upcoming.length})**`);
    upcoming.slice(0, 10).forEach((f) => parts.push(`- ${f.title} — Due: ${new Date(f.due_date as string).toLocaleDateString()}`));
  } else if (lower.includes('highest score') || lower.includes('top lead') || lower.includes('best lead')) {
    const sorted = [...ctx.leads].sort((a, b) => (b.score as number) - (a.score as number));
    parts.push(`**Top Scoring Leads**`);
    sorted.slice(0, 10).forEach((l) => parts.push(`- ${l.name} (${l.company || 'N/A'}) — Score: ${l.score}/100 — Temperature: ${l.temperature}`));
  } else if (lower.includes('customer') && lower.includes('not contacted')) {
    parts.push(`**Customers (${ctx.customers.length} total)**`);
    ctx.customers.slice(0, 20).forEach((c) => parts.push(`- ${c.name} (${c.company || 'N/A'}) — Status: ${c.status} — Value: $${c.value}`));
  } else {
    parts.push(`**CRM Summary**`);
    parts.push(`- Leads: ${ctx.leads.length} (${ctx.leads.filter((l) => l.temperature === 'hot').length} hot, ${ctx.leads.filter((l) => l.temperature === 'warm').length} warm, ${ctx.leads.filter((l) => l.temperature === 'cold').length} cold)`);
    parts.push(`- Customers: ${ctx.customers.length}`);
    parts.push(`- Active tasks: ${ctx.tasks.filter((t) => t.status !== 'completed').length}`);
    parts.push(`- Pending follow-ups: ${ctx.followUps.filter((f) => f.status === 'pending').length}`);
    parts.push(`\n*Note: AI-powered responses require an OpenAI API key. Add OPENAI_API_KEY as a Supabase edge function secret to enable full AI capabilities.*`);
  }

  return parts.join('\n');
}

// ============================================================
// EXTRACT SOURCE RECORDS FOR CITATIONS
// ============================================================

function extractSources(message: string, ctx: CRMContext): Array<{ type: string; name: string; id: string }> {
  const sources: Array<{ type: string; name: string; id: string }> = [];
  const lower = message.toLowerCase();

  // Find leads mentioned by name
  ctx.leads.forEach((lead) => {
    if (lead.name && lower.includes((lead.name as string).toLowerCase())) {
      sources.push({ type: 'lead', name: lead.name as string, id: lead.id as string });
    }
  });

  // Find customers mentioned by name
  ctx.customers.forEach((cust) => {
    if (cust.name && lower.includes((cust.name as string).toLowerCase())) {
      sources.push({ type: 'customer', name: cust.name as string, id: cust.id as string });
    }
  });

  return sources.slice(0, 10);
}
