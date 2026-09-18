export const directoryTypes = {
 promoters: {title:'Promotoras',singular:'promotora',description:'Tu equipo de campo: ciudades, contacto y tarifas de referencia.'},
 clients: {title:'Clientes',singular:'cliente',description:'Quién contrata a tu agencia y con quién coordinar cada trabajo.'},
 brands: {title:'Marcas',singular:'marca',description:'Las marcas que representas y el cliente al que pertenecen.'}
};
export function moneyToCents(value) {
 const text=String(value??'').trim().replace(',','.');
 if(!text)return null;
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(text))throw Error('La tarifa debe ser positiva o cero y tener hasta dos decimales.');
 const [whole,fraction='']=text.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export function directoryPayload(type, values) {
 if(!Object.hasOwn(directoryTypes,type))throw Error('Directorio no válido.');
 const read=(key,max,required=false)=>{const v=String(values[key]??'').trim();if(v.length>max||(required&&!v))throw Error('Revisa los campos obligatorios y su longitud.');return v;};
 const result={name:read('name',120,true),archived:values.archived===true||values.archived==='true'};
 if(result.name.length<2)throw Error('El nombre debe tener al menos dos caracteres.');
 if(type==='brands'){result.client_id=values.client_id||null;if(result.client_id&&!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.client_id))throw Error('Selecciona un cliente válido.');}
 else {
  result.phone=read('phone',40);result.email=read('email',254);
  if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw Error('Revisa el correo electrónico.');
  if(type==='clients')result.contact_name=read('contact_name',120);
  else {result.city=read('city',120,true);result.availability=read('availability',500);result.rate_cents=moneyToCents(values.rate);result.currency=values.currency||'USD';if(!['USD','VES'].includes(result.currency))throw Error('Moneda no válida.');}
 }
 return result;
}
export function directoryAPI(client) {
 const table=type=>{if(!Object.hasOwn(directoryTypes,type))throw Error('Directorio no válido.');return client.from(type);};
 const unwrap=r=>{if(r.error)throw r.error;return r.data;};
 return {
  async list(type,agency){
   const rows=[];for(let page=0;;page++){const batch=unwrap(await table(type).select('*').eq('agency_id',agency).order('id').range(page*500,page*500+499));rows.push(...batch);if(batch.length<500)return rows;}
  },
  async save(type,agency,id,revision,values){
   const payload=directoryPayload(type,values);
   const query=revision===null?table(type).insert({...payload,id,agency_id:agency}):table(type).update(payload).eq('agency_id',agency).eq('id',id).eq('revision',revision);
   const row=unwrap(await query.select().maybeSingle());
   if(!row)throw Error('La ficha cambió o ya no tienes acceso. Vuelve al directorio y abre la versión actual antes de guardar.');
   return row;
  }
 };
}
