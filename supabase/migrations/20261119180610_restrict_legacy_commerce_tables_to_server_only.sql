do $$
declare t text;
begin
  foreach t in array array[
    'transactions','escrows','store_licenses','trade_history','licenses','ea_heartbeats',
    'trade_ledger','license_transfer_requests','ea_products','ea_demo_trials','ea_license_seats',
    'ea_marketplace_sellers','ea_marketplace_products','ea_marketplace_plans','ea_marketplace_orders',
    'ea_marketplace_entitlements','ea_marketplace_activations','ea_marketplace_payout_ledger',
    'ea_marketplace_audit_events','paystack_webhook_events','paystack_subscription_plans',
    'ea_subscription_intents','ea_subscriptions','ea_subscription_payments','ea_product_artifacts'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
      execute format('comment on table public.%I is %L', t,
        'Retained legacy commercial/escrow record for audit and retention only. Not part of the personal quant product. Browser roles have no grants; server-only service role access.');
    end if;
  end loop;
end $$;
