import 'server-only';

import { getCachedData } from '@/lib/redisCache';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';

export type MacroBrief = { bullets: string[]; source: 'gemini' | 'rules' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFreshObservation(date: string | undefined, maxAgeDays: number): boolean {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

function ruleBasedBrief(snapshot: Awaited<ReturnType<typeof getMacroSnapshot>>): MacroBrief {
  const strengths = getCurrencyStrengthIndex(snapshot);
  const strongest = strengths[0];
  const weakest = strengths.at(-1);
  const eligibleCot = snapshot.cot.filter((position) => position.sampleSize !== undefined
    && position.sampleSize >= 52 && position.percentile !== null);
  const crowded = eligibleCot
    .filter((position) => position.percentile !== null && (position.percentile >= 90 || position.percentile <= 10))
    .map((position) => position.market);
  const calendarRetrievedAtMs = snapshot.calendarRetrievedAtUtc ? Date.parse(snapshot.calendarRetrievedAtUtc) : NaN;
  const calendarCoverageEndMs = snapshot.calendarCoverageEndUtc ? Date.parse(snapshot.calendarCoverageEndUtc) : NaN;
  const calendarVerified = snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider)
    && Number.isFinite(calendarRetrievedAtMs) && Date.now() - calendarRetrievedAtMs <= 60 * 60_000
    && Date.now() - calendarRetrievedAtMs >= -30_000
    && Number.isFinite(calendarCoverageEndMs) && calendarCoverageEndMs >= Date.now() + 24 * 60 * 60_000;
  const nextCatalyst = calendarVerified ? snapshot.catalysts
    .filter((item) => Date.parse(item.scheduledAt) >= Date.now() && item.impact === 'High')
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt))[0] : undefined;
  return {
    source: 'rules',
    bullets: [
      strongest && weakest
        ? `Macro-relative strength: ${strongest.currency} leads while ${weakest.currency} lags; CSI is not a standalone execution signal.`
        : 'Currency-strength inputs are incomplete; treat relative-value rankings as provisional.',
      crowded.length
        ? `COT crowding alert: ${crowded.slice(0, 3).join(', ')} is at a 10th/90th percentile extreme (minimum 52 weekly observations).`
        : snapshot.cot.length === 0 ? 'COT positioning is unavailable; no crowding conclusion can be made.'
          : eligibleCot.length === 0 ? 'COT percentile unavailable: fewer than 52 weekly observations are verified.'
            : 'No eligible COT market currently meets the 10th/90th percentile crowding threshold.',
      nextCatalyst
        ? `Next high-impact catalyst: ${nextCatalyst.region} ${nextCatalyst.title} at ${nextCatalyst.scheduledAt}.`
        : calendarVerified ? 'No upcoming high-impact catalyst is listed in the verified provider calendar window.'
          : 'Economic calendar is unavailable, stale, or lacks verified forward coverage; event risk remains locked.',
    ],
  };
}

async function generateGeminiBrief(
  snapshot: Awaited<ReturnType<typeof getMacroSnapshot>>,
): Promise<MacroBrief> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const fallback = ruleBasedBrief(snapshot);
  if (!apiKey || process.env.GEMINI_MACRO_BRIEF_ENABLED !== 'true') return fallback;

  const calendarRetrievedAtMs = snapshot.calendarRetrievedAtUtc ? Date.parse(snapshot.calendarRetrievedAtUtc) : NaN;
  const calendarCoverageEndMs = snapshot.calendarCoverageEndUtc ? Date.parse(snapshot.calendarCoverageEndUtc) : NaN;
  const calendarVerified = snapshot.calendarSource === 'provider' && Boolean(snapshot.calendarProvider)
    && Number.isFinite(calendarRetrievedAtMs) && Date.now() - calendarRetrievedAtMs <= 60 * 60_000
    && Date.now() - calendarRetrievedAtMs >= -30_000
    && Number.isFinite(calendarCoverageEndMs) && calendarCoverageEndMs >= Date.now() + 24 * 60 * 60_000;

  const inputs = {
    rateDifferentials: snapshot.currencies.filter((currency) => currency.policyRateSource === 'provider' && currency.inflationSource === 'provider'
      && isFreshObservation(currency.policyRateObservationDate, 180)
      && isFreshObservation(currency.inflationObservationDate, 120)).map((currency) => ({
      currency: currency.code,
      policyRatePct: currency.policyRate,
      inflationPct: currency.inflation,
      realRatePct: Number((currency.policyRate - currency.inflation).toFixed(2)),
    })),
    csi: getCurrencyStrengthIndex(snapshot),
    dataQuality: { macroSource: snapshot.source, calendarSource: calendarVerified ? snapshot.calendarSource : 'unavailable', calendarVerified, calendarRetrievedAtUtc: snapshot.calendarRetrievedAtUtc ?? null, calendarCoverageEndUtc: snapshot.calendarCoverageEndUtc ?? null, cotSource: snapshot.cotSource, note: 'Only provider-sourced, fresh observations are eligible. Missing or stale data must be treated as unavailable.' },
    cotExtremes: snapshot.cot.filter((item) => item.sampleSize !== undefined && item.sampleSize >= 52
      && item.percentile !== null && (item.percentile >= 90 || item.percentile <= 10)),
    tierOneCalendar: calendarVerified ? snapshot.catalysts.filter((item) => item.impact === 'High')
      .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt)).slice(0, 5) : [],
  };
  if (inputs.rateDifferentials.length < 2 && inputs.csi.length < 2 && inputs.cotExtremes.length === 0 && inputs.tierOneCalendar.length === 0) {
    return fallback;
  }
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  url.searchParams.set('key', apiKey);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'Write exactly three concise institutional FX desk bullets. Use only supplied facts. Do not invent data, give trade instructions, price targets, or claim certainty. Mention event risk when relevant.' }],
      },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(inputs) }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 220 },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Gemini returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) {
    throw new Error('Gemini returned an invalid response.');
  }
  const first = payload.candidates[0];
  if (!isRecord(first) || !isRecord(first.content) || !Array.isArray(first.content.parts)) {
    throw new Error('Gemini returned no brief content.');
  }
  const text = first.content.parts.flatMap((part: unknown) =>
    isRecord(part) && typeof part.text === 'string' ? [part.text] : [])
    .join('\n');
  const bullets = text.split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean).slice(0, 3);
  if (bullets.length !== 3) throw new Error('Gemini did not return exactly three desk bullets.');
  return { bullets, source: 'gemini' };
}

export async function getMacroBrief(): Promise<MacroBrief> {
  return getCachedData('macro:ai-brief:v4', async () => {
    const snapshot = await getMacroSnapshot();
    try {
      return await generateGeminiBrief(snapshot);
    } catch (error) {
      console.warn('Gemini brief generation failed; serving the deterministic desk note.', error);
      return ruleBasedBrief(snapshot);
    }
  }, 300);
}
