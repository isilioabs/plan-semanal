begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('agency-private','agency-private',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
-- Exact object path is agency_uuid/file_uuid. Metadata must exist before upload.
create function agency_private.object_access(object_name text,writing boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare a uuid; f uuid;
begin
 if object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$' then return false; end if;
 begin a=split_part(object_name,'/',1)::uuid; f=split_part(object_name,'/',2)::uuid;
 exception when invalid_text_representation then return false; end;
 if writing then return agency_private.manager(a) and exists(select 1 from public.agency_files where agency_id=a and id=f); end if;
 return agency_private.file_access(a,f);
end $$;
revoke all on function agency_private.object_access(text,boolean) from public,anon;
grant execute on function agency_private.object_access(text,boolean) to authenticated;
create policy agency_object_read on storage.objects for select to authenticated using(bucket_id='agency-private' and agency_private.object_access(name,false));
create policy agency_object_insert on storage.objects for insert to authenticated with check(bucket_id='agency-private' and agency_private.object_access(name,true));
create policy agency_object_delete on storage.objects for delete to authenticated using(bucket_id='agency-private' and agency_private.object_access(name,true));
-- No upserts/UPDATE: each upload is immutable, with a newly generated id.
commit;
