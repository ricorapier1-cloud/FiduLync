-- Enforce a one-to-one association between a Paystack subscription and an AlgoLync licence.
-- Existing production data was checked before applying: there are currently zero linked subscription rows.
CREATE UNIQUE INDEX IF NOT EXISTS licenses_paystack_subscription_code_unique
  ON public.licenses (paystack_subscription_code)
  WHERE paystack_subscription_code IS NOT NULL;
