import type { CountryFundamentalProfile, MacroSnapshot } from '@/types/macro';

export const G8_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'] as const;
export type G8Currency = (typeof G8_CURRENCIES)[number];

/**
 * No complete, consistently timestamped G8 country dataset is connected yet.
 * Returning no profiles is preferable to presenting static assumptions as
 * observed GDP, labour, fiscal, current-account or sovereign-yield facts.
 */
export const BASELINE_COUNTRY_PROFILES: Record<string, never> = {};

export function getCountryProfiles(_snapshot: MacroSnapshot): CountryFundamentalProfile[] {
  void _snapshot;
  return [];
}
