import { supabase } from './supabase';
import { fetchPlan, refreshCurrentUser } from './auth';

export const startProCheckout = async (): Promise<{ ok: boolean; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: {} });
  if (error || !data?.url) return { ok: false, error: 'Impossible de préparer le paiement.' };
  window.location.href = data.url;
  return { ok: true };
};

export const openBillingPortal = async (): Promise<{ ok: boolean; error?: string }> => {
  const { data, error } = await supabase.functions.invoke('create-portal-session', { body: {} });
  if (error || !data?.url) return { ok: false, error: "Impossible d'ouvrir la gestion d'abonnement." };
  window.open(data.url, '_blank');
  return { ok: true };
};

const POLL_INTERVAL_MS = 1000;
const POLL_MAX_ATTEMPTS = 8;

/** Polls profiles.plan after a successful Checkout redirect (webhook race — see spec). */
export const pollForPlanUpgrade = async (userId: string): Promise<boolean> => {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const plan = await fetchPlan(userId);
    if (plan === 'pro') {
      await refreshCurrentUser();
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
};
