-- Tracks how the department first learned about this resident (e.g., "Rabbi
-- Kirsch, Jewish Federation Chaplaincy", "Family called directly", "Hospital
-- discharge planner"). Free text by design — referral sources are too varied
-- for a fixed list, and this is reporting/context, not a workflow gate.

alter table public.residents add column referral_source text;

comment on column public.residents.referral_source is
  'Free text: how the department first learned about this resident (a rabbi, a facility, a family call-in, another agency, etc.).';
