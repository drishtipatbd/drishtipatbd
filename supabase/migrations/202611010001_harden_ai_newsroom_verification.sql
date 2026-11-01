-- Harden the AI newsroom verification and audit trail.
-- ADDITIVE ONLY: this migration is authored for review and has NOT been applied to Supabase.
-- Apply only after backup, staging validation, and explicit production approval.

alter table public.ai_news_queue
  add column if not exists source_evidence jsonb not null default '[]'::jsonb,
  add column if not exists confidence_score numeric(4,3) not null default 0.000,
  add column if not exists verification_method text not null default 'pending',
  add column if not exists verified_at timestamptz,
  add column if not exists auto_publish_rule text not null default 'manual_only',
  add column if not exists review_history jsonb not null default '[]'::jsonb,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null,
  add column if not exists editorial_notes text not null default '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_news_queue_source_evidence_array_check') then
    alter table public.ai_news_queue
      add constraint ai_news_queue_source_evidence_array_check
      check (jsonb_typeof(source_evidence) = 'array') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_news_queue_review_history_array_check') then
    alter table public.ai_news_queue
      add constraint ai_news_queue_review_history_array_check
      check (jsonb_typeof(review_history) = 'array') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_news_queue_confidence_range_check') then
    alter table public.ai_news_queue
      add constraint ai_news_queue_confidence_range_check
      check (confidence_score >= 0 and confidence_score <= 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_news_queue_auto_publish_rule_check') then
    alter table public.ai_news_queue
      add constraint ai_news_queue_auto_publish_rule_check
      check (auto_publish_rule in ('manual_only','live_sports','urgent_breaking','urgent_domestic','urgent_international')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_news_queue_auto_publish_guard_check') then
    alter table public.ai_news_queue
      add constraint ai_news_queue_auto_publish_guard_check
      check (
        auto_publish = false
        or (
          verification_status = 'verified'
          and jsonb_typeof(source_evidence) = 'array'
          and jsonb_array_length(source_evidence) >= 2
          and confidence_score >= 0.950
          and (
            (auto_publish_rule = 'live_sports' and news_type = 'sports')
            or (auto_publish_rule = 'urgent_breaking' and news_type = 'breaking')
            or (auto_publish_rule = 'urgent_domestic' and news_type = 'domestic')
            or (auto_publish_rule = 'urgent_international' and news_type = 'international')
          )
        )
      ) not valid;
  end if;
end $$;

create index if not exists ai_news_queue_auto_publish_idx
  on public.ai_news_queue (news_type, created_at)
  where auto_publish = true and workflow_status = 'pending';

create index if not exists ai_news_queue_verification_idx
  on public.ai_news_queue (verification_status, confidence_score, created_at desc);

comment on column public.ai_news_queue.source_evidence is
  'Array of independent source records: publisher, URL, headline, published_at, checked_at, and corroborated facts.';
comment on column public.ai_news_queue.confidence_score is
  'Calibrated verification confidence from 0.000 to 1.000; not a substitute for source evidence.';
comment on column public.ai_news_queue.auto_publish_rule is
  'Explicit policy allowlist. manual_only is the default; auto-publish requires verified status, two sources, and >=0.950 confidence.';
comment on column public.ai_news_queue.review_history is
  'Append-only editorial audit entries for approvals, rejections, corrections, and publication actions.';
