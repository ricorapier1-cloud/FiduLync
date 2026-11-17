DROP INDEX IF EXISTS public.licenses_payment_reference_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS licenses_payment_reference_uidx
  ON public.licenses (payment_reference);
