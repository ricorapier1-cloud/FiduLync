CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $sql$
      SELECT cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'auto-settle-escrows-hourly'
    $sql$;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.auto_settle_expired_deals();

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.profiles ALTER COLUMN full_name DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.escrow_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(64) UNIQUE NOT NULL,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_phone varchar(32) NOT NULL DEFAULT '',
  seller_phone varchar(32),
  seller_account varchar(10) NOT NULL,
  seller_bank_code varchar(10) NOT NULL,
  seller_account_name text NOT NULL,
  amount_ngn numeric(14, 2) NOT NULL CHECK (amount_ngn > 0),
  items_goods_description text NOT NULL,
  dispute_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'funded', 'disputed', 'released', 'refunded', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.escrow_deals
  ADD COLUMN IF NOT EXISTS reference varchar(64),
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_phone varchar(32) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS seller_phone varchar(32),
  ADD COLUMN IF NOT EXISTS seller_account varchar(10),
  ADD COLUMN IF NOT EXISTS seller_bank_code varchar(10),
  ADD COLUMN IF NOT EXISTS seller_account_name text,
  ADD COLUMN IF NOT EXISTS amount_ngn numeric(14, 2),
  ADD COLUMN IF NOT EXISTS items_goods_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status varchar(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS item_name text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS seller_account_number varchar(10),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency varchar(5) NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS amount numeric(14, 2),
  ADD COLUMN IF NOT EXISTS fee_payer text NOT NULL DEFAULT 'buyer',
  ADD COLUMN IF NOT EXISTS platform_fee numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_fee numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_fee numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS paystack_reference text UNIQUE,
  ADD COLUMN IF NOT EXISTS funded_at timestamptz,
  ADD COLUMN IF NOT EXISTS inspection_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

UPDATE public.escrow_deals
SET reference = COALESCE(reference, encode(gen_random_bytes(18), 'hex')),
    amount = COALESCE(amount, amount_ngn),
    amount_ngn = COALESCE(amount_ngn, amount),
    item_name = COALESCE(item_name, title, 'Escrow transaction'),
    title = COALESCE(title, item_name, 'Escrow transaction'),
    status = CASE lower(trim(status))
      WHEN 'initiated' THEN 'pending'
      WHEN 'created' THEN 'pending'
      WHEN 'pending_payment' THEN 'pending'
      WHEN 'funded_in_escrow' THEN 'funded'
      WHEN 'funded' THEN 'funded'
      WHEN 'dispatched' THEN 'funded'
      WHEN 'delivered' THEN 'funded'
      WHEN 'settling' THEN 'settling'
      WHEN 'disputed' THEN 'disputed'
      WHEN 'in_dispute' THEN 'disputed'
      WHEN 'released' THEN 'released'
      WHEN 'completed' THEN 'released'
      WHEN 'refunded' THEN 'refunded'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint AS c
    WHERE c.conrelid = 'public.escrow_deals'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.escrow_deals DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE public.escrow_deals ALTER COLUMN reference SET NOT NULL;
ALTER TABLE public.escrow_deals ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE public.escrow_deals
  ADD CONSTRAINT escrow_deals_status_institutional_check
  CHECK (status IN ('pending', 'funded', 'disputed', 'settling', 'released', 'refunded', 'cancelled'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_deals_reference_unique ON public.escrow_deals(reference);

CREATE TABLE IF NOT EXISTS public.ea_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  version text,
  currency varchar(5) NOT NULL DEFAULT 'USD',
  price numeric(14, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  profit_factor numeric(8, 3),
  max_drawdown_pct numeric(8, 3),
  win_rate_pct numeric(8, 3),
  equity_curve jsonb NOT NULL DEFAULT '[]'::jsonb,
  myfxbook_status text NOT NULL DEFAULT 'unverified',
  fxblue_status text NOT NULL DEFAULT 'unverified',
  mt5_sync_status text NOT NULL DEFAULT 'unverified',
  verification_status text NOT NULL DEFAULT 'unverified',
  verification_notes text,
  ex5_file_url text,
  demo_file_url text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ea_verification_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ea_listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('myfxbook', 'fxblue', 'mt5_direct')),
  profile_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ea_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ea_listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider = 'mt5_direct'),
  encrypted_credentials text NOT NULL,
  credentials_nonce text NOT NULL,
  credentials_tag text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, owner_id, provider)
);

CREATE TABLE IF NOT EXISTS public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.escrow_deals(id) ON DELETE CASCADE,
  raised_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'under_review'
    CHECK (status IN ('under_review', 'released_to_seller', 'refunded_to_buyer', 'split')),
  admin_notes text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.escrow_deals(id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  proof_url text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispute_evidence
  ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES public.disputes(id) ON DELETE CASCADE;
ALTER TABLE public.dispute_evidence ALTER COLUMN uploader_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.escrow_deals(id) ON DELETE RESTRICT,
  dispute_id uuid REFERENCES public.disputes(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('seller_payout', 'buyer_refund', 'split_payout')),
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  currency varchar(5) NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  provider_reference text,
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.payout_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.escrow_deals(id) ON DELETE RESTRICT,
  dispute_id uuid REFERENCES public.disputes(id) ON DELETE SET NULL,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('release_to_seller', 'refund_to_buyer', 'split')),
  notes text NOT NULL,
  amounts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_deals_parties ON public.escrow_deals(buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_settlement ON public.escrow_deals(status, inspection_deadline);
CREATE INDEX IF NOT EXISTS idx_escrow_deals_reference ON public.escrow_deals(reference);
CREATE INDEX IF NOT EXISTS idx_disputes_deal_status ON public.disputes(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_verification_queue ON public.ea_verification_submissions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_disbursements_deal_status ON public.disbursements(deal_id, status);

UPDATE public.profiles AS p
SET email = u.email,
    role = CASE
      WHEN lower(u.email) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com') THEN 'admin'
      ELSE COALESCE(p.role, 'customer')
    END,
    updated_at = now()
FROM auth.users AS u
WHERE u.id = p.id AND u.email IS NOT NULL;

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, raw_user_meta_data ->> 'full_name',
       CASE WHEN lower(email) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com') THEN 'admin' ELSE 'customer' END
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = CASE
      WHEN lower(EXCLUDED.email) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com') THEN 'admin'
      ELSE public.profiles.role
    END,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_fidulync_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(COALESCE(NEW.email, ''), '@', 1), 'FiduLync user'),
    CASE WHEN lower(NEW.email) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com') THEN 'admin' ELSE 'customer' END
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = CASE
        WHEN lower(EXCLUDED.email) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com') THEN 'admin'
        WHEN lower(public.profiles.email) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com') THEN 'customer'
        ELSE public.profiles.role
      END,
      updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_fidulync_profile ON auth.users;
CREATE TRIGGER on_auth_user_fidulync_profile
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.sync_fidulync_profile();

CREATE OR REPLACE FUNCTION public.set_fidulync_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles', 'escrow_deals', 'ea_listings', 'ea_verification_submissions',
    'ea_integrations', 'disputes', 'dispute_evidence', 'disbursements', 'payout_audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    FOR policy_name IN
      SELECT p.policyname FROM pg_policies AS p
      WHERE p.schemaname = 'public' AND p.tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    END LOOP;
  END LOOP;
END;
$$;

CREATE POLICY profiles_read_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com'));
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

REVOKE ALL ON public.profiles FROM anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;

CREATE POLICY escrow_deals_read_parties_or_admin ON public.escrow_deals
  FOR SELECT TO authenticated
  USING (
    buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid())
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com')
  );
REVOKE ALL ON public.escrow_deals FROM anon, authenticated;
GRANT SELECT (
  id, reference, buyer_id, seller_id, item_name, title, description, currency,
  amount, fee_payer, platform_fee, buyer_fee, seller_fee, status, created_at,
  updated_at, funded_at, inspection_deadline, dispute_frozen_at, delivered_at,
  delivery_confirmed_at
) ON public.escrow_deals TO authenticated;

CREATE POLICY ea_listings_public_published ON public.ea_listings
  FOR SELECT TO anon, authenticated USING (is_published AND verification_status = 'verified');
CREATE POLICY ea_listings_owner_read ON public.ea_listings
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));
CREATE POLICY ea_listings_owner_insert_unverified ON public.ea_listings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()) AND verification_status = 'unverified' AND NOT is_published);
CREATE POLICY ea_listings_owner_update_unverified ON public.ea_listings
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND verification_status = 'unverified')
  WITH CHECK (owner_id = (SELECT auth.uid()) AND verification_status = 'unverified' AND NOT is_published);
REVOKE ALL ON public.ea_listings FROM anon, authenticated;
GRANT SELECT (
  id, owner_id, slug, name, description, version, currency, price, profit_factor,
  max_drawdown_pct, win_rate_pct, equity_curve, myfxbook_status, fxblue_status,
  mt5_sync_status, verification_status, verification_notes, is_published, created_at, updated_at
) ON public.ea_listings TO anon, authenticated;
GRANT INSERT (owner_id, slug, name, description, version, currency, price, profit_factor, max_drawdown_pct, win_rate_pct, equity_curve, ex5_file_url, demo_file_url) ON public.ea_listings TO authenticated;
GRANT UPDATE (name, description, version, currency, price, profit_factor, max_drawdown_pct, win_rate_pct, equity_curve, ex5_file_url, demo_file_url) ON public.ea_listings TO authenticated;

CREATE POLICY ea_submissions_insert_owner ON public.ea_verification_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid()) AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.ea_listings l WHERE l.id = listing_id AND l.owner_id = (SELECT auth.uid()))
  );
CREATE POLICY ea_submissions_read_owner_or_admin ON public.ea_verification_submissions
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com'));
REVOKE ALL ON public.ea_verification_submissions FROM anon, authenticated;
GRANT SELECT ON public.ea_verification_submissions TO authenticated;
GRANT INSERT (listing_id, owner_id, provider, profile_url) ON public.ea_verification_submissions TO authenticated;

CREATE POLICY disputes_read_parties_or_admin ON public.disputes
  FOR SELECT TO authenticated
  USING (
    lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com')
    OR EXISTS (
      SELECT 1 FROM public.escrow_deals d
      WHERE d.id = deal_id AND (d.buyer_id = (SELECT auth.uid()) OR d.seller_id = (SELECT auth.uid()))
    )
  );
CREATE POLICY disputes_create_party ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    raised_by = (SELECT auth.uid())
    AND status = 'under_review'
    AND resolved_by IS NULL
    AND resolution IS NULL
    AND EXISTS (
      SELECT 1 FROM public.escrow_deals d
      WHERE d.id = deal_id AND d.status = 'funded'
        AND (d.buyer_id = (SELECT auth.uid()) OR d.seller_id = (SELECT auth.uid()))
    )
  );
REVOKE ALL ON public.disputes FROM anon, authenticated;
GRANT SELECT ON public.disputes TO authenticated;
GRANT INSERT (deal_id, raised_by, reason) ON public.disputes TO authenticated;

CREATE POLICY dispute_evidence_read_parties_or_admin ON public.dispute_evidence
  FOR SELECT TO authenticated
  USING (
    uploader_id = (SELECT auth.uid())
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com')
    OR EXISTS (
      SELECT 1 FROM public.escrow_deals d
      WHERE d.id = deal_id AND (d.buyer_id = (SELECT auth.uid()) OR d.seller_id = (SELECT auth.uid()))
    )
  );
CREATE POLICY dispute_evidence_insert_party ON public.dispute_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.disputes ds
      WHERE ds.id = dispute_evidence.dispute_id AND ds.deal_id = dispute_evidence.deal_id
    )
    AND EXISTS (
      SELECT 1 FROM public.escrow_deals d
      WHERE d.id = deal_id AND (d.buyer_id = (SELECT auth.uid()) OR d.seller_id = (SELECT auth.uid()))
    )
  );
REVOKE ALL ON public.dispute_evidence FROM anon, authenticated;
GRANT SELECT ON public.dispute_evidence TO authenticated;
GRANT INSERT (dispute_id, deal_id, uploader_id, proof_url, notes) ON public.dispute_evidence TO authenticated;

CREATE POLICY disbursements_read_parties_or_admin ON public.disbursements
  FOR SELECT TO authenticated
  USING (
    recipient_id = (SELECT auth.uid())
    OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com')
    OR EXISTS (
      SELECT 1 FROM public.escrow_deals d
      WHERE d.id = deal_id AND (d.buyer_id = (SELECT auth.uid()) OR d.seller_id = (SELECT auth.uid()))
    )
  );
GRANT SELECT (id, deal_id, dispute_id, recipient_id, kind, amount, currency, status, created_at, completed_at) ON public.disbursements TO authenticated;

CREATE POLICY payout_audit_read_admin ON public.payout_audit_logs
  FOR SELECT TO authenticated
  USING (lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com'));
GRANT SELECT ON public.payout_audit_logs TO authenticated;

REVOKE ALL ON public.ea_integrations FROM anon, authenticated;
REVOKE ALL ON public.payout_audit_logs FROM anon, authenticated;
GRANT SELECT ON public.payout_audit_logs TO authenticated;
REVOKE ALL ON public.disbursements FROM anon, authenticated;
GRANT SELECT (id, deal_id, dispute_id, recipient_id, kind, amount, currency, status, created_at, completed_at) ON public.disbursements TO authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_seller_payout
  ON public.disbursements(deal_id, kind)
  WHERE kind = 'seller_payout' AND status IN ('pending', 'processing', 'succeeded');

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_buyer_refund
  ON public.disbursements(deal_id, kind)
  WHERE kind = 'buyer_refund' AND status IN ('pending', 'processing', 'succeeded');

CREATE OR REPLACE FUNCTION public.queue_expired_fidulync_settlements()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  due_row record;
  payout_amount numeric(14, 2);
  queued_count integer := 0;
BEGIN
  FOR due_row IN
    SELECT id, amount, seller_fee, currency, seller_id
    FROM public.escrow_deals
    WHERE status = 'funded'
      AND inspection_deadline IS NOT NULL
      AND inspection_deadline <= now()
    ORDER BY inspection_deadline
    FOR UPDATE SKIP LOCKED
    LIMIT 100
  LOOP
    payout_amount := GREATEST(0, due_row.amount - due_row.seller_fee);
    IF payout_amount <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.escrow_deals
    SET status = 'settling', updated_at = now()
    WHERE id = due_row.id AND status = 'funded';

    IF FOUND THEN
      INSERT INTO public.disbursements (
        deal_id, recipient_id, kind, amount, currency, status, audit_metadata
      )
      VALUES (
        due_row.id, due_row.seller_id, 'seller_payout', payout_amount,
        due_row.currency, 'pending', jsonb_build_object('source', 'hourly_settlement')
      );
      queued_count := queued_count + 1;
    END IF;
  END LOOP;

  RETURN queued_count;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_expired_fidulync_settlements() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_expired_fidulync_settlements() TO service_role;

CREATE OR REPLACE FUNCTION public.freeze_fidulync_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.escrow_deals
  SET status = 'disputed',
      dispute_frozen_at = now(),
      updated_at = now()
  WHERE id = NEW.deal_id AND status = 'funded';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only funded escrow deals can be disputed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_fidulync_deal_on_dispute ON public.disputes;
CREATE TRIGGER freeze_fidulync_deal_on_dispute
AFTER INSERT ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.freeze_fidulync_dispute();

CREATE OR REPLACE FUNCTION public.resolve_fidulync_dispute(
  p_dispute_id uuid,
  p_admin_id uuid,
  p_action text,
  p_seller_amount numeric DEFAULT 0,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dispute_row public.disputes%ROWTYPE;
  deal_row public.escrow_deals%ROWTYPE;
  buyer_refund numeric(14, 2);
  seller_payout numeric(14, 2);
BEGIN
  IF p_action NOT IN ('release_to_seller', 'refund_to_buyer', 'split') THEN
    RAISE EXCEPTION 'Invalid dispute resolution action';
  END IF;

  SELECT * INTO dispute_row
  FROM public.disputes
  WHERE id = p_dispute_id
  FOR UPDATE;

  IF NOT FOUND OR dispute_row.status <> 'under_review' THEN
    RAISE EXCEPTION 'Dispute is not awaiting review';
  END IF;

  SELECT * INTO deal_row
  FROM public.escrow_deals
  WHERE id = dispute_row.deal_id
  FOR UPDATE;

  IF NOT FOUND OR deal_row.status <> 'disputed' THEN
    RAISE EXCEPTION 'Escrow funds are not frozen for this dispute';
  END IF;

  IF p_action = 'release_to_seller' THEN
    seller_payout := GREATEST(0, deal_row.amount - deal_row.seller_fee);
    buyer_refund := 0;
  ELSIF p_action = 'refund_to_buyer' THEN
    seller_payout := 0;
    buyer_refund := deal_row.amount + deal_row.buyer_fee;
  ELSE
    IF p_seller_amount IS NULL OR p_seller_amount < 0 OR p_seller_amount > deal_row.amount - deal_row.seller_fee THEN
      RAISE EXCEPTION 'Seller split amount is outside the available escrow balance';
    END IF;
    seller_payout := round(p_seller_amount, 2);
    buyer_refund := GREATEST(
      0,
      deal_row.amount + deal_row.buyer_fee - deal_row.platform_fee - seller_payout
    );
  END IF;

  INSERT INTO public.payout_audit_logs (deal_id, dispute_id, admin_id, action, notes, amounts)
  VALUES (
    deal_row.id,
    dispute_row.id,
    p_admin_id,
    p_action,
    left(COALESCE(p_notes, ''), 2000),
    jsonb_build_object('seller_payout', seller_payout, 'buyer_refund', buyer_refund, 'currency', deal_row.currency)
  );

  IF seller_payout > 0 THEN
    INSERT INTO public.disbursements (deal_id, dispute_id, recipient_id, kind, amount, currency, status, audit_metadata)
    VALUES (deal_row.id, dispute_row.id, deal_row.seller_id, 'seller_payout', seller_payout, deal_row.currency, 'pending',
      jsonb_build_object('source', 'dispute_arbitration', 'action', p_action));
  END IF;

  IF buyer_refund > 0 THEN
    INSERT INTO public.disbursements (deal_id, dispute_id, recipient_id, kind, amount, currency, status, audit_metadata)
    VALUES (deal_row.id, dispute_row.id, deal_row.buyer_id, 'buyer_refund', buyer_refund, deal_row.currency, 'pending',
      jsonb_build_object('source', 'dispute_arbitration', 'action', p_action));
  END IF;

  UPDATE public.disputes
  SET status = CASE p_action
        WHEN 'release_to_seller' THEN 'released_to_seller'
        WHEN 'refund_to_buyer' THEN 'refunded_to_buyer'
        ELSE 'split'
      END,
      admin_notes = left(COALESCE(p_notes, ''), 2000),
      resolved_by = p_admin_id,
      resolved_at = now(),
      resolution = jsonb_build_object('seller_payout', seller_payout, 'buyer_refund', buyer_refund, 'currency', deal_row.currency),
      updated_at = now()
  WHERE id = dispute_row.id;

  RETURN jsonb_build_object(
    'dispute_id', dispute_row.id,
    'status', CASE p_action
      WHEN 'release_to_seller' THEN 'released_to_seller'
      WHEN 'refund_to_buyer' THEN 'refunded_to_buyer'
      ELSE 'split'
    END,
    'seller_payout', seller_payout,
    'buyer_refund', buyer_refund
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_fidulync_dispute(uuid, uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_fidulync_dispute(uuid, uuid, text, numeric, text) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispute-evidence',
  'dispute-evidence',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;

DROP POLICY IF EXISTS "Upload Dispute Evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload dispute evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read dispute evidence" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders and Involved Parties View Proof" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Users Upload Evidence" ON storage.objects;
DROP POLICY IF EXISTS dispute_evidence_upload_owner_folder ON storage.objects;
DROP POLICY IF EXISTS dispute_evidence_read_authenticated ON storage.objects;
CREATE POLICY dispute_evidence_upload_owner_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
CREATE POLICY dispute_evidence_read_authenticated ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR lower(COALESCE(auth.jwt() ->> 'email', '')) IN ('fidulync@gmail.com', 'ricorapier@yahoo.com')
    )
  );
