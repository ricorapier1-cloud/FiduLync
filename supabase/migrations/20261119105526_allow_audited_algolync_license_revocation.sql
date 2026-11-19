ALTER TABLE public.fidulync_owner_audit
  DROP CONSTRAINT IF EXISTS fidulync_owner_audit_action_check;
ALTER TABLE public.fidulync_owner_audit
  ADD CONSTRAINT fidulync_owner_audit_action_check
  CHECK (action = ANY (ARRAY[
    'OWNER_LIFETIME_LICENSE_ISSUED'::text,
    'MT5_INSTALLATION_CREATED'::text,
    'MT5_INSTALLATION_REVOKED'::text,
    'ALGOLYNC_LICENSE_REVOKED'::text
  ]));
