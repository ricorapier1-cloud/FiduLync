DROP POLICY IF EXISTS api_rate_limit_events_deny_client_access ON public.api_rate_limit_events;
CREATE POLICY api_rate_limit_events_deny_client_access
  ON public.api_rate_limit_events FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
REVOKE ALL ON public.api_rate_limit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.api_rate_limit_events TO service_role;
