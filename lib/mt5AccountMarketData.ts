import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export type Mt5AccountMarketIdentity = {
  account_key: string;
  broker: string | null;
  server: string;
  account_mode: 'REAL' | 'DEMO' | 'CONTEST' | 'UNKNOWN';
  observed_at: string;
  received_at: string;
};

export type Mt5MarketQuoteRow = {
  symbol: string;
  bid: number;
  ask: number;
  quote_time: string;
  spread_points: number;
  digits: number;
  point: number;
  server_utc_offset_minutes: number;
  time_basis: 'BROKER_SERVER_CURRENT_OFFSET';
  broker: string | null;
  server: string;
  received_at: string;
};

export type Mt5MarketCandleRow = {
  symbol: string;
  timeframe: 'M5' | 'D1';
  bar_time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tick_volume: number;
  spread_points: number;
  real_volume: number;
  is_closed: boolean;
  digits: number;
  point: number;
  server_utc_offset_minutes: number;
  time_basis: 'BROKER_SERVER_CURRENT_OFFSET';
  received_at: string;
};

export function isAuthorizedMt5AccountRead(request: Request): boolean {
  const expected = process.env.MT5_ACCOUNT_READ_TOKEN?.trim() ?? '';
  const header = request.headers.get('authorization')?.trim() ?? '';
  const candidate = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return expected.length >= 32 && a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function getMt5AccountMarketIdentity(accountKey: string): Promise<Mt5AccountMarketIdentity | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('macrolinc_account_snapshots')
    .select('account_key,broker,server,account_mode,observed_at,received_at')
    .eq('account_key', accountKey).maybeSingle();
  if (error) throw error;
  return data as Mt5AccountMarketIdentity | null;
}

export async function getMt5AccountQuotes(accountKey: string): Promise<Mt5MarketQuoteRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('macrolinc_market_quotes')
    .select('symbol,bid,ask,quote_time,spread_points,digits,point,server_utc_offset_minutes,time_basis,broker,server,received_at')
    .eq('account_key', accountKey).order('quote_time', { ascending: false }).limit(32);
  if (error) throw error;
  return (data ?? []) as Mt5MarketQuoteRow[];
}

export async function getMt5AccountCandles(
  accountKey: string,
  symbol: string,
  timeframe: 'M5' | 'D1',
): Promise<Mt5MarketCandleRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('macrolinc_market_candles')
    .select('symbol,timeframe,bar_time,open,high,low,close,tick_volume,spread_points,real_volume,is_closed,digits,point,server_utc_offset_minutes,time_basis,received_at')
    .eq('account_key', accountKey).eq('symbol', symbol).eq('timeframe', timeframe)
    .eq('is_closed', true).order('bar_time', { ascending: true }).limit(timeframe === 'M5' ? 300 : 60);
  if (error) throw error;
  return (data ?? []) as Mt5MarketCandleRow[];
}
