import { createClient } from '@supabase/supabase-js';
import { calculateEscrowFee } from '@/lib/feeCalculator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function BuyerPayPage({ params }: { params: Promise<{ slug?: string; id?: string }> | { slug?: string; id?: string } }) {
  const resolvedParams = await params;
  const linkSlug = resolvedParams?.slug || resolvedParams?.id || '';

  if (!linkSlug) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-sm text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Invalid Link</h2>
          <p className="text-xs text-slate-500">No link key was provided.</p>
        </div>
      </main>
    );
  }

  const { data: escrow, error } = await supabase
    .from('escrows')
    .select('*')
    .eq('slug', linkSlug)
    .maybeSingle();

  if (error || !escrow) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 max-w-sm text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Safe Link Not Found</h2>
          <p className="text-xs text-slate-500 mb-3">
            Link key <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700 font-mono">{linkSlug}</code> does not exist in Supabase.
          </p>
          <p className="text-[11px] text-slate-400">
            Please go back to the home page and create a <strong>new Safe Link</strong>.
          </p>
        </div>
      </main>
    );
  }

  const feeDetails = calculateEscrowFee(Number(escrow.amount));

  return (
    <main className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 w-full max-w-md shadow-sm space-y-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
            veriPay Safe Escrow
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-2">{escrow.title}</h1>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Item Price</span>
            <span className="font-semibold text-slate-900">₦{Number(escrow.amount).toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-600">Escrow Fee</span>
            <span className="font-semibold text-emerald-700">₦{feeDetails.actualFee.toLocaleString()}</span>
          </div>

          {feeDetails.isCapped && (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
              🎉 ₦5,000 Fee Cap Applied! You saved ₦{feeDetails.savings.toLocaleString()}.
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-base text-slate-900">
            <span>Total Payable</span>
            <span>₦{feeDetails.total.toLocaleString()}</span>
          </div>
        </div>

        <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition">
          Pay ₦{feeDetails.total.toLocaleString()} Now
        </button>
      </div>
    </main>
  );
}
