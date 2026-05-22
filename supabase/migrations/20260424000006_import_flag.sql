-- Add is_imported flag so historical imports can be deleted/replaced
-- (real issued invoices still can't be deleted — GoBD §14c UStG).

alter table public.invoices
  add column if not exists is_imported boolean not null default false;

alter table public.quotes
  add column if not exists is_imported boolean not null default false;

-- Allow DELETE on locked invoices only when they are imports
create or replace function public.prevent_locked_invoice_delete()
returns trigger
language plpgsql
as $$
begin
  if old.locked_at is not null and coalesce(old.is_imported, false) = false then
    raise exception 'Locked invoice % cannot be deleted (GoBD). Create a Storno.', old.id
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

-- Allow deleting line items of imported invoices (triggered first on DELETE CASCADE)
create or replace function public.enforce_line_item_delete_lock()
returns trigger
language plpgsql
as $$
declare
  v_locked_at timestamptz;
  v_imported boolean;
begin
  if old.parent_kind = 'invoice' then
    select locked_at, coalesce(is_imported, false)
      into v_locked_at, v_imported
      from public.invoices
      where id = old.parent_id;
    if v_locked_at is not null and v_imported = false then
      raise exception 'Cannot delete line items of a locked invoice %', old.parent_id
        using errcode = 'check_violation';
    end if;
  end if;
  return old;
end;
$$;

-- Allow the same for UPDATE too (line items of imported invoices are editable)
create or replace function public.enforce_line_item_lock()
returns trigger
language plpgsql
as $$
declare
  v_locked_at timestamptz;
  v_imported boolean;
begin
  if new.parent_kind = 'invoice' then
    select locked_at, coalesce(is_imported, false)
      into v_locked_at, v_imported
      from public.invoices
      where id = new.parent_id;
    if v_locked_at is not null and v_imported = false then
      raise exception 'Cannot modify line items of a locked invoice %', new.parent_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
