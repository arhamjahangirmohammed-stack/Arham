import { supabase } from '@/lib/supabase/client';

export type QueryResult = {
  sql_description: string;
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  count: number;
  summary: string;
};

type ParsedQuery = {
  intent: string;
  table: 'leads' | 'customers' | 'follow_ups' | 'interactions';
  filters: { column: string; operator: string; value: unknown }[];
  orderBy?: { column: string; ascending: boolean };
  limit?: number;
  summary: string;
  description: string;
};

export function parseQuery(input: string): ParsedQuery {
  const lower = input.toLowerCase().trim();

  // Default
  const query: ParsedQuery = {
    intent: 'unknown',
    table: 'leads',
    filters: [],
    summary: '',
    description: '',
  };

  // Detect "hot leads"
  if (lower.includes('hot lead') || lower.includes('hot lead')) {
    query.intent = 'hot_leads';
    query.table = 'leads';
    query.filters.push({ column: 'temperature', operator: 'eq', value: 'hot' });
    query.orderBy = { column: 'score', ascending: false };
    query.summary = 'Here are all your hot leads, ranked by score.';
    query.description = "SELECT * FROM leads WHERE temperature = 'hot' ORDER BY score DESC";
    return query;
  }

  // Detect "cold leads"
  if (lower.includes('cold lead')) {
    query.intent = 'cold_leads';
    query.table = 'leads';
    query.filters.push({ column: 'temperature', operator: 'eq', value: 'cold' });
    query.summary = 'Here are all your cold leads that may need warming up.';
    query.description = "SELECT * FROM leads WHERE temperature = 'cold'";
    return query;
  }

  // Detect "warm leads"
  if (lower.includes('warm lead')) {
    query.intent = 'warm_leads';
    query.table = 'leads';
    query.filters.push({ column: 'temperature', operator: 'eq', value: 'warm' });
    query.summary = 'Here are all your warm leads.';
    query.description = "SELECT * FROM leads WHERE temperature = 'warm'";
    return query;
  }

  // Detect "haven't been contacted this week" / "not contacted"
  if (
    (lower.includes("haven't been contacted") || lower.includes('not contacted') || lower.includes("haven't contacted")) &&
    (lower.includes('week') || lower.includes('recently') || lower.includes('lately'))
  ) {
    query.intent = 'not_contacted_this_week';
    query.table = 'leads';
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    query.filters.push({
      column: 'last_contacted_at',
      operator: 'lt',
      value: oneWeekAgo.toISOString(),
    });
    query.filters.push({
      column: 'status',
      operator: 'not.in',
      value: ['won', 'lost'],
    });
    query.summary = 'These leads haven\'t been contacted in the past week and are still active.';
    query.description =
      "SELECT * FROM leads WHERE last_contacted_at < NOW() - INTERVAL '7 days' AND status NOT IN ('won', 'lost')";
    return query;
  }

  // Detect "never contacted"
  if (lower.includes('never contacted') || lower.includes('no contact')) {
    query.intent = 'never_contacted';
    query.table = 'leads';
    query.filters.push({ column: 'last_contacted_at', operator: 'is', value: null });
    query.summary = 'These leads have never been contacted.';
    query.description = 'SELECT * FROM leads WHERE last_contacted_at IS NULL';
    return query;
  }

  // Detect "high score" / "top leads" / "best leads"
  if (lower.includes('high score') || lower.includes('top lead') || lower.includes('best lead') || lower.includes('top scoring')) {
    query.intent = 'top_leads';
    query.table = 'leads';
    query.filters.push({ column: 'score', operator: 'gte', value: 70 });
    query.orderBy = { column: 'score', ascending: false };
    query.summary = 'Here are your top-scoring leads (score 70+).';
    query.description = 'SELECT * FROM leads WHERE score >= 70 ORDER BY score DESC';
    return query;
  }

  // Detect "won" leads
  if (lower.includes('won') && (lower.includes('lead') || lower.includes('deal'))) {
    query.intent = 'won_leads';
    query.table = 'leads';
    query.filters.push({ column: 'status', operator: 'eq', value: 'won' });
    query.summary = 'Here are all your won leads/deals.';
    query.description = "SELECT * FROM leads WHERE status = 'won'";
    return query;
  }

  // Detect "lost" leads
  if (lower.includes('lost') && lower.includes('lead')) {
    query.intent = 'lost_leads';
    query.table = 'leads';
    query.filters.push({ column: 'status', operator: 'eq', value: 'lost' });
    query.summary = 'Here are all your lost leads.';
    query.description = "SELECT * FROM leads WHERE status = 'lost'";
    return query;
  }

  // Detect "new leads"
  if (lower.includes('new lead')) {
    query.intent = 'new_leads';
    query.table = 'leads';
    query.filters.push({ column: 'status', operator: 'eq', value: 'new' });
    query.orderBy = { column: 'created_at', ascending: false };
    query.summary = 'Here are your newest leads.';
    query.description = "SELECT * FROM leads WHERE status = 'new' ORDER BY created_at DESC";
    return query;
  }

  // Detect "qualified" leads
  if (lower.includes('qualified')) {
    query.intent = 'qualified_leads';
    query.table = 'leads';
    query.filters.push({ column: 'status', operator: 'eq', value: 'qualified' });
    query.summary = 'Here are your qualified leads.';
    query.description = "SELECT * FROM leads WHERE status = 'qualified'";
    return query;
  }

  // Detect "proposal" leads
  if (lower.includes('proposal')) {
    query.intent = 'proposal_leads';
    query.table = 'leads';
    query.filters.push({ column: 'status', operator: 'eq', value: 'proposal' });
    query.summary = 'Here are leads in the proposal stage.';
    query.description = "SELECT * FROM leads WHERE status = 'proposal'";
    return query;
  }

  // Detect industry queries
  const industryMatch = lower.match(/(?:industry|in)\s+(?:the\s+)?([a-z\s]+?)(?:\s+(?:industry|sector|leads?|companies?))?$/);
  if (industryMatch) {
    const industry = industryMatch[1].trim();
    query.intent = 'industry_leads';
    query.table = 'leads';
    query.filters.push({ column: 'industry', operator: 'ilike', value: `%${industry}%` });
    query.summary = `Here are leads in the ${industry} industry.`;
    query.description = `SELECT * FROM leads WHERE industry ILIKE '%${industry}%'`;
    return query;
  }

  // Detect "follow up" / "follow-ups" / "tasks" / "due"
  if (lower.includes('follow') || lower.includes('task') || lower.includes('due') || lower.includes('todo')) {
    query.intent = 'follow_ups';
    query.table = 'follow_ups';
    query.filters.push({ column: 'status', operator: 'eq', value: 'pending' });
    query.orderBy = { column: 'due_date', ascending: true };
    query.summary = 'Here are your pending follow-ups, sorted by due date.';
    query.description = "SELECT * FROM follow_ups WHERE status = 'pending' ORDER BY due_date ASC";
    return query;
  }

  // Detect "overdue" follow-ups
  if (lower.includes('overdue')) {
    query.intent = 'overdue_follow_ups';
    query.table = 'follow_ups';
    query.filters.push({ column: 'status', operator: 'eq', value: 'pending' });
    const now = new Date().toISOString();
    query.filters.push({ column: 'due_date', operator: 'lt', value: now });
    query.orderBy = { column: 'due_date', ascending: true };
    query.summary = 'These follow-ups are overdue.';
    query.description = "SELECT * FROM follow_ups WHERE status = 'pending' AND due_date < NOW() ORDER BY due_date ASC";
    return query;
  }

  // Detect "customers" / "active customers"
  if (lower.includes('customer') || lower.includes('client')) {
    query.intent = 'customers';
    query.table = 'customers';
    if (lower.includes('active')) {
      query.filters.push({ column: 'status', operator: 'eq', value: 'active' });
      query.summary = 'Here are your active customers.';
      query.description = "SELECT * FROM customers WHERE status = 'active'";
    } else if (lower.includes('churned')) {
      query.filters.push({ column: 'status', operator: 'eq', value: 'churned' });
      query.summary = 'Here are your churned customers.';
      query.description = "SELECT * FROM customers WHERE status = 'churned'";
    } else {
      query.summary = 'Here are all your customers.';
      query.description = 'SELECT * FROM customers';
    }
    return query;
  }

  // Detect "all leads" / "show leads" / "list leads"
  if (lower.includes('all lead') || lower.includes('show lead') || lower.includes('list lead') || lower.includes('every lead')) {
    query.intent = 'all_leads';
    query.table = 'leads';
    query.orderBy = { column: 'created_at', ascending: false };
    query.summary = 'Here are all your leads.';
    query.description = 'SELECT * FROM leads ORDER BY created_at DESC';
    return query;
  }

  // Detect "biggest" / "largest" companies by size
  if (lower.includes('biggest') || lower.includes('largest') || lower.includes('enterprise')) {
    query.intent = 'largest_companies';
    query.table = 'leads';
    query.filters.push({ column: 'company_size', operator: 'gte', value: 500 });
    query.orderBy = { column: 'company_size', ascending: false };
    query.summary = 'Here are your largest leads by company size.';
    query.description = 'SELECT * FROM leads WHERE company_size >= 500 ORDER BY company_size DESC';
    return query;
  }

  // Default: show all leads
  query.intent = 'all_leads';
  query.table = 'leads';
  query.orderBy = { column: 'score', ascending: false };
  query.summary = "I wasn't sure exactly what you meant, so here are all your leads ranked by score. Try asking things like 'show me all hot leads' or 'which leads haven't been contacted this week?'";
  query.description = 'SELECT * FROM leads ORDER BY score DESC';
  return query;
}

export async function executeQuery(parsed: ParsedQuery): Promise<QueryResult> {
  let query = supabase.from(parsed.table).select('*');

  for (const filter of parsed.filters) {
    const { column, operator, value } = filter;
    switch (operator) {
      case 'eq':
        query = query.eq(column, value as string);
        break;
      case 'neq':
        query = query.neq(column, value as string);
        break;
      case 'gte':
        query = query.gte(column, value as number);
        break;
      case 'lte':
        query = query.lte(column, value as number);
        break;
      case 'gt':
        query = query.gt(column, value as number);
        break;
      case 'lt':
        query = query.lt(column, value as string);
        break;
      case 'ilike':
        query = query.ilike(column, value as string);
        break;
      case 'is':
        query = query.is(column, value as null);
        break;
      case 'in':
        query = query.in(column, value as string[]);
        break;
      case 'not.in':
        query = query.not(column, 'in', `(${(value as string[]).map((v) => `'${v}'`).join(',')})`);
        break;
    }
  }

  if (parsed.orderBy) {
    query = query.order(parsed.orderBy.column, { ascending: parsed.orderBy.ascending });
  }

  if (parsed.limit) {
    query = query.limit(parsed.limit);
  }

  const { data, error } = await query;

  if (error) {
    return {
      sql_description: parsed.description,
      table: parsed.table,
      columns: [],
      rows: [],
      count: 0,
      summary: `Error executing query: ${error.message}`,
    };
  }

  const rows = (data || []) as Record<string, unknown>[];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    sql_description: parsed.description,
    table: parsed.table,
    columns,
    rows,
    count: rows.length,
    summary: parsed.summary,
  };
}
