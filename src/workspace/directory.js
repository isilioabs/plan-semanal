import {directoryTypes,directoryAPI} from './directory-data.mjs';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(label,name,value='',extra='')=>`<label>${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export async function mountDirectory({type,agency,client,shell,active,notice}) {
 const api=directoryAPI(client),meta=directoryTypes[type];
 shell('<p class="loading" role="status">Cargando directorio…</p>',meta.title);
 const [rows,clients]=await Promise.all([api.list(type,agency),type==='brands'?api.list('clients',agency):Promise.resolve([])]);
 if(!active())return null;
 rows.sort((a,b)=>a.name.localeCompare(b.name,'es'));
 let dirty=false,busy=false,editing=null,query='',status='active';
 const controller={dirty:()=>dirty,pending:()=>busy};
 function render(focus=false) {
  shell(`<section class="directory"><div class="directory-heading"><div><h2>${meta.title}</h2><p class="muted">${meta.description}</p></div><button class="primary" data-dir="new">Añadir ${meta.singular}</button></div><div class="directory-tools"><label>Buscar<input type="search" id="directory-search" placeholder="${type==='promoters'?'Nombre, ciudad o contacto':'Nombre o contacto'}" value="${esc(query)}"></label><label>Mostrar<select id="directory-status"><option value="active">Activas</option><option value="archived">Archivadas</option><option value="all">Todas</option></select></label></div><p id="directory-count" class="hint" role="status"></p><div id="directory-rows"></div><p class="directory-note">${type==='promoters'?'Las fichas no crean cuentas ni conceden acceso. La disponibilidad es una nota de referencia; los turnos se gestionarán en el siguiente bloque.':'Estos directorios son la base de las próximas activaciones. El plan semanal existente conserva sus datos actuales.'}</p></section>`,meta.title);
  const section=document.querySelector('.directory');
  section.querySelector('#directory-status').value=status;
  section.querySelector('#directory-search').oninput=e=>{query=e.target.value;renderRows();};
  section.querySelector('#directory-status').onchange=e=>{status=e.target.value;renderRows();};
  section.onclick=e=>{const button=e.target.closest('[data-dir]');if(!button)return;if(button.dataset.dir==='new')edit(null);else if(button.dataset.dir==='edit')edit(rows.find(r=>r.id===button.dataset.id));};
  renderRows();if(focus)section.querySelector('[data-dir=new]').focus();
 }
 function renderRows(){
  const filtered=rows.filter(r=>(status==='all'||r.archived===(status==='archived'))&&normalize([r.name,r.city,r.phone,r.email,r.contact_name,clients.find(c=>c.id===r.client_id)?.name].join(' ')).includes(normalize(query)));
  document.querySelector('#directory-count').textContent=`${filtered.length} de ${rows.length} fichas`;
  document.querySelector('#directory-rows').innerHTML=filtered.length?`<ul class="directory-list">${filtered.map(r=>{
   const detail=type==='promoters'?r.city:type==='clients'?(r.contact_name||'Contacto por completar'):(clients.find(c=>c.id===r.client_id)?.name||'Sin cliente asociado');
   const rate=type==='promoters'?(r.rate_cents===null?'Tarifa por definir':new Intl.NumberFormat('es-VE',{style:'currency',currency:r.currency}).format(r.rate_cents/100)+' / hora'):'';
   return `<li><div class="directory-avatar" aria-hidden="true">${esc(r.name.slice(0,1).toUpperCase())}</div><div class="directory-person"><strong>${esc(r.name)}</strong><span>${esc(detail)}</span>${r.phone||r.email?`<small>${esc([r.phone,r.email].filter(Boolean).join(' · '))}</small>`:''}</div><div class="directory-meta">${rate?`<span>${esc(rate)}</span>`:''}${r.archived?'<span class="badge">Archivada</span>':''}</div><button data-dir="edit" data-id="${r.id}" aria-label="Editar ${esc(r.name)}">Editar</button></li>`;
  }).join('')}</ul>`:`<div class="directory-empty"><h3>${rows.length?'No hay coincidencias':'Empieza con tu primera ficha'}</h3><p>${rows.length?'Prueba otra búsqueda o cambia el filtro.':`Añade una ficha de ${meta.singular} para tener su información a mano cuando organices el trabajo.`}</p></div>`;
 }
 function edit(row){
  editing=row;const id=row?.id||crypto.randomUUID();
  shell(`<section class="directory"><button type="button" id="directory-back">← Volver a ${meta.title.toLowerCase()}</button><div class="directory-heading"><div><h2>${row?'Editar':'Añadir'} ${meta.singular}</h2><p class="muted">${row?'Actualiza la ficha de tu agencia.':'Los campos con * son obligatorios.'}</p></div></div><form id="directory-form" class="directory-form">
  ${field('Nombre *','name',row?.name,'required minlength="2" maxlength="120" autocomplete="off"')}
  ${type==='promoters'?field('Ciudad *','city',row?.city,'required maxlength="120"'):''}
  ${type==='clients'?field('Persona de contacto','contact_name',row?.contact_name,'maxlength="120"'):''}
  ${type!=='brands'?field('Teléfono','phone',row?.phone,'type="tel" maxlength="40"')+field('Correo electrónico','email',row?.email,'type="email" maxlength="254"'):''}
  ${type==='promoters'?`${field('Tarifa de referencia por hora','rate',row?.rate_cents==null?'':(row.rate_cents/100).toFixed(2),'inputmode="decimal" placeholder="Sin definir"')}<label>Moneda<select name="currency"><option>USD</option><option>VES</option></select></label><label class="full">Disponibilidad de referencia<textarea name="availability" maxlength="500" rows="3" placeholder="Por ejemplo: tardes de lunes a viernes en Maracaibo">${esc(row?.availability)}</textarea></label><small class="full">La tarifa es orientativa; no genera pagos. Dejarla vacía significa pendiente por definir; 0 significa sin importe.</small>`:''}
  ${type==='brands'?`<label>Cliente<select name="client_id"><option value="">Sin cliente asociado</option>${clients.filter(c=>!c.archived||c.id===row?.client_id).map(c=>`<option value="${c.id}">${esc(c.name)}${c.archived?' (archivado)':''}</option>`).join('')}</select></label><small>Un cliente puede tener varias marcas. Puedes asociarlo más adelante.</small>`:''}
  ${row?'<label>Estado<select name="archived"><option value="false">Activa</option><option value="true">Archivada</option></select></label><small>Archivar conserva la ficha y su historial. Puedes volver a activarla.</small>':''}
  <div class="actions full"><button class="primary" type="submit">${row?'Guardar cambios':'Crear ficha'}</button><button type="button" id="directory-cancel">Cancelar</button></div></form></section>`,meta.title);
  const form=document.querySelector('#directory-form');
  if(type==='promoters')form.elements.currency.value=row?.currency||'USD';
  if(type==='brands')form.elements.client_id.value=row?.client_id||'';
  if(row)form.elements.archived.value=String(row.archived);
  form.oninput=()=>dirty=true;form.onchange=()=>dirty=true;
  const back=()=>{if(busy)return;if(dirty&&!window.confirm('¿Descartar los cambios sin guardar de esta ficha?'))return;dirty=false;render(true);};
  document.querySelector('#directory-back').onclick=back;document.querySelector('#directory-cancel').onclick=back;
  form.onsubmit=async event=>{
   event.preventDefault();if(busy||!active())return;busy=true;
   const controls=[...form.elements];const values=Object.fromEntries(new FormData(form));controls.forEach(c=>c.disabled=true);
   try{
    const saved=await api.save(type,agency,id,editing?.revision??null,values);
    if(!active())return;
    const index=rows.findIndex(r=>r.id===saved.id);if(index<0)rows.push(saved);else rows[index]=saved;
    rows.sort((a,b)=>a.name.localeCompare(b.name,'es'));dirty=false;query='';status=saved.archived?'archived':'active';render(true);notice('Ficha guardada en tu agencia.');
   }catch(e){if(active())notice(e.code==='23505'?'Esta ficha ya se guardó. Vuelve al directorio para comprobarla.':e.message||'No se pudo guardar. Tus cambios siguen en el formulario.',true);}
   finally{busy=false;controls.forEach(c=>c.disabled=false);}
  };
  form.elements.name.focus();
 }
 render();return controller;
}
