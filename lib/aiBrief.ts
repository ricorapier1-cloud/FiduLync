import 'server-only';

import { getCachedData } from '@/lib/redisCache';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { getMacroSnapshot } from '@/lib/macroEngine';

export type MacroBrief = { bullets: string[]; source: 'gemini' | 'rules' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ruleBasedBrief(snapshot: Awaited<ReturnType<typeof getMacroSnapshot>>): MacroBrief {
  const strengths = getCurrencyStrengthIndex(snapshot);
  const strongest = strengths[0];
  const weakest = strengths.at(-1);
  const crowded = snapshot.cot
    .filter((position) => position.percentile >= 90 || position.percentile <= 10)
    .map((position) => position.market);
  const nextCatalyst = snapshot.catalysts
    .filter((item) => Date.parse(item.scheduledAt) >= Date.now() && item.impact === 'High')
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt))[0];
  return {
    source: 'rules',
    bullets: [
      strongest && weakest
        ? `Macro-relative strength: ${strongest.currency} leads while ${weakest.currency} lags; CSI is not a standalone execution signal.`
        : 'Currency-strength inputs are incomplete; treat relative-value rankings as provisional.',
      crowded.length
        ? `COT crowding alert: ${crowded.slice(0, 3).join(', ')} is at a 10th/90th percentile extreme.`
        : 'No COT market currently meets the 10th/90th percentile crowding threshold.',
      nextCatalyst
        ? `Next high-impact catalyst: ${nextCatalyst.region} ${nextCatalyst.title} at ${nextCatalyst.scheduledAt}.`
        : 'No upcoming high-impact catalyst is listed in the current calendar snapshot.',
    ],
  };
}

async function generateGeminiBrief(
  snapshot: Awaited<ReturnType<typeof getMacroSnapshot>>,
): Promise<MacroBrief> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const fallback = ruleBasedBrief(snapshot);
  if (!apiKey) return fallback;

  const inputs = {
    rateDifferentials: snapshot.currencies.map((currency) => ({
      currency: currency.code,
      policyRatePct: currency.policyRate,
      inflationPct: currency.inflation,
      realRatePct: Number((currency.policyRate - currency.inflation).toFixed(2)),
    })),
    csi: getCurrencyStrengthIndex(snapshot),
    cotExtremes: snapshot.cot.filter((item) => item.percentile >= 90 || item.percentile <= 10),
    tierOneCalendar: snapshot.catalysts.filter((item) => item.impact === 'High')
      .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt)).slice(0, 5),
  };
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
  return getCachedData('macro:ai-brief', async () => {
    const snapshot = await getMacroSnapshot();
    try {
      return await generateGeminiBrief(snapshot);
    } catch (error) {
      console.warn('Gemini brief generation failed; serving the deterministic desk note.', error);
      return ruleBasedBrief(snapshot);
    }
  }, 3_600);
}
