import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabaseRead } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Plan = { id: string; code: string; label: string; billing_type: 'one_time' | 'rental'; amount_minor: number; currency: 'USD' | 'NGN'; duration_days: number | null; max_mt5_accounts: number };
type Product = {
  id: string; slug: string; name: string; short_description: string; description: string;
  version: string; tier: string; strategy_style: string; platform: string; asset_classes: string[];
  symbols: string[]; timeframes: string[]; account_modes: string[]; risk_profile: string;
  evidence_status: string; factsheet: Record<string, unknown>; sample_trade_count: number | null;
  profit_factor: number | null; max_drawdown_pct: number | null; win_rate_pct: number | null;
  sharpe_ratio: number | null; sortino_ratio: number | null; recovery_factor: number | null;
  net_return_pct: number | null; backtest_start: string | null; backtest_end: string | null;
  forward_start: string | null; forward_end: string | null; risk_disclosure: string;
  ea_marketplace_plans: Plan[] | null;
};

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ products: [], configured: false, message: 'Marketplace catalogue is being configured.' }, { headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const rows = await supabaseRead<Product[]>(
      'ea_marketplace_products',
      'select=id,slug,name,short_description,description,version,tier,strategy_style,platform,asset_classes,symbols,timeframes,account_modes,risk_profile,evidence_status,factsheet,sample_trade_count,profit_factor,max_drawdown_pct,win_rate_pct,sharpe_ratio,sortino_ratio,recovery_factor,net_return_pct,backtest_start,backtest_end,forward_start,forward_end,risk_disclosure,ea_marketplace_plans(id,code,label,billing_type,amount_minor,currency,duration_days,max_mt5_accounts)&status=eq.published&ea_marketplace_plans.active=eq.true&order=created_at.desc'
    );
    const products = (rows ?? []).map((product) => ({
      ...product,
      ea_marketplace_plans: (product.ea_marketplace_plans ?? []).filter((plan) => plan && plan.amount_minor > 0),
    }));
    return NextResponse.json({ products, configured: true }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    console.error('Marketplace catalogue read failed:', error);
    return NextResponse.json({ products: [], configured: true, error: 'The catalogue is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
