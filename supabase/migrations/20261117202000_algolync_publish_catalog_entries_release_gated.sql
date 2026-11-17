update public.ea_products set is_active=true,updated_at=now()
where slug in ('eridam-nexus-pro','velocity-vault','macro-atr-breakout');
