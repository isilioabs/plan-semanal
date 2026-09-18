const {test}=require('node:test');
const assert=require('node:assert/strict');

const ids=Array.from({length:5},(_,index)=>`00000000-0000-4000-8000-00000000000${index+1}`);

test('activation supports several brands and validates operational fields',async()=>{
 const {activationPayload,shiftPayload,assignmentPayload}=await import('../src/workspace/operations-data.mjs');
 const activity=activationPayload({name:' Expo ',city:' Maracaibo ',status:'published',client_id:ids[0],brand_ids:[ids[1],ids[2],ids[1]],venue_name:' Hotel ',address:' Centro ',notes:' Montaje 8 am '});
 assert.deepEqual(activity.brand_ids,[ids[1],ids[2]]);assert.equal(activity.name,'Expo');assert.equal(activity.venue_name,'Hotel');
 assert.throws(()=>activationPayload({name:'A',city:'',brand_ids:['wrong']}));
 const shift=shiftPayload({starts_at:'2026-10-01T08:00:00-04:00',ends_at:'2026-10-01T12:00:00-04:00',required_people:'12'});
 assert.equal(shift.required_people,12);assert.throws(()=>shiftPayload({starts_at:'2026-10-01T12:00:00-04:00',ends_at:'2026-10-01T08:00:00-04:00',required_people:1}));
 assert.equal(assignmentPayload({promoter_id:ids[3],rate:'25,50',currency:'USD'}).rate_cents,2550);
});

test('overlap detection allows adjacent shifts and counts active coverage',async()=>{
 const {findScheduleConflict,coverage}=await import('../src/workspace/operations-data.mjs');
 const shifts=[
  {id:ids[0],starts_at:'2026-10-01T08:00:00Z',ends_at:'2026-10-01T12:00:00Z',required_people:2},
  {id:ids[1],starts_at:'2026-10-01T12:00:00Z',ends_at:'2026-10-01T16:00:00Z',required_people:1},
  {id:ids[2],starts_at:'2026-10-01T11:30:00Z',ends_at:'2026-10-01T13:00:00Z',required_people:1}
 ];
 const assignments=[{id:'a',shift_id:ids[0],promoter_id:ids[4],status:'accepted'},{id:'b',shift_id:ids[0],promoter_id:ids[3],status:'cancelled'}];
 assert.equal(findScheduleConflict({promoterId:ids[4],shiftId:ids[1],startsAt:shifts[1].starts_at,endsAt:shifts[1].ends_at,shifts,assignments}),undefined);
 assert.equal(findScheduleConflict({promoterId:ids[4],shiftId:ids[2],startsAt:shifts[2].starts_at,endsAt:shifts[2].ends_at,shifts,assignments}).id,'a');
 assert.deepEqual(coverage(shifts[0],assignments),{assigned:1,required:2,complete:false});
});

test('operations API scopes every query and uses revision compare-and-swap',async()=>{
 const {operationsAPI}=await import('../src/workspace/operations-data.mjs');
 const calls=[];
 const client={
  rpc(name,args){calls.push({name,args});return Promise.resolve({data:{id:args.p_id,revision:1},error:null});},
  from(table){const call={table,filters:[]};calls.push(call);const q={select(){return q;},eq(key,value){call.filters.push([key,value]);return q;},order(){return q;},range(){return Promise.resolve({data:[],error:null});},insert(data){call.insert=data;return q;},update(data){call.update=data;return q;},maybeSingle(){return Promise.resolve({data:{id:ids[0],revision:2},error:null});}};return q;}
 };
 const api=operationsAPI(client);await api.load('agency-a');
 assert.equal(calls.filter(call=>call.table).length,7);assert.ok(calls.filter(call=>call.table).every(call=>call.filters.some(([key,value])=>key==='agency_id'&&value==='agency-a')));
 await api.saveActivation('agency-a',ids[0],3,{name:'Expo',city:'Maracaibo',brand_ids:[ids[1]],status:'draft'});
 assert.equal(calls.at(-1).args.p_revision,3);assert.deepEqual(calls.at(-1).args.p_brand_ids,[ids[1]]);
 await api.saveShift('agency-a',ids[1],ids[2],4,{starts_at:'2026-10-01T08:00:00Z',ends_at:'2026-10-01T12:00:00Z',required_people:2});
 assert.deepEqual(calls.at(-1).filters,[['agency_id','agency-a'],['activation_id',ids[1]],['id',ids[2]],['revision',4]]);
});
