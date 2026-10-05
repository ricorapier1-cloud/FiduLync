'use client'
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Dashboard() {
  const [deals, setDeals] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadDashboard() {
      // 1. Get logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // 2. Fetch history (RLS protects this query automatically)
        const { data, error } = await supabase
          .from('escrow_deals')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (data) setDeals(data);
      }
    }
    loadDashboard();
  }, []);

  if (!user) return <div className="p-10 text-center">Please Log In to view your Escrow Vault.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Your Trade History</h1>
      {deals.length === 0 ? (
        <div className="p-8 border rounded text-gray-500 text-center">No active deals found.</div>
      ) : (
        <div className="space-y-4">
          {deals.map(deal => (
            <div key={deal.id} className="p-4 border rounded shadow-sm flex justify-between">
              <div>
                <p className="font-bold text-lg">REF: {deal.reference}</p>
                <p className="text-sm text-gray-600">Status: {deal.status}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">₦{deal.amount_ngn}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
