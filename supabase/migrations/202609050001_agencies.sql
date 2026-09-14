-- Apply to a NEW Supabase project. No production data or destructive resets.
begin;
create schema if not exists agency_private;
revoke all on schema agency_private from public;
grant usage on schema agency_private to authenticated;

create table public.agencies (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(trim(name)) between 2 and 120),
 created_at timestamptz not null default now()
);
create table public.agency_members (
 agency_id uuid not null references public.agencies(id),
 user_id uuid not null references auth.users(id),
 email text not null,
 role text not null check (role in ('owner','admin','coordinator','supervisor','promoter','client')),
 cities text[] not null default '{}', campaigns uuid[] not null default '{}',
 created_at timestamptz not null default now(), primary key (agency_id,user_id),
 check (role not in ('owner','admin') or (cardinality(cities)=0 and cardinality(campaigns)=0))
);
create unique index one_agency_owner on public.agency_members(agency_id) where role='owner';
create index member_user on public.agency_members(user_id);
create table public.agency_invitations (
 id uuid primary key default gen_random_uuid(), agency_id uuid not null references public.agencies(id),
 email text not null, role text not null check (role in ('admin','coordinator','supervisor','promoter','client')),
 cities text[] not null default '{}', campaigns uuid[] not null default '{}',
 token_hash text not null unique, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz, accepted_at timestamptz
);
create table public.agency_plans (
 agency_id uuid primary key references public.agencies(id), revision bigint not null default 1,
 data jsonb not null default '{"schemaVersion":2,"eventos":[],"descuentos":[],"productos":[],"tipos":[]}',
 updated_at timestamptz not null default now()
);
create table public.plan_recovery (
 agency_id uuid primary key references public.agencies(id), data jsonb not null,
 revision bigint not null, created_at timestamptz not null default now()
);
create table public.agency_audit (
 id bigint generated always as identity primary key, agency_id uuid not null references public.agencies(id),
 actor_id uuid references auth.users(id), action text not null,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);

create function agency_private.member_role(a uuid) returns text
language sql stable security definer set search_path='' as $$
 select role from public.agency_members where agency_id=a and user_id=(select auth.uid())
$$;
create function agency_private.manager(a uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(agency_private.member_role(a) in ('owner','admin'),false)
$$;
create function agency_private.verified_email() returns text
language plpgsql stable security definer set search_path='' as $$
declare e text;
begin
 select lower(email) into e from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if e is null then raise exception 'Verifica tu correo antes de continuar.' using errcode='42501'; end if;
 return e;
end $$;
create function agency_private.log(a uuid, action_name text, detail jsonb default '{}') returns void
language sql security definer set search_path='' as $$
 insert into public.agency_audit(agency_id,actor_id,action,details) values (a,auth.uid(),action_name,detail)
$$;

alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_invitations enable row level security;
alter table public.agency_plans enable row level security;
alter table public.plan_recovery enable row level security;
alter table public.agency_audit enable row level security;
revoke all on public.agencies,public.agency_members,public.agency_invitations,public.agency_plans,public.plan_recovery,public.agency_audit from anon,authenticated;
grant select on public.agencies,public.agency_members,public.agency_plans,public.plan_recovery,public.agency_audit to authenticated;
-- Never expose invitation token hashes via the API.
grant select(id,agency_id,email,role,cities,campaigns,created_by,created_at,expires_at,revoked_at,accepted_at) on public.agency_invitations to authenticated;
create policy agency_read on public.agencies for select to authenticated using (agency_private.member_role(id) is not null);
create policy member_read on public.agency_members for select to authenticated using (user_id=auth.uid() or agency_private.manager(agency_id));
create policy invitation_read on public.agency_invitations for select to authenticated using (agency_private.manager(agency_id));
-- The legacy snapshot has mixed finance/personnel data and cannot safely be city-filtered.
create policy plan_read on public.agency_plans for select to authenticated using (agency_private.manager(agency_id));
create policy recovery_read on public.plan_recovery for select to authenticated using (agency_private.manager(agency_id));
create policy audit_read on public.agency_audit for select to authenticated using (agency_private.manager(agency_id));

create function public.create_agency(p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare a uuid; e text;
begin
 e=agency_private.verified_email();
 insert into public.agencies(name) values(trim(p_name)) returning id into a;
 insert into public.agency_members(agency_id,user_id,email,role) values(a,auth.uid(),e,'owner');
 insert into public.agency_plans(agency_id) values(a);
 perform agency_private.log(a,'agency.created'); return a;
end $$;

create function public.save_agency_plan(p_agency uuid,p_revision bigint,p_data jsonb,p_recovery boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.agency_plans; result jsonb;
begin
 -- Lock membership and plan so revocation and saves have a deterministic transaction order.
 perform 1 from public.agency_members where agency_id=p_agency and user_id=auth.uid() and role in ('owner','admin') for share;
 if not found then raise exception 'No tienes permiso para guardar este plan.' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text)>10485760
    or p_data->>'schemaVersion' is distinct from '2'
    or jsonb_typeof(p_data->'eventos') is distinct from 'array'
    or jsonb_typeof(p_data->'descuentos') is distinct from 'array'
    or jsonb_typeof(p_data->'productos') is distinct from 'array' then
   raise exception 'Respaldo no válido. Se requiere formato v2 y máximo 10 MB.' using errcode='22023';
 end if;
 select * into old from public.agency_plans where agency_id=p_agency for update;
 if p_revision is null or old.revision is distinct from p_revision then
   raise exception 'Otra persona actualizó el plan. Descarga tu borrador y vuelve a abrir la agencia antes de guardar.' using errcode='40001';
 end if;
 if p_recovery then
   insert into public.plan_recovery(agency_id,data,revision) values(p_agency,old.data,old.revision)
   on conflict(agency_id) do update set data=excluded.data,revision=excluded.revision,created_at=now();
 end if;
 update public.agency_plans set data=p_data,revision=revision+1,updated_at=now() where agency_id=p_agency
 returning jsonb_build_object('data',data,'revision',revision) into result;
 perform agency_private.log(p_agency,case when p_recovery then 'plan.restored' else 'plan.saved' end,
   jsonb_build_object('revision',old.revision+1,'events',jsonb_array_length(p_data->'eventos')));
 return result;
end $$;

create function public.invite_member(p_agency uuid,p_email text,p_role text,p_token text,p_cities text[] default '{}',p_campaigns uuid[] default '{}') returns uuid
language plpgsql security definer set search_path='' as $$
declare r text; invitation uuid;
begin
 select role into r from public.agency_members where agency_id=p_agency and user_id=auth.uid() for update;
 if r is null or r not in ('owner','admin') or (p_role='admin' and r<>'owner') then
  raise exception 'No puedes invitar con este rol.' using errcode='42501'; end if;
 if p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>254
    or p_token is null or length(p_token)<64 or length(p_token)>200 then raise exception 'Invitación no válida.'; end if;
 if p_role='admin' and (cardinality(p_cities)>0 or cardinality(p_campaigns)>0) then raise exception 'Administración tiene acceso a toda la agencia.'; end if;
 insert into public.agency_invitations(agency_id,email,role,token_hash,created_by,cities,campaigns)
 values(p_agency,lower(trim(p_email)),p_role,encode(sha256(convert_to(p_token,'UTF8')),'hex'),auth.uid(),p_cities,p_campaigns) returning id into invitation;
 perform agency_private.log(p_agency,'member.invited',jsonb_build_object('invitation',invitation,'role',p_role)); return invitation;
end $$;

create function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.agency_invitations; e text;
begin
 e=agency_private.verified_email();
 select * into i from public.agency_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if i.id is null or i.revoked_at is not null or i.accepted_at is not null or i.expires_at<=now() or i.email<>e then
  raise exception 'Invitación no disponible para esta cuenta. Comprueba el correo, la vigencia o solicita una nueva.' using errcode='42501'; end if;
 -- An invitation cannot resurrect privileges of a revoked/demoted inviter.
 if not exists(select 1 from public.agency_members where agency_id=i.agency_id and user_id=i.created_by
   and (role='owner' or (role='admin' and i.role<>'admin'))) then raise exception 'La invitación perdió su autorización.' using errcode='42501'; end if;
 insert into public.agency_members(agency_id,user_id,email,role,cities,campaigns) values(i.agency_id,auth.uid(),e,i.role,i.cities,i.campaigns)
 on conflict(agency_id,user_id) do nothing;
 update public.agency_invitations set accepted_at=now() where id=i.id;
 perform agency_private.log(i.agency_id,'invitation.accepted',jsonb_build_object('invitation',i.id)); return i.agency_id;
end $$;

create function public.revoke_invitation(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare i public.agency_invitations;
begin
 select * into i from public.agency_invitations where id=p_id for update;
 if not agency_private.manager(i.agency_id) or (i.role='admin' and agency_private.member_role(i.agency_id)<>'owner') then raise exception 'Sin permiso.' using errcode='42501'; end if;
 update public.agency_invitations set revoked_at=now() where id=p_id;
 perform agency_private.log(i.agency_id,'invitation.revoked',jsonb_build_object('invitation',p_id));
end $$;

create function public.change_member(p_agency uuid,p_user uuid,p_role text,p_cities text[] default '{}',p_campaigns uuid[] default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare actor text; target text;
begin
 -- Lock the agency first to serialize membership changes, including ownership transfer.
 perform 1 from public.agencies where id=p_agency for update;
 select role into actor from public.agency_members where agency_id=p_agency and user_id=auth.uid();
 select role into target from public.agency_members where agency_id=p_agency and user_id=p_user;
 if actor is null or actor not in ('owner','admin') or target is null or target='owner' or p_role='owner'
   or p_user=auth.uid() or (actor='admin' and (target='admin' or p_role='admin')) then raise exception 'No puedes modificar este miembro.' using errcode='42501'; end if;
 if p_role is null then
  delete from public.agency_members where agency_id=p_agency and user_id=p_user;
 else
  update public.agency_members set role=p_role,cities=p_cities,campaigns=p_campaigns where agency_id=p_agency and user_id=p_user;
 end if;
 perform agency_private.log(p_agency,case when p_role is null then 'member.revoked' else 'member.changed' end,jsonb_build_object('user',p_user,'role',p_role));
end $$;

create function public.transfer_ownership(p_agency uuid,p_user uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.agencies where id=p_agency for update;
 if agency_private.member_role(p_agency) is distinct from 'owner' or p_user=auth.uid() then raise exception 'Solo la propiedad actual puede transferir.' using errcode='42501'; end if;
 if not exists(select 1 from public.agency_members where agency_id=p_agency and user_id=p_user) then raise exception 'La persona debe pertenecer a la agencia.'; end if;
 update public.agency_members set role='admin' where agency_id=p_agency and user_id=auth.uid();
 update public.agency_members set role='owner',cities='{}',campaigns='{}' where agency_id=p_agency and user_id=p_user;
 perform agency_private.log(p_agency,'ownership.transferred',jsonb_build_object('user',p_user));
end $$;

-- Private helpers are not remotely callable; grant only helpers used by RLS.
revoke all on all functions in schema agency_private from public,anon,authenticated;
grant execute on function agency_private.member_role(uuid),agency_private.manager(uuid) to authenticated;
revoke all on function public.create_agency(text),public.save_agency_plan(uuid,bigint,jsonb,boolean),public.invite_member(uuid,text,text,text,text[],uuid[]),public.accept_invitation(text),public.revoke_invitation(uuid),public.change_member(uuid,uuid,text,text[],uuid[]),public.transfer_ownership(uuid,uuid) from public,anon;
grant execute on function public.create_agency(text),public.save_agency_plan(uuid,bigint,jsonb,boolean),public.invite_member(uuid,text,text,text,text[],uuid[]),public.accept_invitation(text),public.revoke_invitation(uuid),public.change_member(uuid,uuid,text,text[],uuid[]),public.transfer_ownership(uuid,uuid) to authenticated;
commit;
