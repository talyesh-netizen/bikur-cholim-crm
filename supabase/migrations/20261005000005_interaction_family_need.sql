-- What a family needed, picked (optionally) when logging Family support
-- (director-approved, Oct 5 2026). Existing rows stay null.
alter table public.interactions add column if not exists family_need text;
alter table public.interactions add constraint interactions_family_need_check
  check (family_need is null or family_need in ('update', 'emotional_support', 'referral', 'finding_care', 'other'));
