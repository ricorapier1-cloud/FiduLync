import type { Metadata } from 'next';
import StoreTerminal from '@/app/components/StoreTerminal';
import { supabaseRead } from '@/lib/supabaseAdmin';
import { EA_CATALOG, type EaProduct } from '@/lib/eaCatalog';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'AlgoLync Strategy Store',
  description: 'Browse AlgoLync strategies, request eligible demo access and configure recurring subscriptions.',
};

type ProductRow = {
  slug:string; name:string; tagline:string; version:string; category:string;
  monthly_price_ngn:number; monthly_price_usd:number; annual_price_ngn:number; annual_price_usd:number;
  extra_seat_price_ngn:number; extra_seat_price_usd:number; demo_days:number;
  included_live_seats:number; included_demo_seats:number; metrics_json:Record<string,unknown>;
  ex5_artifact_url:string|null; is_active:boolean;
};

function mapProduct(row:ProductRow):EaProduct {
  const metrics=row.metrics_json || {};
  const category=row.category.toUpperCase();
  const tierCategory=category==='SANDBOX'?'SANDBOX':category==='MOMENTUM'?'MOMENTUM':'FLAGSHIP';
  const curve=Array.isArray(metrics.equity_curve) ? metrics.equity_curve.filter((n):n is number=>typeof n==='number'&&Number.isFinite(n)) : [100];
  return {
    id:row.slug,slug:row.slug,name:row.name,version:row.version,
    badge:category,badgeColor:tierCategory==='SANDBOX'?'amber':tierCategory==='MOMENTUM'?'cyan':'emerald',
    headline:row.tagline,description:row.tagline,tierCategory,
    monthlyPriceNgn:Number(row.monthly_price_ngn),monthlyPriceUsd:Number(row.monthly_price_usd),
    lifetimePriceNgn:Number(row.annual_price_ngn),lifetimePriceUsd:Number(row.annual_price_usd),
    winRate:String(metrics.win_rate ?? '—'),profitFactor:String(metrics.profit_factor ?? '—'),
    sharpeRatio:String(metrics.sharpe ?? '—'),maxDrawdown:String(metrics.max_drawdown ?? '—'),
    targetPairs:String(metrics.asset_coverage ?? 'G10 FX'),timeframe:String(metrics.timeframe ?? 'Adaptive'),
    demoDownloadUrl:tierCategory==='SANDBOX'?'/downloads/MacroLync_G10_Breakout_Test.mq5':(row.ex5_artifact_url || ''),
    demoFilename:tierCategory==='SANDBOX'?'MacroLync_G10_Breakout_Test.mq5':`${row.slug}.ex5`,
    mqhDownloadUrl:'',maxLiveAccounts:row.included_live_seats,maxDemoAccounts:row.included_demo_seats,
    equityCurvePoints:curve.length>1?curve:[100,100],provenanceNote:String(metrics.provenance ?? 'No independently verified performance report is published.'),
  };
}

export default async function AlgoLyncStorePage() {
  let products:EaProduct[] = [];
  try {
    const rows=await supabaseRead<ProductRow[]>('ea_products','is_active=eq.true&select=slug,name,tagline,version,category,monthly_price_ngn,monthly_price_usd,annual_price_ngn,annual_price_usd,extra_seat_price_ngn,extra_seat_price_usd,demo_days,included_live_seats,included_demo_seats,metrics_json,ex5_artifact_url,is_active&order=category.asc');
    products=(rows || []).map(mapProduct);
  } catch(error) { console.error('Dynamic EA catalog unavailable:',error); }
  return <StoreTerminal products={products.length?products:EA_CATALOG} />;
}
