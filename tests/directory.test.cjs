const {test}=require('node:test');
const assert=require('node:assert/strict');
test('directory rates preserve unknown and zero, reject imprecise amounts',async()=>{
 const {moneyToCents,directoryPayload}=await import('../src/workspace/directory-data.mjs');
 assert.equal(moneyToCents(''),null);assert.equal(moneyToCents('0'),0);assert.equal(moneyToCents('12,35'),1235);
 for(const invalid of ['-1','1.235','1e3','Infinity','10000000'])assert.throws(()=>moneyToCents(invalid));
 assert.throws(()=>directoryPayload('promoters',{name:'Ana',city:'  '}));
 assert.throws(()=>directoryPayload('clients',{name:'  '}));
 assert.throws(()=>directoryPayload('brands',{name:'Marca',client_id:'wrong'}));
 const record=directoryPayload('promoters',{name:' Ana ',city:' Maracaibo ',rate:'0',currency:'USD',agency_id:'intruder',user_id:'intruder'});
 assert.equal(record.name,'Ana');assert.equal(record.rate_cents,0);assert.equal(record.agency_id,undefined);assert.equal(record.user_id,undefined);
});
test('directory API scopes writes, handles stale edits and loads more than 500 records',async()=>{
 const {directoryAPI}=await import('../src/workspace/directory-data.mjs');
 const calls=[];let response={data:null,error:null};
 const client={from(type){const call={type,filters:[]};calls.push(call);const q={
  select(){return q;},eq(k,v){call.filters.push([k,v]);return q;},order(){return q;},
  range(start,end){call.range=[start,end];return Promise.resolve({data:start===0?Array.from({length:500},(_,i)=>({id:i})): [{id:500}],error:null});},
  insert(data){call.insert=data;return q;},update(data){call.update=data;return q;},maybeSingle(){return Promise.resolve(response);}
 };return q;}};
 const api=directoryAPI(client);
 assert.equal((await api.list('clients','agency-a')).length,501);
 assert.deepEqual(calls.map(c=>c.filters),[[['agency_id','agency-a']],[['agency_id','agency-a']]]);
 await assert.rejects(api.save('clients','agency-a','record-a',4,{name:'Cliente'}),/ficha cambió/);
 assert.deepEqual(calls.at(-1).filters,[['agency_id','agency-a'],['id','record-a'],['revision',4]]);
 response={data:null,error:{message:'Network error'}};
 await assert.rejects(api.save('clients','agency-a','record-a',4,{name:'Cliente'}),{message:'Network error'});
 response={data:{id:'record-b',revision:1},error:null};
 await api.save('clients','agency-a','record-b',null,{name:'Cliente',agency_id:'agency-b',revision:99});
 assert.equal(calls.at(-1).insert.agency_id,'agency-a');assert.equal(calls.at(-1).insert.revision,undefined);
});
