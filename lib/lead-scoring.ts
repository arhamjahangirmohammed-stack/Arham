import { Interaction, Lead, ScoreFactors, ScoringWeights } from '@/lib/types';
import { getScoringWeights as getScoringWeightsService, saveScoringWeights as saveScoringWeightsService, DEFAULT_WEIGHTS } from '@/services/scoring-weights';

const HIGH_VALUE_INDUSTRIES = [
  'technology', 'saas', 'software', 'fintech', 'finance',
  'healthcare', 'biotech', 'ai', 'enterprise', 'cybersecurity',
];

const MEDIUM_VALUE_INDUSTRIES = [
  'retail', 'ecommerce', 'manufacturing', 'logistics',
  'education', 'consulting', 'marketing', 'real estate', 'media',
];

export { DEFAULT_WEIGHTS };

export async function getScoringWeights(): Promise<ScoringWeights> {
  const result = await getScoringWeightsService();
  if (result.error || !result.data) {
    return DEFAULT_WEIGHTS;
  }
  return result.data;
}

export async function saveScoringWeights(weights: ScoringWeights): Promise<void> {
  await saveScoringWeightsService(weights);
}

export function computeLeadScore(
  lead: Lead,
  interactions: Interaction[],
  weights: ScoringWeights = DEFAULT_WEIGHTS
): { score: number; factors: ScoreFactors } {
  const emailReplies = interactions.filter((i) => i.type === 'email' && i.replied).length;
  const meetingsBooked = interactions.filter((i) => i.meeting_booked).length;
  const totalInteractions = interactions.length;

  // --- Industry score (0-100 normalized) ---
  const industryLower = (lead.industry || '').toLowerCase();
  let industryRaw = 25;
  if (HIGH_VALUE_INDUSTRIES.some((ind) => industryLower.includes(ind))) {
    industryRaw = 100;
  } else if (MEDIUM_VALUE_INDUSTRIES.some((ind) => industryLower.includes(ind))) {
    industryRaw = 60;
  }

  // --- Company size score (0-100) ---
  let sizeRaw = 25;
  if (lead.company_size) {
    const sizeNum = parseInt(lead.company_size, 10) || 0;
    if (sizeNum >= 1000) sizeRaw = 100;
    else if (sizeNum >= 500) sizeRaw = 80;
    else if (sizeNum >= 100) sizeRaw = 60;
    else if (sizeNum >= 50) sizeRaw = 40;
    else sizeRaw = 25;
  }

  // --- Interaction count score (0-100) ---
  let interactionRaw = 0;
  if (totalInteractions >= 10) interactionRaw = 100;
  else if (totalInteractions >= 5) interactionRaw = 75;
  else if (totalInteractions >= 3) interactionRaw = 50;
  else if (totalInteractions >= 1) interactionRaw = 25;

  // --- Email reply score (0-100) ---
  let replyRaw = 0;
  if (emailReplies >= 5) replyRaw = 100;
  else if (emailReplies >= 3) replyRaw = 75;
  else if (emailReplies >= 1) replyRaw = 50;

  // --- Meeting booking score (0-100) ---
  let meetingRaw = 0;
  if (meetingsBooked >= 3) meetingRaw = 100;
  else if (meetingsBooked >= 2) meetingRaw = 75;
  else if (meetingsBooked >= 1) meetingRaw = 50;

  // --- Last contact recency score (0-100) ---
  let lastContactRaw = 0;
  let lastContactedDays: number | null = null;
  if (lead.last_contacted_at) {
    const daysSince = Math.floor((Date.now() - new Date(lead.last_contacted_at).getTime()) / 86400000);
    lastContactedDays = daysSince;
    if (daysSince <= 3) lastContactRaw = 100;
    else if (daysSince <= 7) lastContactRaw = 80;
    else if (daysSince <= 14) lastContactRaw = 60;
    else if (daysSince <= 30) lastContactRaw = 40;
    else if (daysSince <= 60) lastContactRaw = 20;
    else lastContactRaw = 10;
  }

  // --- Lead status score (0-100) ---
  const statusScores: Record<string, number> = {
    new: 20,
    contacted: 40,
    qualified: 70,
    proposal: 85,
    won: 100,
    lost: 0,
  };
  const statusRaw = statusScores[lead.status] ?? 20;

  // --- Weighted total ---
  const totalWeight =
    weights.industry_weight +
    weights.company_size_weight +
    weights.interaction_count_weight +
    weights.email_reply_weight +
    weights.meeting_count_weight +
    weights.last_contact_weight +
    weights.lead_status_weight;

  const weightedSum =
    (industryRaw * weights.industry_weight) +
    (sizeRaw * weights.company_size_weight) +
    (interactionRaw * weights.interaction_count_weight) +
    (replyRaw * weights.email_reply_weight) +
    (meetingRaw * weights.meeting_count_weight) +
    (lastContactRaw * weights.last_contact_weight) +
    (statusRaw * weights.lead_status_weight);

  const score = totalWeight > 0 ? Math.min(100, Math.round(weightedSum / totalWeight)) : 0;

  // Normalize each factor score back to its weight scale for display
  const factors: Record<string, unknown> = {
    industry: lead.industry || 'Unknown',
    company_size: lead.company_size,
    interactions: totalInteractions,
    email_replies: emailReplies,
    meetings_booked: meetingsBooked,
    last_contacted_days: lastContactedDays,
    lead_status: lead.status,
    industry_score: industryRaw,
    size_score: sizeRaw,
    interaction_score: interactionRaw,
    reply_score: replyRaw,
    meeting_score: meetingRaw,
    last_contact_score: lastContactRaw,
    status_score: statusRaw,
    weights,
  };

  return { score, factors };
}

export function scoreToTemperature(score: number): 'cold' | 'warm' | 'hot' {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Strong';
  if (score >= 40) return 'Moderate';
  if (score >= 20) return 'Weak';
  return 'Cold';
}
