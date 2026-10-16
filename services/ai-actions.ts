/**
 * AI Actions Service
 *
 * Core AI functionality for the CRM.
 * All functions return ServiceResponse and handle errors gracefully.
 */

import {
  Lead,
  Customer,
  Task,
  Interaction,
  Note,
  FollowUp,
  ServiceResponse,
  AICommandResult,
  AIIntent,
  AIInsight,
  DealRisk,
  LeadQualification,
  EmailDraft,
  DailyPriority,
  CustomerHealth,
  CommandHistoryItem,
  TimelineItem,
} from '@/lib/types';
import { getLeadContextString } from './leads';
import { getCustomerHealth } from './customers';

// API endpoint for AI edge function
const AI_ASSISTANT_URL = '/api/ai-crm-assistant';
const AI_EMAIL_URL = '/api/ai-email-writer';

/**
 * Call the AI assistant edge function
 */
async function callAIAssistant(
  message: string,
  context?: Record<string, unknown>
): Promise<ServiceResponse<string>> {
  try {
    const response = await fetch(AI_ASSISTANT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, context }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { data: null, error: errorData.error || 'AI request failed' };
    }

    const data = await response.json();
    return { data: data.response || data.content, error: null };
  } catch (error) {
    return { data: null, error: 'Failed to connect to AI assistant' };
  }
}

/**
 * Parse JSON from AI response with fallback
 */
function parseJSONWithFallback<T>(text: string, fallback: T): T {
  try {
    // Strip markdown code fences if present
    const stripped = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
    return JSON.parse(stripped) as T;
  } catch {
    return fallback;
  }
}

/**
 * Qualify a lead using AI analysis
 */
export async function qualifyLead(
  lead: Lead,
  interactions: Interaction[],
  notes: Note[]
): Promise<ServiceResponse<LeadQualification>> {
  const contextString = getLeadContextString(lead, interactions, notes);

  const prompt = `Analyze this lead and provide a qualification assessment. Consider BANT and MEDDIC frameworks.

Lead Information:
${contextString}

Return ONLY valid JSON matching this schema:
{
  "score": number (0-100),
  "summary": string,
  "strengths": string[],
  "concerns": string[],
  "recommendation": "pursue" | "nurture" | "deprioritize" | "disqualify",
  "nextAction": string,
  "estimatedCloseDate": string | null,
  "confidence": number (0-1)
}`;

  const result = await callAIAssistant(prompt);

  if (result.error) {
    return { data: null, error: result.error };
  }

  const fallback: LeadQualification = {
    score: lead.score || 50,
    summary: 'Unable to generate AI qualification. Using default scoring.',
    strengths: ['Lead exists in system'],
    concerns: ['AI analysis unavailable'],
    recommendation: 'nurture',
    nextAction: 'Follow up with lead',
    confidence: 0.5,
  };

  const qualification = parseJSONWithFallback<LeadQualification>(result.data || '', fallback);
  return { data: qualification, error: null };
}

/**
 * Draft a follow-up email using AI
 */
export async function draftFollowUpEmail(
  lead: Lead,
  context: string,
  tone: 'formal' | 'friendly' | 'urgent' | 'follow-up' = 'friendly'
): Promise<ServiceResponse<EmailDraft>> {
  try {
    const response = await fetch(AI_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead: {
          name: lead.name,
          company: lead.company,
          industry: lead.industry,
          status: lead.status,
        },
        context,
        tone,
      }),
    });

    if (!response.ok) {
      // Fallback email draft
      const fallback: EmailDraft = {
        subject: `Following up - ${lead.company || 'Our Conversation'}`,
        body: `Hi ${lead.name},\n\nI wanted to follow up on our recent conversation. ${context}\n\nLet me know if you have any questions or if there's a good time to connect.\n\nBest regards`,
        tone,
        callToAction: 'Schedule a call',
        estimatedReadTime: '1 min',
      };
      return { data: fallback, error: null };
    }

    const data = await response.json();
    const draft: EmailDraft = {
      subject: data.subject || `Follow up - ${lead.company || 'Opportunity'}`,
      body: data.email || data.body || '',
      tone,
      callToAction: 'Reply to this email',
      estimatedReadTime: '1-2 min',
    };

    return { data: draft, error: null };
  } catch {
    const fallback: EmailDraft = {
      subject: `Following up - ${lead.company || 'Our Conversation'}`,
      body: `Hi ${lead.name},\n\nI hope this email finds you well. I wanted to follow up on our previous discussion and see if you'd be interested in continuing the conversation.\n\nLooking forward to hearing from you.\n\nBest regards`,
      tone,
      callToAction: 'Reply to this email',
      estimatedReadTime: '1 min',
    };
    return { data: fallback, error: null };
  }
}

/**
 * Detect deals at risk based on lead data
 */
export async function detectDealsAtRisk(leads: Lead[]): Promise<ServiceResponse<{ risks: DealRisk[]; summary: string }>> {
  const risks: DealRisk[] = [];
  const now = new Date();

  for (const lead of leads) {
    const daysSinceContact = lead.last_contacted_at
      ? Math.floor((now.getTime() - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
      lead.score !== null && lead.score < 40
        ? 'critical'
        : lead.score !== null && lead.score < 60
          ? 'high'
          : daysSinceContact !== null && daysSinceContact > 14
            ? 'medium'
            : 'low';

    if (riskLevel === 'high' || riskLevel === 'critical' || (daysSinceContact !== null && daysSinceContact > 14)) {
      const reasons: string[] = [];
      if (lead.score !== null && lead.score < 50) reasons.push('Low lead score');
      if (daysSinceContact !== null && daysSinceContact > 14) reasons.push(`No contact in ${daysSinceContact} days`);
      if (lead.status === 'proposal' && (lead.score || 0) < 70) reasons.push('In proposal stage with low score');
      if (!lead.last_contacted_at) reasons.push('Never contacted');

      risks.push({
        lead_id: lead.id,
        lead_name: lead.name,
        company: lead.company,
        risk_level: riskLevel,
        reasons,
        days_since_contact: daysSinceContact,
        recommended_action: daysSinceContact !== null && daysSinceContact > 14 ? 'Send follow-up email' : 'Review lead status',
        urgency: riskLevel === 'critical' ? 'immediate' : riskLevel === 'high' ? 'this_week' : 'this_month',
      });
    }
  }

  const summary = risks.length === 0
    ? 'No deals currently at risk. Great pipeline health!'
    : `${risks.length} deal${risks.length > 1 ? 's' : ''} require attention.`;

  return { data: { risks, summary }, error: null };
}

/**
 * Prioritize daily work based on tasks, leads, and follow-ups
 */
export async function prioritizeDailyWork(
  tasks: Task[],
  leads: Lead[],
  followUps: FollowUp[]
): Promise<ServiceResponse<{ priorities: DailyPriority[]; briefing: string; focusRecommendation: string }>> {
  const priorities: DailyPriority[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Add overdue tasks as critical
  tasks
    .filter((t) => t.status !== 'completed' && t.due_date && t.due_date < todayStr)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, 3)
    .forEach((task) => {
      priorities.push({
        item: task,
        itemType: 'task',
        reason: 'Overdue task requires immediate attention',
        urgency: 'critical',
        estimatedTime: '30 min',
        aiConfidence: 0.95,
      });
    });

  // Add hot leads
  leads
    .filter((l) => l.temperature === 'hot' && l.status !== 'won' && l.status !== 'lost')
    .slice(0, 2)
    .forEach((lead) => {
      priorities.push({
        item: lead,
        itemType: 'lead',
        reason: 'Hot lead needs follow-up to maintain momentum',
        urgency: 'high',
        estimatedTime: '15-30 min',
        aiConfidence: 0.85,
      });
    });

  // Add due follow-ups
  followUps
    .filter((f) => f.status === 'pending' && f.due_date <= todayStr)
    .slice(0, 2)
    .forEach((followUp) => {
      priorities.push({
        item: followUp,
        itemType: 'followup',
        reason: 'Scheduled follow-up is due',
        urgency: 'high',
        estimatedTime: '15 min',
        aiConfidence: 0.9,
      });
    });

  // Sort by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  priorities.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  const taskCount = tasks.filter((t) => t.status !== 'completed').length;
  const hotLeadCount = leads.filter((l) => l.temperature === 'hot').length;
  const overdueCount = tasks.filter((t) => t.status !== 'completed' && t.due_date && t.due_date < todayStr).length;

  const briefing = `Good ${getGreetingTime()}! You have ${taskCount} active task${taskCount !== 1 ? 's' : ''}, ${hotLeadCount} hot lead${hotLeadCount !== 1 ? 's' : ''}${overdueCount > 0 ? `, and ${overdueCount} overdue task${overdueCount !== 1 ? 's' : ''}` : ''}.`;

  const focusRecommendation = overdueCount > 0
    ? 'Focus on clearing overdue tasks first.'
    : hotLeadCount > 0
      ? 'Reach out to your hot leads to move them forward.'
      : 'Work on your highest-priority tasks.';

  return {
    data: { priorities: priorities.slice(0, 5), briefing, focusRecommendation },
    error: null,
  };
}

/**
 * Generate sales insights from CRM data
 */
export async function generateSalesInsights(data: {
  customers: Customer[];
  leads: Lead[];
  recentTasks: Task[];
}): Promise<ServiceResponse<{
  insights: AIInsight[];
  weekSummary: string;
  recommendations: string[];
  pipelineHealth: 'strong' | 'good' | 'concerning' | 'critical';
}>> {
  const { customers, leads, recentTasks } = data;
  const insights: AIInsight[] = [];
  const now = new Date();

  // Check for hot leads
  const hotLeads = leads.filter((l) => l.temperature === 'hot' && l.status !== 'won' && l.status !== 'lost');
  if (hotLeads.length > 0) {
    insights.push({
      id: `insight-hot-${Date.now()}`,
      type: 'opportunity',
      title: `${hotLeads.length} hot lead${hotLeads.length > 1 ? 's' : ''} ready for follow-up`,
      description: 'These leads have high scores and need attention to close.',
      entity_type: 'lead',
      entity_id: hotLeads[0]?.id || null,
      priority: 'high',
      actionLabel: 'View Hot Leads',
      actionType: 'show_data',
      created_at: now.toISOString(),
    });
  }

  // Check for stale leads
  const staleLeads = leads.filter((l) => {
    if (!l.last_contacted_at) return true;
    const daysSince = Math.floor((now.getTime() - new Date(l.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24));
    return daysSince > 14 && l.status !== 'won' && l.status !== 'lost';
  });

  if (staleLeads.length > 0) {
    insights.push({
      id: `insight-stale-${Date.now()}`,
      type: 'risk',
      title: `${staleLeads.length} lead${staleLeads.length > 1 ? 's' : ''} with no recent contact`,
      description: 'These leads may be going cold. Consider reaching out.',
      entity_type: 'lead',
      entity_id: staleLeads[0]?.id || null,
      priority: 'medium',
      actionLabel: 'View Stale Leads',
      actionType: 'detect_risk',
      created_at: now.toISOString(),
    });
  }

  // Check completed tasks trend
  const completedTasks = recentTasks.filter((t) => t.status === 'completed');
  if (completedTasks.length > 3) {
    insights.push({
      id: `insight-tasks-${Date.now()}`,
      type: 'trend',
      title: 'Great productivity',
      description: `You've completed ${completedTasks.length} tasks recently. Keep up the momentum!`,
      entity_type: 'task',
      entity_id: null,
      priority: 'low',
      created_at: now.toISOString(),
    });
  }

  // Calculate pipeline health
  const activeLeads = leads.filter((l) => !['won', 'lost'].includes(l.status));
  const avgScore = activeLeads.length > 0
    ? activeLeads.reduce((sum, l) => sum + (l.score || 0), 0) / activeLeads.length
    : 0;

  const pipelineHealth: 'strong' | 'good' | 'concerning' | 'critical' =
    avgScore > 70 && staleLeads.length < activeLeads.length * 0.2
      ? 'strong'
      : avgScore > 50
        ? 'good'
        : avgScore > 30
          ? 'concerning'
          : 'critical';

  const wonLeads = leads.filter((l) => l.status === 'won').length;
  const weekSummary = `This week: ${wonLeads} deal${wonLeads !== 1 ? 's' : ''} won, ${activeLeads.length} active lead${activeLeads.length !== 1 ? 's' : ''} in pipeline. Average lead score: ${Math.round(avgScore)}.`;

  const recommendations: string[] = [];
  if (hotLeads.length > 0) recommendations.push('Prioritize follow-ups with hot leads');
  if (staleLeads.length > 0) recommendations.push('Re-engage stale leads');
  if (avgScore < 50) recommendations.push('Focus on improving lead qualification');
  if (recommendations.length === 0) recommendations.push('Maintain current momentum');

  return { data: { insights, weekSummary, recommendations, pipelineHealth }, error: null };
}

/**
 * Execute a natural language command
 */
export async function executeNaturalLanguageCommand(
  command: string,
  context: {
    leads: Lead[];
    customers: Customer[];
    tasks: Task[];
    currentPage: string;
    commandHistory: CommandHistoryItem[];
  }
): Promise<ServiceResponse<AICommandResult>> {
  const lowerCommand = command.toLowerCase();

  // Intent detection via pattern matching
  let intent: AIIntent = 'general_answer';
  let response = '';
  let navigateTo: string | undefined;
  const actions: AICommandResult['actions'] = [];

  // Navigation commands
  if (lowerCommand.includes('show') || lowerCommand.includes('go to') || lowerCommand.includes('view')) {
    if (lowerCommand.includes('dashboard')) {
      intent = 'navigate';
      navigateTo = '/dashboard';
      response = 'Taking you to the dashboard...';
    } else if (lowerCommand.includes('lead')) {
      if (lowerCommand.includes('hot')) {
        intent = 'show_data';
        const hotLeads = context.leads.filter((l) => l.temperature === 'hot');
        response = `You have ${hotLeads.length} hot lead${hotLeads.length !== 1 ? 's' : ''}. ${hotLeads.slice(0, 3).map((l) => l.name).join(', ')}`;
      } else {
        intent = 'navigate';
        navigateTo = '/leads';
        response = 'Taking you to leads...';
      }
    } else if (lowerCommand.includes('customer')) {
      intent = 'navigate';
      navigateTo = '/customers';
      response = 'Taking you to customers...';
    } else if (lowerCommand.includes('task')) {
      intent = 'navigate';
      navigateTo = '/tasks';
      response = 'Taking you to tasks...';
    }
  }

  // AI action commands
  else if (lowerCommand.includes('draft') && lowerCommand.includes('email')) {
    intent = 'draft_email';
    // Find lead mentioned in command
    const leadMatch = context.leads.find(
      (l) => lowerCommand.includes(l.name.toLowerCase()) || (l.company && lowerCommand.includes(l.company.toLowerCase()))
    );
    if (leadMatch) {
      response = `I'll draft an email for ${leadMatch.name}. Check the AI command bar for the draft.`;
      actions.push({
        type: 'draft_email',
        payload: { leadId: leadMatch.id },
        label: `Draft email to ${leadMatch.name}`,
        confirmRequired: true,
      });
    } else {
      response = 'Which lead would you like me to draft an email for?';
    }
  }

  else if (lowerCommand.includes('create') && lowerCommand.includes('task')) {
    intent = 'create_task';
    response = 'I can help you create a task. What would you like the task to be about?';
    actions.push({
      type: 'create_task',
      payload: {},
      label: 'Create Task',
      confirmRequired: true,
    });
  }

  else if (lowerCommand.includes('priorit') || lowerCommand.includes('today') || lowerCommand.includes('my day')) {
    intent = 'prioritize';
    const todayStr = new Date().toISOString().split('T')[0];
    const overdueTasks = context.tasks.filter((t) => t.status !== 'completed' && t.due_date && t.due_date < todayStr);
    const hotLeads = context.leads.filter((l) => l.temperature === 'hot' && !['won', 'lost'].includes(l.status));

    response = `Today's priorities:\n`;
    if (overdueTasks.length > 0) {
      response += `- ${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}\n`;
    }
    if (hotLeads.length > 0) {
      response += `- Follow up with ${hotLeads.length} hot lead${hotLeads.length !== 1 ? 's' : ''}\n`;
    }
    response += `\nFocus: ${overdueTasks.length > 0 ? 'Clear overdue tasks first' : hotLeads.length > 0 ? 'Move hot leads forward' : 'Work on high-priority items'}`;
  }

  else if (lowerCommand.includes('risk') || lowerCommand.includes('at risk')) {
    intent = 'detect_risk';
    const riskLeads = context.leads.filter((l) => {
      const score = l.score || 0;
      const noContact = !l.last_contacted_at;
      const daysSince = l.last_contacted_at
        ? Math.floor((Date.now() - new Date(l.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return (score < 50 || noContact || daysSince > 14) && !['won', 'lost'].includes(l.status);
    });

    response = `${riskLeads.length} deal${riskLeads.length !== 1 ? 's' : ''} at risk.\n`;
    riskLeads.slice(0, 3).forEach((l) => {
      response += `- ${l.name}${l.company ? ` (${l.company})` : ''} - Score: ${l.score || 0}\n`;
    });
  }

  else if (lowerCommand.includes('summar') || lowerCommand.includes('overview') || lowerCommand.includes('pipeline')) {
    intent = 'summarize';
    const activeLeads = context.leads.filter((l) => !['won', 'lost'].includes(l.status));
    const wonLeads = context.leads.filter((l) => l.status === 'won').length;
    const avgScore = activeLeads.length > 0
      ? Math.round(activeLeads.reduce((sum, l) => sum + (l.score || 0), 0) / activeLeads.length)
      : 0;

    response = `Pipeline Summary:\n`;
    response += `- ${context.customers.length} customer${context.customers.length !== 1 ? 's' : ''}\n`;
    response += `- ${activeLeads.length} active lead${activeLeads.length !== 1 ? 's' : ''}\n`;
    response += `- ${wonLeads} deal${wonLeads !== 1 ? 's' : ''} won\n`;
    response += `- Average score: ${avgScore}\n`;
    response += `- ${context.tasks.filter((t) => t.status !== 'completed').length} pending task${context.tasks.filter((t) => t.status !== 'completed').length !== 1 ? 's' : ''}`;
  }

  else {
    // Default: use AI assistant for general questions
    const aiResult = await callAIAssistant(command, {
      leads: context.leads.slice(0, 10).map((l) => ({ name: l.name, company: l.company, status: l.status, score: l.score })),
      customers: context.customers.slice(0, 5).map((c) => ({ name: c.name, company: c.company, status: c.status })),
    });

    response = aiResult.data || 'I apologize, I could not process that request. Please try again.';
    intent = 'general_answer';
  }

  const result: AICommandResult = {
    intent,
    response,
    actions,
    navigateTo,
    confidence: 0.85,
    executionTime: 100,
  };

  return { data: result, error: null };
}

/**
 * Get greeting based on time of day
 */
function getGreetingTime(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
