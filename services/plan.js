// Planes de FittingUp
// - Común (gratis): todo menos la IA.
// - Premium: IA incluida. Se obtiene con los 7 días de prueba o con una suscripción.
export const TRIAL_DAYS = 7;
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);
export const PRICES = { month: 3, year: 30, currency: 'USD' };

const DAY = 24 * 60 * 60 * 1000;
export const today = () => new Date().toISOString().slice(0, 10);

export function trialEndOf(user) {
  if (user.trialEndsAt) return new Date(user.trialEndsAt);
  // Cuentas creadas antes de los planes: la prueba cuenta desde que se registraron
  return new Date(new Date(user.createdAt ?? Date.now()).getTime() + TRIAL_DAYS * DAY);
}

export function planOf(user, now = new Date()) {
  const sub = user.subscription ?? {};
  const subEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const subscribed = ['active', 'canceled', 'past_due'].includes(sub.status) && subEnd && subEnd > now;
  const trialEnd = trialEndOf(user);
  const inTrial = !subscribed && trialEnd > now;
  const used = user.aiUsage?.day === today() ? user.aiUsage.count : 0;
  return {
    premium: Boolean(subscribed || inTrial),
    source: subscribed ? 'subscription' : inTrial ? 'trial' : null,
    trialEndsAt: trialEnd,
    trialDaysLeft: inTrial ? Math.ceil((trialEnd - now) / DAY) : 0,
    interval: subscribed ? sub.interval ?? null : null,
    status: sub.status ?? 'none',
    premiumUntil: subscribed ? subEnd : inTrial ? trialEnd : null,
    aiUsedToday: used,
    aiDailyLimit: AI_DAILY_LIMIT,
    prices: PRICES,
  };
}
