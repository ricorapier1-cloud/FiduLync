import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const result = await requireAdmin(request);
  if ('response' in result) return result.response;

  const [dealsResult, disputesResult, verificationsResult, auditsResult] = await Promise.all([
    result.supabase
      .from('escrow_deals')
      .select('id,reference,item_name,title,amount,currency,status,inspection_deadline,created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    result.supabase
      .from('disputes')
      .select('id,deal_id,reason,status,admin_notes,created_at,escrow_deals(reference,item_name,title,amount,currency),dispute_evidence(id,proof_url,notes,created_at)')
      .eq('status', 'under_review')
      .order('created_at', { ascending: true })
      .limit(100),
    result.supabase
      .from('ea_verification_submissions')
      .select('id,listing_id,owner_id,provider,profile_url,status,created_at,ea_listings(name,slug)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100),
    result.supabase
      .from('payout_audit_logs')
      .select('id,deal_id,dispute_id,admin_id,action,notes,amounts,created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const failedQuery = [dealsResult, disputesResult, verificationsResult, auditsResult].find(({ error }) => error);
  if (failedQuery?.error) {
    console.error('Admin dashboard query failed:', failedQuery.error);
    return NextResponse.json({ error: 'Unable to load administrator data.' }, { status: 503 });
  }

  const disputes = await Promise.all((disputesResult.data || []).map(async (dispute) => {
    const evidence = await Promise.all((dispute.dispute_evidence || []).map(async (item) => {
      const { data, error } = await result.supabase.storage
        .from('dispute-evidence')
        .createSignedUrl(item.proof_url, 300);
      if (error) throw error;
      return { ...item, proof_url: data.signedUrl };
    }));
    return { ...dispute, dispute_evidence: evidence };
  })).catch((error: unknown) => {
    console.error('Admin dispute evidence signing failed:', error);
    return null;
  });

  if (!disputes) {
    return NextResponse.json({ error: 'Unable to provide secure dispute evidence links.' }, { status: 503 });
  }

  return NextResponse.json({
    escrows: dealsResult.data,
    disputes,
    verifications: verificationsResult.data,
    payoutAudit: auditsResult.data,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
