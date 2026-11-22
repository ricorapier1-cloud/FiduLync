alter table public.mt5_risk_decisions
  add column if not exists policy_version text,
  add column if not exists estimated_risk_cash double precision not null default 0,
  add column if not exists estimated_reward_risk double precision,
  add column if not exists proposal jsonb not null default '{}'::jsonb,
  add column if not exists context_snapshot jsonb not null default '{}'::jsonb;
