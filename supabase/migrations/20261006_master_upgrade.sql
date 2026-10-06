-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- 2. Escrow Deals Table
CREATE TABLE IF NOT EXISTS public.escrow_deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'NGN',
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'INITIATED', -- INITIATED, FUNDED, DISPATCHED, DISPUTED, COMPLETED, REFUNDED
    inspection_hours INT DEFAULT 48,
    dispatched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AlgoLync Products Table (MQL5 EAs & Quant Assets)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Expert Advisor',
    price NUMERIC(12, 2) NOT NULL,
    profit_factor NUMERIC(5, 2),
    max_drawdown_pct NUMERIC(5, 2),
    win_rate_pct NUMERIC(5, 2),
    demo_file_url TEXT,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Admin Audit Logs (Legal Compliance)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    deal_id UUID REFERENCES public.escrow_deals(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.escrow_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for Escrow Deals
CREATE POLICY "Users can view their own deals as buyer or seller"
ON public.escrow_deals FOR SELECT
USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE POLICY "Sellers can insert deals"
ON public.escrow_deals FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Parties can update their deals"
ON public.escrow_deals FOR UPDATE
USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- 7. 48-Hour Auto-Settlement Cron Job
CREATE OR REPLACE FUNCTION public.auto_settle_expired_deals()
RETURNS void AS $$ BEGIN     UPDATE public.escrow_deals     SET status = 'COMPLETED',         completed_at = NOW(),         updated_at = NOW()     WHERE status = 'DISPATCHED'       AND dispatched_at < NOW() - INTERVAL '48 hours'; END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule auto-settlement check every hour
SELECT cron.schedule(
    'auto-settle-escrows-hourly',
    '0 * * * *',
    $$SELECT public.auto_settle_expired_deals();$$
);
