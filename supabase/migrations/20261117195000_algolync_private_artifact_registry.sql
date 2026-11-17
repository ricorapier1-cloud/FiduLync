insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('algolync-artifacts','algolync-artifacts',false,52428800,array['application/octet-stream','application/x-msdownload'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.ea_product_artifacts (
 ea_slug text primary key references public.ea_products(slug) on delete cascade,
 storage_path text not null,
 sha256 text not null check(sha256 ~ '^[A-Fa-f0-9]{64}$'),
 size_bytes bigint not null check(size_bytes>0),
 artifact_version text not null,
 release_approved boolean not null default false,
 approved_at timestamptz,
 updated_at timestamptz not null default now(),
 check(not release_approved or approved_at is not null)
);
alter table public.ea_product_artifacts enable row level security;
revoke all on public.ea_product_artifacts from anon,authenticated;
