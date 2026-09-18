begin;

alter table public.activations
 add column client_id uuid,
 add column venue_name text not null default '',
 add column address text not null default '',
 add column notes text not null default '',
 add column revision integer not null default 1,
 add constraint activation_client foreign key(agency_id,client_id) references public.clients(agency_id,id),
 add constraint activation_details check(
  length(btrim(name)) between 2 and 120 and length(btrim(city)) between 1 and 120 and
  length(venue_name)<=160 and length(address)<=300 and length(notes)<=1000
 ) not valid;

alter table public.shifts add column revision integer not null default 1;
alter table public.assignments add column revision integer not null default 1;

create trigger activation_revision before update on public.activations
 for each row execute function agency_private.directory_revision();
create trigger shift_revision before update on public.shifts
 for each row execute function agency_private.directory_revision();
create trigger assignment_revision before update on public.assignments
 for each row execute function agency_private.directory_revision();

create function agency_private.prevent_assignment_overlap() returns trigger
language plpgsql set search_path='' as $$
declare current_start timestamptz; current_end timestamptz;
begin
 if new.status not in ('pending','accepted','completed') then return new; end if;
 select starts_at,ends_at into current_start,current_end from public.shifts
  where id=new.shift_id and agency_id=new.agency_id;
 if current_start is null then raise exception 'El turno no pertenece a esta agencia.'; end if;
 if exists(
  select 1 from public.assignments other
  join public.shifts other_shift on other_shift.agency_id=other.agency_id and other_shift.id=other.shift_id
  where other.agency_id=new.agency_id and other.promoter_id=new.promoter_id and other.id<>new.id
   and other.status in ('pending','accepted','completed')
   and tstzrange(other_shift.starts_at,other_shift.ends_at,'[)') && tstzrange(current_start,current_end,'[)')
 ) then raise exception 'La promotora ya tiene otro turno en ese horario.' using errcode='P0001'; end if;
 return new;
end $$;

create function agency_private.prevent_shift_overlap() returns trigger
language plpgsql set search_path='' as $$
begin
 if exists(
  select 1 from public.assignments current_assignment
  join public.assignments other on other.agency_id=current_assignment.agency_id and other.promoter_id=current_assignment.promoter_id and other.shift_id<>current_assignment.shift_id
  join public.shifts other_shift on other_shift.agency_id=other.agency_id and other_shift.id=other.shift_id
  where current_assignment.agency_id=new.agency_id and current_assignment.shift_id=new.id
   and current_assignment.status in ('pending','accepted','completed') and other.status in ('pending','accepted','completed')
   and tstzrange(other_shift.starts_at,other_shift.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')
 ) then raise exception 'El nuevo horario cruza asignaciones existentes.' using errcode='P0001'; end if;
 return new;
end $$;

revoke all on function agency_private.prevent_assignment_overlap(),agency_private.prevent_shift_overlap() from public,anon,authenticated;
create trigger assignment_no_overlap before insert or update of promoter_id,shift_id,status on public.assignments
 for each row execute function agency_private.prevent_assignment_overlap();
create trigger shift_no_overlap before update of starts_at,ends_at on public.shifts
 for each row execute function agency_private.prevent_shift_overlap();

create function public.save_activation(
 p_agency uuid,p_id uuid,p_revision integer,p_name text,p_city text,p_client uuid,
 p_venue_name text,p_address text,p_notes text,p_status text,p_brand_ids uuid[] default '{}'
) returns public.activations
language plpgsql security definer set search_path='' as $$
declare saved public.activations;
begin
 if not agency_private.manager(p_agency) then raise exception 'No tienes permiso para modificar esta agencia.'; end if;
 if p_id is null then raise exception 'Identificador de activación no válido.'; end if;
 if p_brand_ids is null then p_brand_ids='{}'; end if;
 if exists(
  select 1 from unnest(p_brand_ids) selected(id)
  left join public.brands brand on brand.agency_id=p_agency and brand.id=selected.id
  where brand.id is null
 ) then raise exception 'Una de las marcas no pertenece a esta agencia.'; end if;

 if p_revision is null then
  insert into public.activations(id,agency_id,name,city,client_id,venue_name,address,notes,status)
  values(p_id,p_agency,btrim(p_name),btrim(p_city),p_client,btrim(coalesce(p_venue_name,'')),btrim(coalesce(p_address,'')),btrim(coalesce(p_notes,'')),p_status)
  returning * into saved;
 else
  update public.activations set name=btrim(p_name),city=btrim(p_city),client_id=p_client,
   venue_name=btrim(coalesce(p_venue_name,'')),address=btrim(coalesce(p_address,'')),notes=btrim(coalesce(p_notes,'')),status=p_status
  where agency_id=p_agency and id=p_id and revision=p_revision returning * into saved;
  if saved.id is null then raise exception 'La activación cambió. Recarga antes de guardar.' using errcode='P0001'; end if;
 end if;

 delete from public.activation_brands where agency_id=p_agency and activation_id=p_id
  and not (brand_id=any(p_brand_ids));
 insert into public.activation_brands(agency_id,activation_id,brand_id)
  select p_agency,p_id,id from (select distinct unnest(p_brand_ids) id) selected
  on conflict(activation_id,brand_id) do nothing;
 return saved;
end $$;

revoke all on function public.save_activation(uuid,uuid,integer,text,text,uuid,text,text,text,text,uuid[]) from public,anon;
grant execute on function public.save_activation(uuid,uuid,integer,text,text,uuid,text,text,text,text,uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;
