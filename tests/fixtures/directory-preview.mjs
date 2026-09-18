// Isolated UI fixture: no credentials, network API or production records.
import {mountDirectory} from '../../src/workspace/directory.js';
const agency='00000000-0000-4000-8000-000000000001';
const db={promoters:[],clients:[],brands:[]};
let revision=0;
const client={from(type){
 let filters=[],payload=null,insert=false,range=null;
 const query={
  select(){return query;},eq(key,value){filters.push([key,value]);return query;},order(){return query;},
  range(from,to){range=[from,to];return query;},insert(value){payload=value;insert=true;return query;},update(value){payload=value;return query;},
  maybeSingle(){return query.then(r=>({...r,data:r.data?.[0]??null}));},
  then(resolve){
   let result;
   if(payload){
    if(insert){const row={...payload,revision:1};db[type].push(row);result=[row];}
    else {result=db[type].filter(r=>filters.every(([k,v])=>r[k]===v));result.forEach(r=>Object.assign(r,payload,{revision:r.revision+1}));}
   }else result=db[type].filter(r=>filters.every(([k,v])=>r[k]===v));
   if(range)result=result.slice(range[0],range[1]+1);
   return Promise.resolve({data:structuredClone(result),error:null}).then(resolve);
  }
 };return query;
}};
const root=document.querySelector('#app');
const shell=(content,title)=>{root.innerHTML=`<header class="masthead"><strong>Prueba aislada · ${title}</strong><span>Datos ficticios en memoria</span></header><nav class="actions" style="padding:20px"><button data-type="promoters">Promotoras</button><button data-type="clients">Clientes</button><button data-type="brands">Marcas</button></nav><main class="content"><div id="message" role="status"></div><div id="error" role="alert"></div>${content}</main>`;};
const notice=(message,error=false)=>{document.querySelector(error?'#error':'#message').textContent=message;};
async function open(type){const epoch=++revision;await mountDirectory({type,agency,client,shell,notice,active:()=>epoch===revision});}
root.addEventListener('click',event=>{const button=event.target.closest('[data-type]');if(button)open(button.dataset.type);});
open('promoters');
