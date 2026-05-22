-- Stripe Payment Link pro Rechnung — instant payment + webhook
-- Stand 2026-04-27

alter table public.invoices
  add column if not exists stripe_payment_link_id text,
  add column if not exists stripe_payment_link_url text,
  add column if not exists stripe_payment_link_created_at timestamptz;

create index if not exists invoices_stripe_link_idx
  on public.invoices (stripe_payment_link_id)
  where stripe_payment_link_id is not null;

comment on column public.invoices.stripe_payment_link_url is
  'Public Stripe Payment Link URL (https://buy.stripe.com/...) — wird in Rechnungs-PDF + Email eingefügt. Beim Bezahlen feuert Stripe checkout.session.completed-Webhook → auto-Zahlung wird angelegt.';
