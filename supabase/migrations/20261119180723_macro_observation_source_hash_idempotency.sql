alter table public.macro_observations alter column source_hash set not null;
alter table public.macro_observations add constraint macro_observations_source_hash_key unique (source_hash);
