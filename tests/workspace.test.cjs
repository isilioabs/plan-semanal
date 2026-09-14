const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const F=require('../src/phase0.js');
const apiSource=fs.readFileSync(path.join(__dirname,'../src/workspace/api.js'),'utf8').replace(/^import .*;\r?\n/,'').replaceAll('export function ','function ');
const {createWorkspaceBridge,validateConfig}=vm.runInNewContext(apiSource+'\n({createWorkspaceBridge,validateConfig});',{URL,atob});
test('agency selector filters the current user even when RLS allows a manager to see the whole team',async()=>{
 const filters=[];
 const query={select(){return this;},eq(...args){filters.push(args);return this;},async order(){return{data:[]};}};
 const client={auth:{getUser:async()=>({data:{user:{id:'current-user'}}})},from:()=>query};
 const createAPI=vm.runInNewContext(apiSource+'\ncreateAPI;',{URL,atob,createClient:()=>client});
 const api=createAPI({supabaseUrl:'https://demo.supabase.co',supabasePublishableKey:'sb_publishable_example'});
 await api.agencies();assert.deepEqual(filters,[['user_id','current-user']]);
});
test('browser configuration rejects secret keys and non-HTTPS remote servers',()=>{
 assert.equal(validateConfig({}),false);
 assert.equal(validateConfig({supabaseUrl:'https://demo.supabase.co',supabasePublishableKey:'sb_publishable_example'}),true);
 assert.throws(()=>validateConfig({supabaseUrl:'https://demo.supabase.co',supabasePublishableKey:'sb_secret_private'}),/secreta/);
 assert.throws(()=>validateConfig({supabaseUrl:'http://remote.example',supabasePublishableKey:'sb_publishable_example'}),/HTTPS/);
 const token='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64')+'.x';
 assert.throws(()=>validateConfig({supabaseUrl:'https://demo.supabase.co',supabasePublishableKey:token}),/publicable/);
});
test('bridge is agency-bound, advances revision only after acknowledgment and blocks duplicate saves',async()=>{
 let finish;const calls=[];
 const bridge=createWorkspaceBridge({plan:async id=>{calls.push(id);return{data:F.normalize({eventos:[]}),revision:7};},save:(...args)=>{calls.push(args);return new Promise(resolve=>finish=resolve);}},'agency-A');
 await bridge.load();const saving=bridge.save({value:1});assert.equal(bridge.pending,true);
 await assert.rejects(bridge.save({value:2}),/anterior/);assert.equal(calls[1][0],'agency-A');assert.equal(calls[1][1],7);
 finish({data:{value:1},revision:8});await saving;assert.equal(bridge.pending,false);
 const again=bridge.save({value:3});assert.equal(calls[2][1],8);finish({data:{value:3},revision:9});await again;
});
test('old agency response is discarded after session or agency invalidation',async()=>{
 let finish;const bridge=createWorkspaceBridge({plan:()=>new Promise(resolve=>finish=resolve)},'agency-A');
 const loading=bridge.load();bridge.invalidate();finish({data:{private:'A'},revision:1});await assert.rejects(loading,/sesión o agencia cambió/);
 await assert.rejects(bridge.save({}),/sesión o agencia cambió/);
});
test('cloud failure leaves editor and original data intact, never writes localStorage',async()=>{
 const component=fs.readFileSync(path.join(__dirname,'../src/component.js'),'utf8').replace('__ACTIONS__',()=>fs.readFileSync(path.join(__dirname,'../src/actions.js'),'utf8'));
 class Logic {props={};setState(update){Object.assign(this.state,typeof update==='function'?update(this.state):update);}}
 let writes=0;
 const window={PHASE0:F,PLAN_DATA:{tipos:[]},crypto:require('node:crypto').webcrypto};
 const context={DCLogic:Logic,window,localStorage:{getItem:()=>null,setItem:()=>writes++}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/data.js'),'utf8'),context);
 const C=vm.runInNewContext(component+'\nComponent;',context);const app=new C();app.boot();
 app.cloud={save:async()=>{throw new Error('conflicto de revisión');}};
 app.nuevoEv('2026-09-05');app.setEv('cliente','Marca ficticia');app.setEv('pdv','Expo');
 app.guardarEv();await new Promise(resolve=>setImmediate(resolve));
 assert.ok(app.state.ev);assert.equal(app.state.data.eventos.length,0);assert.match(app.state.error,/conflicto/);assert.equal(writes,0);assert.equal(app.saving,false);
 let ack;app.cloud.save=data=>new Promise(resolve=>ack=()=>resolve(data));app.guardarEv();await new Promise(resolve=>setImmediate(resolve));
 assert.ok(app.state.ev);assert.equal(app.state.data.eventos.length,0);ack();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(app.state.ev,null);assert.equal(app.state.data.eventos.length,1);assert.equal(writes,0);
});
