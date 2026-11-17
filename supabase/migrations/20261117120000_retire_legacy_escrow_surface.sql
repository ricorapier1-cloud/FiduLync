-- Retire the legacy escrow product surface without destroying financial history.
-- Populated legacy records are retained under service-role-only access for audit/retention.
-- Empty, escrow-only tables are dropped after explicit emptiness checks.

DO $$
DECLARE
  table_name text;
  empty_tables text[] := ARRAY[
    'escrow_deals',
    'escrow_vaults',
    'escrow_milestones',
    'escrow_transactions',
    'vault_events',
    'deals',
    'disputes',
    'dispute_records',
    'transaction_proofs'
  ];
BEGIN
  FOREACH table_name IN ARRAY empty_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I LIMIT 1)', table_name)
        INTO STRICT table_name;
      IF table_name::boolean THEN
        RAISE EXCEPTION 'Refusing to drop public.% because it contains records', table_name;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Preserve populated legacy transaction records, but remove every client-facing route
-- to them. No anon/authenticated/public policy or table grant remains.
DO $$
DECLARE
  table_name text;
  legacy_tables text[] := ARRAY['escrows', 'transactions'];
  policy_row record;
BEGIN
  FOREACH table_name IN ARRAY legacy_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      FOR policy_row IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = table_name
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, table_name);
      END LOOP;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
      EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_name);
      EXECUTE format(
        'COMMENT ON TABLE public.%I IS %L',
        table_name,
        'Legacy escrow data retained for historical audit/retention only. No customer-facing product access. Service-role access only.'
      );
    END IF;
  END LOOP;
END $$;

-- Remove the obsolete public evidence-upload/read policies. The private bucket is
-- intentionally left in place (currently empty) until its storage lifecycle is retired
-- through the supported Storage API.
DROP POLICY IF EXISTS "Authenticated users can read dispute evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload dispute evidence" ON storage.objects;
DROP POLICY IF EXISTS "Upload Dispute Evidence" ON storage.objects;

-- Drop only the escrow-specific tables confirmed empty before this migration.
DROP TABLE IF EXISTS
  public.transaction_proofs,
  public.dispute_records,
  public.disputes,
  public.deals,
  public.vault_events,
  public.escrow_milestones,
  public.escrow_transactions,
  public.escrow_vaults,
  public.escrow_deals
CASCADE;
