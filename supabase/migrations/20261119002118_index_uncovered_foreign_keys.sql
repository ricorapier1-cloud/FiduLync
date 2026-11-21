create index if not exists ea_demo_trials_ea_slug_fk_idx on public.ea_demo_trials (ea_slug);
create index if not exists ea_license_seats_ea_slug_fk_idx on public.ea_license_seats (ea_slug);
create index if not exists ea_subscription_intents_ea_slug_fk_idx on public.ea_subscription_intents (ea_slug);
create index if not exists ea_subscription_payments_subscription_id_fk_idx on public.ea_subscription_payments (subscription_id);
create index if not exists ea_subscriptions_ea_slug_fk_idx on public.ea_subscriptions (ea_slug);
