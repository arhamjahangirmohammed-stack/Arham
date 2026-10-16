/**
 * Scoring Weights Service
 *
 * Data access layer for scoring weight operations.
 * All functions return ServiceResponse and never throw.
 */

import { supabase } from '@/lib/supabase/client';
import { ScoringWeights, ServiceResponse } from '@/lib/types';
import { getCurrentUserId, handleServiceError } from './base';

const DEFAULT_WEIGHTS: ScoringWeights = {
  industry_weight: 20,
  company_size_weight: 20,
  interaction_count_weight: 20,
  email_reply_weight: 20,
  meeting_count_weight: 20,
  last_contact_weight: 0,
  lead_status_weight: 0,
};

/**
 * Get scoring weights for the current user
 */
export async function getScoringWeights(): Promise<ServiceResponse<ScoringWeights>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: DEFAULT_WEIGHTS, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('scoring_weights')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return handleServiceError(error, 'getScoringWeights');
    }

    if (!data) {
      return { data: DEFAULT_WEIGHTS, error: null };
    }

    const weights: ScoringWeights = {
      industry_weight: Number(data.industry_weight),
      company_size_weight: Number(data.company_size_weight),
      interaction_count_weight: Number(data.interaction_count_weight),
      email_reply_weight: Number(data.email_reply_weight),
      meeting_count_weight: Number(data.meeting_count_weight),
      last_contact_weight: Number(data.last_contact_weight),
      lead_status_weight: Number(data.lead_status_weight),
    };

    return { data: weights, error: null };
  } catch (error) {
    return handleServiceError(error, 'getScoringWeights');
  }
}

/**
 * Save scoring weights for the current user
 */
export async function saveScoringWeights(weights: ScoringWeights): Promise<ServiceResponse<null>> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Not authenticated' };
  }

  try {
    const { data: existing } = await supabase
      .from('scoring_weights')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('scoring_weights')
        .update(weights)
        .eq('id', existing.id);

      if (error) {
        return handleServiceError(error, 'saveScoringWeights');
      }
    } else {
      const { error } = await supabase.from('scoring_weights').insert({
        ...weights,
        user_id: userId,
      });

      if (error) {
        return handleServiceError(error, 'saveScoringWeights');
      }
    }

    return { data: null, error: null };
  } catch (error) {
    return handleServiceError(error, 'saveScoringWeights');
  }
}

export { DEFAULT_WEIGHTS };
