export const activationStatuses={draft:'Borrador',published:'Publicada',completed:'Completada',cancelled:'Cancelada'};
export const assignmentStatuses={pending:'Pendiente',accepted:'Confirmada',declined:'Rechazada',replaced:'Reemplazada',completed:'Completada',cancelled:'Cancelada'};
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const read=(value,max,required=false)=>{const text=String(value??'').trim();if(text.length>max||(required&&!text))throw Error('Revisa los campos obligatorios y su longitud.');return text;};
const uniqueUUIDs=values=>[...new Set((values||[]).filter(Boolean).map(String))];

export function activationPayload(values){
 const brand_ids=uniqueUUIDs(values.brand_ids);
 if(brand_ids.some(id=>!uuid.test(id)))throw Error('Selecciona marcas válidas.');
 const client_id=values.client_id||null;if(client_id&&!uuid.test(client_id))throw Error('Selecciona un cliente válido.');
 const status=String(values.status||'draft');if(!Object.hasOwn(activationStatuses,status))throw Error('Selecciona un estado válido.');
 return {name:read(values.name,120,true),city:read(values.city,120,true),client_id,venue_name:read(values.venue_name,160),address:read(values.address,300),notes:read(values.notes,1000),status,brand_ids};
}
export function shiftPayload(values){
 const starts=new Date(values.starts_at),ends=new Date(values.ends_at),required=Number(values.required_people);
 if(!values.starts_at||!values.ends_at||Number.isNaN(starts.valueOf())||Number.isNaN(ends.valueOf()))throw Error('Completa la fecha y hora de inicio y fin.');
 if(ends<=starts)throw Error('La hora de fin debe ser posterior al inicio.');
 if(!Number.isInteger(required)||required<1||required>500)throw Error('Los cupos deben ser un número entre 1 y 500.');
 return {starts_at:starts.toISOString(),ends_at:ends.toISOString(),required_people:required};
}
export function assignmentPayload(values){
 const promoter_id=String(values.promoter_id||'');if(!uuid.test(promoter_id))throw Error('Selecciona una promotora válida.');
 const status=String(values.status||'pending');if(!Object.hasOwn(assignmentStatuses,status))throw Error('Selecciona un estado válido.');
 const currency=String(values.currency||'USD');if(!['USD','VES'].includes(currency))throw Error('Selecciona una moneda válida.');
 const raw=String(values.rate??'').trim().replace(',','.');let rate_cents=null;
 if(raw){if(!/^\d{1,7}(\.\d{1,2})?$/.test(raw))throw Error('La tarifa debe tener hasta dos decimales.');const [whole,fraction='']=raw.split('.');rate_cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));}
 return {promoter_id,status,pay_unit:'hour',rate_cents,currency};
}
export const activeAssignment=status=>['pending','accepted','completed'].includes(status);
export function overlaps(a,b){return new Date(a.starts_at)<new Date(b.ends_at)&&new Date(b.starts_at)<new Date(a.ends_at);}
export function findScheduleConflict({promoterId,shiftId,startsAt,endsAt,shifts,assignments}){
 const candidate={starts_at:startsAt,ends_at:endsAt};
 return assignments.find(item=>item.promoter_id===promoterId&&activeAssignment(item.status)&&item.shift_id!==shiftId&&overlaps(candidate,shifts.find(shift=>shift.id===item.shift_id)||{}));
}
export function coverage(shift,assignments){
 const assigned=assignments.filter(item=>item.shift_id===shift.id&&activeAssignment(item.status)).length;
 return {assigned,required:shift.required_people,complete:assigned>=shift.required_people};
}
const unwrap=result=>{if(result.error)throw result.error;return result.data;};
const pages=async query=>{const rows=[];for(let page=0;;page++){const batch=unwrap(await query(page*500,page*500+499));rows.push(...batch);if(batch.length<500)return rows;}};
export function operationsAPI(client){
 const list=(table,agency,order='id')=>pages((start,end)=>client.from(table).select('*').eq('agency_id',agency).order(order).range(start,end));
 return {
  async load(agency){
   const [activations,links,shifts,assignments,clients,brands,promoters]=await Promise.all([
    list('activations',agency),list('activation_brands',agency,'activation_id'),list('shifts',agency,'starts_at'),list('assignments',agency,'shift_id'),list('clients',agency,'name'),list('brands',agency,'name'),list('promoters',agency,'name')
   ]);return {activations,links,shifts,assignments,clients,brands,promoters};
  },
  async saveActivation(agency,id,revision,values){
   const data=activationPayload(values);return unwrap(await client.rpc('save_activation',{p_agency:agency,p_id:id,p_revision:revision,p_name:data.name,p_city:data.city,p_client:data.client_id,p_venue_name:data.venue_name,p_address:data.address,p_notes:data.notes,p_status:data.status,p_brand_ids:data.brand_ids}));
  },
  async saveShift(agency,activation,id,revision,values){
   const data=shiftPayload(values);let query;
   if(revision==null)query=client.from('shifts').insert({...data,id,agency_id:agency,activation_id:activation});
   else query=client.from('shifts').update(data).eq('agency_id',agency).eq('activation_id',activation).eq('id',id).eq('revision',revision);
   const row=unwrap(await query.select().maybeSingle());if(!row)throw Error('El turno cambió. Recarga la activación antes de guardar.');return row;
  },
  async saveAssignment(agency,shift,id,revision,values){
   const data=assignmentPayload(values);let query;
   if(revision==null)query=client.from('assignments').insert({...data,id,agency_id:agency,shift_id:shift});
   else query=client.from('assignments').update(data).eq('agency_id',agency).eq('shift_id',shift).eq('id',id).eq('revision',revision);
   const row=unwrap(await query.select().maybeSingle());if(!row)throw Error('La asignación cambió. Recarga la activación antes de guardar.');return row;
  }
 };
}
