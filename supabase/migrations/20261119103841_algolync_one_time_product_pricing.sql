ALTER TABLE public.ea_products
  ADD COLUMN IF NOT EXISTS one_time_price_ngn bigint NOT NULL DEFAULT 0 CHECK (one_time_price_ngn >= 0),
  ADD COLUMN IF NOT EXISTS one_time_price_usd numeric NOT NULL DEFAULT 0 CHECK (one_time_price_usd >= 0);
UPDATE public.ea_products SET one_time_price_ngn=250000, one_time_price_usd=199 WHERE slug='eridam-nexus-pro';
UPDATE public.ea_products SET one_time_price_ngn=180000, one_time_price_usd=149 WHERE slug='velocity-vault';
UPDATE public.ea_products SET one_time_price_ngn=0, one_time_price_usd=0 WHERE slug='macro-atr-breakout';
