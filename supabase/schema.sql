-- MacroLync & AlgoLync Production Schema (Run in Supabase SQL Editor)

CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    license_key TEXT UNIQUE NOT NULL,
    mt5_account BIGINT NOT NULL,
    email TEXT NOT NULL,
    tier TEXT DEFAULT 'INSTITUTIONAL_PRO',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    mt5_account BIGINT,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ea_heartbeats (
    mt5_account BIGINT PRIMARY KEY,
    license_key TEXT NOT NULL,
    balance NUMERIC NOT NULL,
    equity NUMERIC NOT NULL,
    drawdown_pct NUMERIC DEFAULT 0,
    open_positions INT DEFAULT 0,
    vps_ping_ms INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_heartbeats ENABLE ROW LEVEL SECURITY;
