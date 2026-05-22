-- Freiberufler use personal name (first/last) instead of company_name.
-- Drop NOT NULL constraint to allow that case.

alter table public.settings
  alter column company_name drop not null;

-- Convert any '' empty strings to NULL for cleanliness
update public.settings
  set company_name = null
  where trim(coalesce(company_name, '')) = '';
