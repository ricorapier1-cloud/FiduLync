-- Server-owned tables must not grant broad SQL privileges to browser roles.
-- RLS without policies blocks row access, but does not make TRUNCATE safe.
DO $$
DECLARE
  table_name text;
  server_tables text[] := ARRAY[
    'ea_heartbeats',
    'exchange_rate_cache',
    'license_transfer_requests',
    'licenses',
    'macro_snapshots',
    'profiles',
    'store_licenses',
    'trade_history',
    'trade_ledger'
  ];
BEGIN
  FOREACH table_name IN ARRAY server_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    END IF;
  END LOOP;
END $$;

-- The only browser-readable path among these server-managed tables is the
-- row-scoped SELECT policy on a customer's own legacy trade_history records.
GRANT SELECT ON TABLE public.trade_history TO authenticated;
