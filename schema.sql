-- 1. Profiles Table (Auth Sync & Roles)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  role text check (role in ('customer', 'admin')) default 'customer',
  created_at timestamptz default now()
);

-- 2. Escrow Deals Table
create table if not exists public.escrow_deals (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.profiles(id),
  seller_id uuid references public.profiles(id),
  buyer_phone text not null,
  seller_phone text,
  item_name text not null,
  item_description text,
  currency varchar(5) default 'NGN',
  price numeric(14, 2) not null,
  bank_name text not null,
  account_number varchar(10) not null,
  account_name text not null,
  status text check (status in ('pending_payment', 'funded_in_escrow', 'delivered', 'released', 'in_dispute', 'refunded')) default 'pending_payment',
  created_at timestamptz default now()
);

-- 3. Disputes & Evidence Table
create table if not exists public.dispute_records (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.escrow_deals(id) on delete cascade,
  raised_by uuid references public.profiles(id),
  reason text not null,
  evidence_url text,
  status text check (status in ('under_review', 'resolved_seller_paid', 'resolved_buyer_refunded')) default 'under_review',
  admin_notes text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.escrow_deals enable row level security;
alter table public.dispute_records enable row level security;

-- Open Read/Write Policies for Authenticated & Public Flow
create policy "Allow profile read" on public.profiles for select using (true);
create policy "Allow deal read" on public.escrow_deals for select using (true);
create policy "Allow deal write" on public.escrow_deals for insert with check (true);
create policy "Allow deal update" on public.escrow_deals for update using (true);
create policy "Allow dispute read" on public.dispute_records for select using (true);
create policy "Allow dispute write" on public.dispute_records for insert with check (true);
create policy "Allow dispute update" on public.dispute_records for update using (true);
