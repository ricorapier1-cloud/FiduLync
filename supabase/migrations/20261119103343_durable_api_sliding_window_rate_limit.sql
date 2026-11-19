-- Durable, atomic sliding-window rate limiting for public API routes.
CREATE TABLE IF NOT EXISTS public.api_rate_limit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS api_rate_limit_events_key_time_idx
  ON public.api_rate_limit_events (key_hash, occurred_at DESC);
ALTER TABLE public.api_rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_rate_limit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.api_rate_limit_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.api_rate_limit_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_key_hash text, p_limit integer, p_window_seconds integer
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_oldest timestamptz;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$'
     OR p_limit < 1 OR p_limit > 10000
     OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate-limit arguments';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));
  DELETE FROM public.api_rate_limit_events
   WHERE key_hash = p_key_hash AND occurred_at < v_now - interval '1 day';
  SELECT count(*)::integer, min(occurred_at) INTO v_count, v_oldest
    FROM public.api_rate_limit_events
   WHERE key_hash = p_key_hash
     AND occurred_at > v_now - make_interval(secs => p_window_seconds);
  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0,
      'retry_after_seconds', greatest(1, ceil(extract(epoch FROM
        (v_oldest + make_interval(secs => p_window_seconds) - v_now)))::integer));
  END IF;
  INSERT INTO public.api_rate_limit_events(key_hash, occurred_at) VALUES (p_key_hash, v_now);
  RETURN jsonb_build_object('allowed', true, 'remaining', p_limit - v_count - 1, 'retry_after_seconds', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;
