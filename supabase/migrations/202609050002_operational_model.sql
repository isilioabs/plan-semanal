begin;
-- Canonical entities for phases 3–6. The legacy snapshot remains intact until reviewed mapping.
create table public.clients (id uuid default gen_random_uuid(),agency_id uuid references public.agencies not null,name text not null,archived boolean not null default false,primary key(id),unique(agency_id,id));
create table public.brands (id uuid default gen_random_uuid(),agency_id uuid references public.agencies not null,name text not null,client_id uuid,primary key(id),unique(agency_id,id),foreign key(agency_id,client_id) references public.clients(agency_id,id));
create table public.chains (id uuid default gen_random_uuid(),agency_id uuid references public.agencies not null,name text not null,primary key(id),unique(agency_id,id));
create table public.venues (id uuid default gen_random_uuid(),agency_id uuid references public.agencies not null,name text not null,city text not null,chain_id uuid,address text not null default '',primary key(id),unique(agency_id,id),foreign key(agency_id,chain_id) references public.chains(agency_id,id));
create table public.campaigns (id uuid default gen_random_uuid(),agency_id uuid references public.agencies not null,name text not null,client_id uuid,archived boolean not null default false,primary key(id),unique(agency_id,id),foreign key(agency_id,client_id) references public.clients(agency_id,id));
create table public.activations (
 id uuid default gen_random_uuid(),agency_id uuid references public.agencies not null,name text not null,city text not null,campaign_id uuid,venue_id uuid,
 status text not null default 'draft' check(status in ('draft','published','completed','cancelled')),
 primary key(id),unique(agency_id,id),foreign key(agency_id,campaign_id) references public.campaigns(agency_id,id),foreign key(agency_id,venue_id) references public.venues(agency_id,id)
);
create table public.activation_brands (
 agency_id uuid not null,activation_id uuid not null,brand_id uuid not null,
 primary key(activation_id,brand_id),foreign key(agency_id,activation_id) references public.activations(agency_id,id),foreign key(agency_id,brand_id) references public.brands(agency_id,id)
);
create table public.shifts (
 id uuid default gen_random_uuid(),agency_id uuid not null,activation_id uuid not null,
 starts_at timestamptz not null,ends_at timestamptz not null,required_people integer not null default 1 check(required_people>0),
 primary key(id),unique(agency_id,id),check(ends_at>starts_at),foreign key(agency_id,activation_id) references public.activations(agency_id,id)
);
create table public.promoters (id uuid default gen_random_uuid(),agency_id uuid references public.agencies not null,user_id uuid, name text not null,city text not null,archived boolean not null default false,primary key(id),unique(agency_id,id),foreign key(agency_id,user_id) references public.agency_members(agency_id,user_id) on delete set null (user_id));
create table public.assignments (
 id uuid default gen_random_uuid(),agency_id uuid not null,shift_id uuid not null,promoter_id uuid not null,
 status text not null default 'pending' check(status in ('pending','accepted','declined','replaced','completed','cancelled')),
 pay_unit text not null default 'hour' check(pay_unit in ('hour','day','activity')),rate_cents bigint check(rate_cents>=0),currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
 primary key(id),unique(agency_id,id),unique(shift_id,promoter_id),foreign key(agency_id,shift_id) references public.shifts(agency_id,id),foreign key(agency_id,promoter_id) references public.promoters(agency_id,id)
);
create table public.receivables (
 id uuid default gen_random_uuid(),agency_id uuid not null,activation_id uuid not null,payer_id uuid not null,brand_id uuid,
 amount_cents bigint not null check(amount_cents>=0),currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),due_date date,
 primary key(id),unique(agency_id,id),foreign key(agency_id,activation_id) references public.activations(agency_id,id),foreign key(agency_id,payer_id) references public.clients(agency_id,id),foreign key(agency_id,brand_id) references public.brands(agency_id,id)
);
create table public.payables (
 id uuid default gen_random_uuid(),agency_id uuid not null,assignment_id uuid not null,
 amount_cents bigint not null check(amount_cents>=0),currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
 primary key(id),unique(agency_id,id),foreign key(agency_id,assignment_id) references public.assignments(agency_id,id)
);
create table public.settlements (
 id uuid default gen_random_uuid(),agency_id uuid not null,receivable_id uuid,payable_id uuid,
 amount_cents bigint not null check(amount_cents>0),currency text not null check(currency ~ '^[A-Z]{3}$'),paid_at timestamptz not null,reference text not null default '',
 primary key(id),check((receivable_id is null)<>(payable_id is null)),foreign key(agency_id,receivable_id) references public.receivables(agency_id,id),foreign key(agency_id,payable_id) references public.payables(agency_id,id)
);
create table public.client_campaign_access (
 agency_id uuid not null,user_id uuid not null,campaign_id uuid not null,primary key(agency_id,user_id,campaign_id),
 foreign key(agency_id,user_id) references public.agency_members(agency_id,user_id) on delete cascade,
 foreign key(agency_id,campaign_id) references public.campaigns(agency_id,id)
);
create table public.agency_files (
 id uuid default gen_random_uuid(),agency_id uuid not null references public.agencies,
 name text not null check(length(name) between 1 and 240),mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 size_bytes integer not null check(size_bytes between 1 and 10485760),city text,campaign_id uuid,
 audience text not null default 'internal' check(audience in ('internal','approved_report')),
 created_at timestamptz not null default now(),primary key(id),unique(agency_id,id),
 foreign key(agency_id,campaign_id) references public.campaigns(agency_id,id),check(audience<>'approved_report' or campaign_id is not null)
);

create function agency_private.scope_access(a uuid,c text,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.agency_members m where m.agency_id=a and m.user_id=auth.uid() and
  (m.role in ('owner','admin') or (m.role in ('coordinator','supervisor')
   and (cardinality(m.cities)=0 or c=any(m.cities)) and (cardinality(m.campaigns)=0 or p=any(m.campaigns)))))
$$;
create function agency_private.activation_access(a uuid,activity uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.activations x where x.agency_id=a and x.id=activity and agency_private.scope_access(a,x.city,x.campaign_id))
$$;
create function agency_private.file_access(a uuid,f uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.agency_files x where x.agency_id=a and x.id=f and
   (agency_private.scope_access(a,x.city,x.campaign_id) or (x.audience='approved_report' and exists(
     select 1 from public.client_campaign_access c join public.agency_members m using(agency_id,user_id)
     where c.agency_id=a and c.user_id=auth.uid() and c.campaign_id=x.campaign_id and m.role='client'))))
$$;

create function agency_private.audit_record_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare record jsonb;
begin
 record=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 perform agency_private.log((record->>'agency_id')::uuid,TG_TABLE_NAME||'.'||lower(TG_OP),jsonb_build_object('id',record->>'id'));
 return null;
end $$;
revoke all on function agency_private.audit_record_change() from public,anon,authenticated;

-- Base catalogues and all finance are management-only until their dedicated interfaces ship.
do $$ declare t text; begin
 foreach t in array array['clients','brands','chains','venues','campaigns','activations','activation_brands','shifts','promoters','assignments','receivables','payables','settlements','client_campaign_access','agency_files'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy manager_access on public.%I for all to authenticated using(agency_private.manager(agency_id)) with check(agency_private.manager(agency_id))',t);
  execute format('create index on public.%I(agency_id)',t);
  execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function agency_private.audit_record_change()',t);
 end loop;
end $$;
create policy scoped_activations on public.activations for select to authenticated using(agency_private.scope_access(agency_id,city,campaign_id));
create policy scoped_shifts on public.shifts for select to authenticated using(agency_private.activation_access(agency_id,activation_id));
create policy scoped_brands on public.activation_brands for select to authenticated using(agency_private.activation_access(agency_id,activation_id));
create policy scoped_files on public.agency_files for select to authenticated using(agency_private.file_access(agency_id,id));

revoke all on function agency_private.scope_access(uuid,text,uuid),agency_private.activation_access(uuid,uuid),agency_private.file_access(uuid,uuid) from public,anon;
grant execute on function agency_private.scope_access(uuid,text,uuid),agency_private.activation_access(uuid,uuid),agency_private.file_access(uuid,uuid) to authenticated;
commit;
