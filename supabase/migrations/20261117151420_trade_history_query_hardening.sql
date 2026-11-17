-- Add covering indexes for the active customer trade-history foreign keys.
CREATE INDEX IF NOT EXISTS trade_history_user_id_idx
  ON public.trade_history (user_id);
CREATE INDEX IF NOT EXISTS trade_ledger_license_key_idx
  ON public.trade_ledger (license_key);

-- Evaluate auth.uid() once per statement rather than once per row.
DROP POLICY IF EXISTS "Users can read own trade history" ON public.trade_history;
CREATE POLICY "Users can read own trade history"
  ON public.trade_history
  FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.uid())::text = user_id::text)
    OR ((SELECT auth.uid())::text = buyer_phone)
    OR ((SELECT auth.uid())::text = seller_account)
  );
