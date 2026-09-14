const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');

test('PostgreSQL: tenant isolation, roles, invitations, scope, recovery and private objects',async t=>{
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
  create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated,anon;
  grant select,insert,update,delete on storage.objects to authenticated;
 `);
 const dir=path.join(__dirname,'../supabase/migrations');
 for(const file of fs.readdirSync(dir).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 const ids=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
 for(let i=0;i<ids.length;i++)await db.query('insert into auth.users values($1,$2,$3)',[ids[i],`user${i+1}@example.test`,i===5?null:'2026-09-05']);
 const as=async i=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated');};
 const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 await as(0);const a=await scalar("select public.create_agency('Agencia A')");
 await as(1);const b=await scalar("select public.create_agency('Agencia B')");
 const empty={schemaVersion:2,eventos:[],descuentos:[],productos:[],tipos:[]};
 await t.test('known IDs cannot bypass another agency or anonymous access',async()=>{
  assert.equal((await db.query('select * from public.agency_plans where agency_id=$1',[a])).rows.length,0);
  assert.equal((await db.query('select * from public.agency_members where agency_id=$1',[a])).rows.length,0);
  await assert.rejects(db.query('select public.save_agency_plan($1,1,$2,false)',[a,empty]),/permiso/);
  await assert.rejects(db.query('update public.agency_members set role=$1 where agency_id=$2',['owner',a]),/permission denied/);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from public.agency_plans'),/permission denied/);
  await assert.rejects(db.query("select public.create_agency('No autorizada')"),/permission denied/);
 });
 await t.test('unverified email cannot create a workspace',async()=>{
  await as(5);await assert.rejects(db.query("select public.create_agency('No verificada')"),/Verifica/);
 });
 let invite;
 const token='a'.repeat(64);
 await t.test('invites bind to verified email, expire, cannot be reused or reveal hashes',async()=>{
  await as(0);invite=await scalar('select public.invite_member($1,$2,$3,$4,$5,$6)',[a,'user3@example.test','coordinator',token,['Maracaibo'],[]]);
  await assert.rejects(db.query('select token_hash from public.agency_invitations'),/permission denied/);
  await as(1);await assert.rejects(db.query('select public.accept_invitation($1)',[token]),/Invitación no disponible/);
  await as(2);assert.equal(await scalar('select public.accept_invitation($1)',[token]),a);
  await assert.rejects(db.query('select public.accept_invitation($1)',[token]),/Invitación no disponible/);
  assert.equal((await db.query('select * from public.agency_plans where agency_id=$1',[a])).rows.length,0);
  await assert.rejects(db.query('select public.invite_member($1,$2,$3,$4)',[a,'user4@example.test','admin','b'.repeat(64)]),/No puedes/);
  await as(0);const expired=await scalar('select public.invite_member($1,$2,$3,$4)',[a,'user4@example.test','client','e'.repeat(64)]);
  await db.exec('reset role');await db.query("update public.agency_invitations set expires_at=now()-interval '1 minute' where id=$1",[expired]);
  await as(3);await assert.rejects(db.query('select public.accept_invitation($1)',['e'.repeat(64)]),/Invitación no disponible/);
  await as(0);const revoked=await scalar('select public.invite_member($1,$2,$3,$4)',[a,'user4@example.test','client','f'.repeat(64)]);
  await db.query('select public.revoke_invitation($1)',[revoked]);
  await as(3);await assert.rejects(db.query('select public.accept_invitation($1)',['f'.repeat(64)]),/Invitación no disponible/);
 });
 let campaign,activity,file;
 await t.test('city and campaign restrictions combine; related entities cannot cross tenants',async()=>{
  await as(0);campaign=await scalar('insert into public.campaigns(agency_id,name) values($1,$2) returning id',[a,'Expo']);
  activity=await scalar('insert into public.activations(agency_id,name,city,campaign_id) values($1,$2,$3,$4) returning id',[a,'Stand A','Maracaibo',campaign]);
  await db.query('insert into public.activations(agency_id,name,city,campaign_id) values($1,$2,$3,$4)',[a,'Stand B','Caracas',campaign]);
  await db.query('select public.change_member($1,$2,$3,$4,$5)',[a,ids[2],'coordinator',['Maracaibo'],[campaign]]);
  await as(2);assert.equal((await db.query('select * from public.activations')).rows.length,1);
  await assert.rejects(db.query('insert into public.activations(agency_id,name,city) values($1,$2,$3)',[a,'Intrusión','Maracaibo']),/row-level security/);
  await as(1);await assert.rejects(db.query('insert into public.activations(agency_id,name,city,campaign_id) values($1,$2,$3,$4)',[b,'Cruce','Maracaibo',campaign]),/foreign key/);
 });
 await t.test('save uses revision compare-and-swap and recovery is atomic',async()=>{
  await as(0);
  const next={...empty,productos:['Prueba']};
  const result=await scalar('select public.save_agency_plan($1,1,$2,true)',[a,next]);
  assert.equal(result.revision,2);
  await assert.rejects(db.query('select public.save_agency_plan($1,1,$2,true)',[a,empty]),/Otra persona/);
  assert.deepEqual(await scalar('select data from public.plan_recovery where agency_id=$1',[a]),empty);
  assert.deepEqual(await scalar('select data from public.agency_plans where agency_id=$1',[a]),next);
  await assert.rejects(db.query('select public.save_agency_plan($1,2,$2,false)',[a,{eventos:[]}]),/Respaldo no válido/);
 });
 await t.test('private objects require both metadata and agency permission; no public read',async()=>{
  await as(0);file=await scalar('insert into public.agency_files(agency_id,name,mime_type,size_bytes,city,campaign_id) values($1,$2,$3,100,$4,$5) returning id',[a,'Informe.pdf','application/pdf','Maracaibo',campaign]);
  await db.query("insert into storage.objects(bucket_id,name) values('agency-private',$1)",[`${a}/${file}`]);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('agency-private',$1)",[`${a}/00000000-0000-4000-8000-000000000099`]),/row-level security/);
  await as(1);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('agency-private',$1)",[`${a}/${file}`]),/row-level security/);
  await as(2);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from storage.objects'),/permission denied/);
 });
 await t.test('client receives only approved explicitly shared reports, never finance',async()=>{
  await as(0);await db.query('select public.invite_member($1,$2,$3,$4)',[a,'user4@example.test','client','c'.repeat(64)]);
  await as(3);await db.query('select public.accept_invitation($1)',['c'.repeat(64)]);
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await as(0);await db.query('update public.agency_files set audience=$1 where id=$2',['approved_report',file]);
  await db.query('insert into public.client_campaign_access values($1,$2,$3)',[a,ids[3],campaign]);
  await as(3);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
  assert.equal((await db.query('select * from public.agency_plans')).rows.length,0);
  assert.equal((await db.query('select * from public.assignments')).rows.length,0);
 });
 await t.test('revocation invalidates existing identity claims and file reads',async()=>{
  await as(0);await db.query('select public.change_member($1,$2,null)',[a,ids[2]]);
  await as(2);assert.equal((await db.query('select * from public.activations')).rows.length,0);
  assert.equal((await db.query('select * from storage.objects')).rows.length,0);
  await assert.rejects(db.query('select public.save_agency_plan($1,2,$2,false)',[a,empty]),/permiso/);
 });
 await t.test('ownership is transferred atomically; admin cannot elevate itself',async()=>{
  await as(0);await db.query('select public.invite_member($1,$2,$3,$4)',[a,'user5@example.test','admin','d'.repeat(64)]);
  await as(4);await db.query('select public.accept_invitation($1)',['d'.repeat(64)]);
  await assert.rejects(db.query('select public.change_member($1,$2,$3)',[a,ids[4],'owner']),/No puedes/);
  await assert.rejects(db.query('select public.transfer_ownership($1,$2)',[a,ids[4]]),/Solo la propiedad/);
  await as(0);await db.query('select public.transfer_ownership($1,$2)',[a,ids[4]]);
  assert.equal(await scalar("select count(*)::integer from public.agency_members where agency_id=$1 and role='owner'",[a]),1);
  assert.equal(await scalar('select role from public.agency_members where agency_id=$1 and user_id=$2',[a,ids[0]]),'admin');
  await assert.rejects(db.query('select public.change_member($1,$2,null)',[a,ids[4]]),/No puedes/);
 });
});
