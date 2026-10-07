CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Escrow Deals Table
CREATE TABLE IF NOT EXISTS public.escrow_deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'NGN',
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'INITIATED', -- INITIATED, FUNDED, DISPATCHED, DISPUTED, COMPLETED
    inspection_hours INT DEFAULT 48,
    dispatched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AlgoLync Quant Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Expert Advisor',
    price NUMERIC(12, 2) NOT NULL,
    profit_factor NUMERIC(5, 2) DEFAULT 2.41,
    max_drawdown_pct NUMERIC(5, 2) DEFAULT 11.20,
    win_rate_pct NUMERIC(5, 2) DEFAULT 76.40,
    demo_file_url TEXT,
    seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. In-Deal Negotiation Chat Messages
CREATE TABLE IF NOT EXISTS public.deal_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID REFERENCES public.escrow_deals(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.escrow_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Users view own deals" ON public.escrow_deals 
FOR SELECT USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

CREATE POLICY "Users view deal messages" ON public.deal_messages 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.escrow_deals 
    WHERE id = deal_messages.deal_id 
    AND (seller_id = auth.uid() OR buyer_id = auth.uid())
  )
);

CREATE POLICY "Users insert deal messages" ON public.deal_messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 6. Automated 48-Hour Auto-Settlement Function
CREATE OR REPLACE FUNCTION public.auto_settle_expired_deals()
RETURNS void AS $$
BEGIN
    UPDATE public.escrow_deals
    SET status = 'COMPLETED',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE status = 'DISPATCHED'
      AND dispatched_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
