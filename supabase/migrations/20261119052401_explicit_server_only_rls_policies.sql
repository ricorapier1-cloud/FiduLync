do $$
declare r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = true
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = n.nspname and p.tablename = c.relname
      )
  loop
    execute format(
      'create policy %I on %I.%I for all to anon, authenticated using (false) with check (false)',
      'deny_client_access_server_only', r.schema_name, r.table_name
    );
  end loop;
end
$$;
