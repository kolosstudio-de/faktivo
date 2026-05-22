-- Email-Templates für Rechnungs-Versand
-- Stand 2026-04-27

alter table public.settings
  add column if not exists email_template_invoice_subject text,
  add column if not exists email_template_invoice_body text,
  add column if not exists email_template_mahnung_subject text,
  add column if not exists email_template_mahnung_body text;

comment on column public.settings.email_template_invoice_body is
  'Markdown/Text-Vorlage mit Variablen: {{invoice_number}}, {{client_name}}, {{amount}}, {{due_date}}, {{iban}}, {{sender_name}}';
