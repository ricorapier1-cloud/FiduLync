-- Prevent one MT5 login from being attached to multiple AlgoLync licences,
-- including a LIVE/DEMO cross-type race between concurrent transactions.
-- Preflight on 2026-11-19 found no duplicate non-null mt5_login assignments.
CREATE UNIQUE INDEX IF NOT EXISTS ea_license_seats_mt5_login_global_uidx
  ON public.ea_license_seats (mt5_login)
  WHERE mt5_login IS NOT NULL;
