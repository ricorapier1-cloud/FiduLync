create table if not exists public.quant_model_review_events (
  id bigserial primary key,
  model_id bigint not null references public.quant_model_registry(id) on delete restrict,
  reviewer_id uuid not null,
  decision text not null check (decision in ('IN_REVIEW','APPROVED','REJECTED')),
  notes text not null,
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  evidence_digest text not null check (evidence_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists quant_model_review_events_model_created_idx
  on public.quant_model_review_events(model_id, created_at desc);
alter table public.quant_model_review_events enable row level security;
revoke all on public.quant_model_review_events from anon, authenticated;
grant select, insert on public.quant_model_review_events to service_role;
grant usage, select on sequence public.quant_model_review_events_id_seq to service_role;

create or replace function public.review_quant_model(
  p_model_id bigint,
  p_reviewer_id uuid,
  p_decision text,
  p_notes text,
  p_checklist jsonb,
  p_evidence_digest text
) returns table(id bigint, status text, reviewer_id uuid, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model public.quant_model_registry%rowtype;
  v_required text[] := array['dataset_verified','code_fingerprint_verified','walk_forward_verified',
    'out_of_sample_verified','monte_carlo_verified','cost_stress_verified','reproducibility_verified'];
  v_key text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_decision not in ('IN_REVIEW','APPROVED','REJECTED') then
    raise exception 'invalid review decision';
  end if;
  if length(trim(coalesce(p_notes,''))) < 20 then
    raise exception 'review notes must contain at least 20 characters';
  end if;
  if p_evidence_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid evidence digest';
  end if;
  select * into v_model from public.quant_model_registry where quant_model_registry.id = p_model_id for update;
  if not found then raise exception 'model not found'; end if;
  if v_model.status not in ('PENDING','IN_REVIEW') then raise exception 'model is not reviewable'; end if;
  if coalesce(v_model.evidence->>'submitted_by','') = '' then
    raise exception 'legacy submission lacks a verifiable submitter identity';
  end if;
  if (v_model.evidence->>'submitted_by')::uuid = p_reviewer_id then
    raise exception 'independent reviewer must differ from model submitter';
  end if;
  if p_decision = 'APPROVED' then
    if jsonb_typeof(p_checklist) <> 'object' then raise exception 'approval checklist required'; end if;
    foreach v_key in array v_required loop
      if coalesce((p_checklist->>v_key)::boolean, false) is not true then
        raise exception 'all independent validation checklist items must be verified';
      end if;
    end loop;
    if v_model.dataset_fingerprint is null or v_model.code_fingerprint is null then
      raise exception 'model fingerprints are required';
    end if;
  end if;
  insert into public.quant_model_review_events(model_id, reviewer_id, decision, notes, checklist, evidence_digest)
  values (p_model_id, p_reviewer_id, p_decision, trim(p_notes), coalesce(p_checklist,'{}'::jsonb), p_evidence_digest);
  return query
  update public.quant_model_registry q
    set status = p_decision,
        reviewer_id = p_reviewer_id,
        reviewed_at = case when p_decision in ('APPROVED','REJECTED') then now() else null end,
        evidence = q.evidence || jsonb_build_object('last_review_notes',trim(p_notes),'last_reviewed_by',p_reviewer_id,'last_review_decision',p_decision),
        updated_at = now()
    where q.id = p_model_id
    returning q.id, q.status, q.reviewer_id, q.reviewed_at;
end;
$$;
revoke all on function public.review_quant_model(bigint,uuid,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.review_quant_model(bigint,uuid,text,text,jsonb,text) to service_role;
