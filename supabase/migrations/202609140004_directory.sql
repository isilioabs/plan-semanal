begin;
alter table public.promoters
 add column phone text not null default '',
 add column email text not null default '',
 add column availability text not null default '',
 add column rate_cents bigint check(rate_cents between 0 and 999999999),
 add column currency text not null default 'USD' check(currency in ('USD','VES'));
alter table public.clients
 add column contact_name text not null default '',
 add column phone text not null default '',
 add column email text not null default '';
alter table public.brands add column archived boolean not null default false;
create function agency_private.directory_revision() returns trigger
language plpgsql set search_path='' as $$
begin new.revision=old.revision+1; return new; end $$;
revoke all on function agency_private.directory_revision() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['promoters','clients','brands'] loop
  execute format('alter table public.%I add column revision integer not null default 1',t);
  execute format('alter table public.%I add constraint directory_name check(length(btrim(name)) between 2 and 120) not valid',t);
  execute format('create trigger directory_revision before update on public.%I for each row execute function agency_private.directory_revision()',t);
 end loop;
end $$;
alter table public.promoters add constraint directory_details check(length(city) between 1 and 120 and length(phone)<=40 and length(email)<=254 and length(availability)<=500) not valid;
alter table public.clients add constraint directory_details check(length(contact_name)<=120 and length(phone)<=40 and length(email)<=254) not valid;
-- Existing manager RLS, composite agency foreign keys and audit triggers remain in force.
notify pgrst, 'reload schema';
commit;
