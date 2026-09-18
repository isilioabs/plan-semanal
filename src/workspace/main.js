import { createAPI, createWorkspaceBridge } from './api.js';
import { passwordRequirements, validNewPassword } from './password-policy.mjs';
import config from 'agency-config';
import {mountDirectory} from './directory.js';
import {directoryTypes} from './directory-data.mjs';
let directoryController=null;

const root=document.querySelector('#app');
const state={session:null,agencies:[],agency:null,route:'agencies',mode:'login',demo:false,epoch:0};
const roles={owner:'Propiedad',admin:'Administración',coordinator:'Coordinación',supervisor:'Supervisión',promoter:'Promotora',client:'Cliente'};
const auditLabels={'agency.created':'Agencia creada','member.invited':'Invitación creada','invitation.accepted':'Invitación aceptada','invitation.revoked':'Invitación revocada','member.revoked':'Acceso revocado','member.changed':'Permisos actualizados','ownership.transferred':'Propiedad transferida','plan.saved':'Plan guardado','plan.restored':'Respaldo restaurado','agency_files.insert':'Archivo registrado','agency_files.update':'Archivo actualizado','agency_files.delete':'Archivo retirado'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brand='<div class="brand"><img class="brand-mark" src="assets/agency-planner-logo.png" alt="" width="48" height="48">Agency Planner</div>';
const btn=(label,action,extra='')=>`<button data-action="${action}" ${extra}>${label}</button>`;
const input=(label,name,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
let api=null;
try { api=createAPI(config); } catch(e) { state.configError=e.message; }
const messages='<div id="message" role="status" aria-live="polite" class="notice"></div><div id="error" role="alert" class="notice error"></div>';
function notice(message,error=false) {
 const node=document.querySelector(error?'#error':'#message');
 if(node) node.textContent=message;
 if(!error && document.querySelector('#error')) document.querySelector('#error').textContent='';
}
function invalidate() {
 state.epoch++;
 directoryController=null;
 if(window.AGENCY_WORKSPACE) window.AGENCY_WORKSPACE.invalidate();
 window.AGENCY_WORKSPACE=null;
 document.querySelector('#planner')?.remove();
}
function confirmAction(text,transfer=false) {
 const dialog=document.querySelector('#confirm-dialog'),field=document.querySelector('#confirm-input'),accept=document.querySelector('#confirm-accept');
 document.querySelector('#confirm-text').textContent=text;
 document.querySelector('#confirm-label').hidden=!transfer;field.value='';accept.disabled=transfer;
 field.oninput=()=>{accept.disabled=transfer&&field.value!=='TRANSFERIR';};
 return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='accept'),{once:true});dialog.showModal();});
}
async function canLeave() {
 if(document.querySelector('form[data-busy]')){notice('Espera a que termine la operación actual.',true);return false;}
 if(directoryController?.pending()){notice('Espera a que termine el guardado de la ficha.',true);return false;}
 if(directoryController?.dirty()&&!await confirmAction('Tienes cambios sin guardar en esta ficha. ¿Salir y descartarlos?'))return false;
 const workspace=window.AGENCY_WORKSPACE;
 if(workspace?.pending){notice('Espera a que termine el guardado.',true);return false;}
 return !workspace?.controller?.dirty() || await confirmAction('Tienes cambios sin guardar. Descarga el borrador desde el planner si quieres conservarlo. ¿Salir y descartarlos?');
}
const manager=()=>['owner','admin'].includes(state.agency?.role);
const callbackURL=()=>new URL('app.html',location.href).href;
function authPage() {
 const signup=state.mode==='signup',reset=state.mode==='reset',password=state.mode==='password';
 root.innerHTML=`<header class="masthead">${brand}<span class="muted">Tu operación, en un mismo lugar.</span></header>
 <main id="content" class="auth-grid"><section class="intro"><img class="intro-logo" src="assets/agency-planner-logo.png" alt="" width="112" height="112"><span class="eyebrow">El espacio de tu agencia</span><h1>Todo el equipo.<br>Un mismo plan.</h1><p class="muted">Organiza activaciones, cuida los detalles y mantén a tu agencia conectada, desde donde estés.</p>
 <div class="mini-plan" aria-label="Ejemplo ilustrativo"><div class="eyebrow">Así se ve una semana en orden</div><div class="mini-row"><span class="mini-date">05</span><span>Activación en punto de venta<small>Maracaibo · Equipo asignado</small></span><span class="badge">Programada</span></div><div class="mini-row"><span class="mini-date">06</span><span>Expo de marcas<small>Varias marcas · Un mismo equipo</small></span><span class="badge">En preparación</span></div><small>Ejemplo ficticio</small></div></section>
 <section class="panel auth-panel stack">${!reset&&!password?`<nav class="auth-tabs" aria-label="Acceso">${btn('Iniciar sesión','login',`aria-current="${!signup}"`)}${btn('Crear cuenta','signup',`aria-current="${signup}"`)}</nav>`:''}
 <div><h2>${password?'Elige una nueva contraseña':reset?'Recupera tu acceso':signup?'Empieza con tu agencia':'Qué bueno tenerte aquí'}</h2><p class="muted">${password?'Actualiza la contraseña de tu cuenta.':reset?'Te enviaremos un enlace para cambiar tu contraseña.':signup?'Crea tu cuenta y después tu espacio de trabajo.':'Entra a las agencias de las que formas parte.'}</p></div>
 ${messages}${!api?`<div class="notice"><strong>Conexión pendiente</strong><br>${escape(state.configError||'Esta instalación aún necesita conectar Supabase para activar las cuentas y el guardado en la nube.')}</div>`:''}
 <form data-form="auth" class="stack">${!password?input('Correo electrónico','email','email','required autocomplete="email" maxlength="254" placeholder="tu@agencia.com"'):''}
 ${!reset?input('Contraseña','password','password',`required minlength="${signup||password?'8':'1'}" autocomplete="${signup||password?'new-password':'current-password'}" ${signup||password?'placeholder="Mínimo 8 caracteres" aria-describedby="password-requirements"':''}`):''}
 ${signup||password?`<small id="password-requirements">${passwordRequirements}</small>`:''}
 <button class="primary" ${!api?'disabled':''}>${password?'Guardar contraseña':reset?'Enviar enlace':signup?'Crear mi cuenta':'Entrar'}</button></form>
 ${!reset&&!password?`<div class="separator">o continúa con</div><div class="social">${btn('Google','google',!api||!config.providers.google?'disabled':'')}${btn('Apple','apple',!api||!config.providers.apple?'disabled':'')}</div><small>También puedes registrarte con tu correo de iCloud.${!config.providers.google||!config.providers.apple?' Los proveedores sociales pendientes se activarán al configurarlos.':''}</small>${btn('Olvidé mi contraseña','reset','class="text-button"')}`:btn('Volver al acceso','login','class="text-button"')}
 ${!api?`<div class="actions">${btn('Explorar ejemplo local','demo')}${btn('Cómo activar las cuentas','setup','class="text-button"')}</div>`:''}
 <small>Acceso gratuito. Tu cuenta puede pertenecer a varias agencias.</small><a class="login-note" href="index.html">Abrir el planner local existente</a></section></main>`;
}
function shell(content,title='Mis agencias') {
 if(!state.agency){root.innerHTML=`${state.demo?'<div class="demo-strip">Ejemplo local · Datos ficticios en memoria. No hay cuentas ni guardado en la nube.</div>':''}<header class="masthead">${brand}<div class="actions"><span class="muted">${escape(state.session?.user.email||'Demostración')}</span>${btn('Cerrar sesión','logout')}</div></header><main id="content" class="onboarding">${messages}${content}</main>`;return;}
 root.innerHTML=`${state.demo?'<div class="demo-strip">Ejemplo local · Los cambios desaparecen al recargar. No es una cuenta real.</div>':''}<div class="shell"><aside class="sidebar">${brand}<div><span class="eyebrow">Agencia actual</span><p style="margin:10px 0">${escape(state.agency.agencies.name)}</p><span class="badge">${roles[state.agency.role]}</span></div><nav aria-label="Tu agencia">${['planner',...(manager()?['promoters','clients','brands']:[]),'team','files','account'].map(r=>btn(({planner:'Plan semanal',promoters:'Promotoras',clients:'Clientes',brands:'Marcas',team:'Equipo y accesos',files:'Archivos privados',account:'Mi cuenta'})[r],r,`aria-current="${state.route===r?'page':'false'}"`)).join('')}${btn('Cambiar de agencia','agencies')}</nav><footer><span class="badge">Plan gratuito</span><p class="hint muted">Una base compartida para toda tu operación.</p></footer></aside><div class="shell-main"><header class="topbar"><h1>${escape(title)}</h1><div class="actions"><span class="muted">${escape(state.session?.user.email||'Demostración')}</span>${btn('Salir','logout')}</div></header><main id="content" class="content ${state.route==='planner'?'wide':''}">${messages}${content}</main></div></div>`;
}
function agenciesPage() {
 state.agency=null;state.route='agencies';
 shell(`<span class="eyebrow">Tu espacio de trabajo</span><h1>${state.agencies.length?'Elige dónde vas a trabajar.':'Tu agencia empieza aquí.'}</h1><p class="muted">Cada agencia tiene su propio equipo, agenda e información privada.</p><div class="workspace-grid">${state.agencies.map(m=>`<button class="agency-card" data-action="open-agency" data-id="${m.agency_id}"><span class="eyebrow">${roles[m.role]}</span><strong>${escape(m.agencies.name)}</strong><small>Entrar a la agencia →</small></button>`).join('')}
 <section class="panel stack"><div><h2>Crear una agencia</h2><p class="muted">Serás la persona propietaria y podrás invitar a tu equipo.</p></div><form class="stack" data-form="create-agency">${input('Nombre de la agencia','name','text','required minlength="2" maxlength="120" placeholder="Nombre de tu agencia"')}<button class="primary" ${state.demo?'disabled':''}>Crear espacio gratuito</button></form></section>
 <section class="panel stack"><div><h2>¿Te invitaron?</h2><p class="muted">Abre el enlace de invitación con el mismo correo al que te invitaron o pega el código aquí.</p></div><form class="stack" data-form="accept">${input('Código de invitación','token','text','required minlength="64" maxlength="200" autocomplete="off"')}<button ${state.demo?'disabled':''}>Aceptar invitación</button></form></section></div>`);
 const token=sessionStorage.getItem('agency-invitation');if(token)document.querySelector('[name=token]').value=token;
}
async function refreshAgencies() {
 if(state.demo)return;
 const epoch=state.epoch;const agencies=await api.agencies();if(epoch!==state.epoch)return;
 state.agencies=agencies;
}
async function openAgency(id) {
 invalidate(); await refreshAgencies();
 state.agency=state.agencies.find(m=>m.agency_id===id);
 if(!state.agency)throw new Error('Ya no tienes acceso a esta agencia.');
 await navigate('planner');
}
function demoAPI() {
 let data={schemaVersion:2,eventos:[],descuentos:[],productos:[],tipos:['Degustación','Protocolo']},revision=1,recovery=null;
 return {async plan(){return {data:structuredClone(data),revision};},async recovery(){return recovery?{data:recovery}:null;},async save(id,expected,next,backup){if(expected!==revision)throw new Error('El plan cambió.');if(backup)recovery=structuredClone(data);data=structuredClone(next);return {data:structuredClone(data),revision:++revision};}};
}
async function navigate(route) {
 invalidate();state.route=route;
 if(route==='agencies'){await refreshAgencies();agenciesPage();return;}
 if(route==='setup'){setupPage();return;}
 if(route==='planner'){
  if(!manager()){shell('<section class="panel"><h2>Tu acceso está preparado</h2><p>El plan histórico incluye datos económicos y está reservado a propiedad y administración. Las vistas de coordinación, campo y clientes se incorporarán en sus siguientes fases, con los permisos de tu cuenta.</p></section>','Plan semanal');return;}
  shell('<iframe id="planner" class="planner-frame" title="Plan semanal de la agencia"></iframe>','Plan semanal');
  window.AGENCY_WORKSPACE=createWorkspaceBridge(state.demo?state.demoAPI:api,state.agency.agency_id);
  window.AGENCY_WORKSPACE.demo=state.demo;
  document.querySelector('#planner').src='index.html?agency=1';return;
 }
 if(Object.hasOwn(directoryTypes,route)){
  if(!manager()){shell('<p>Esta sección requiere propiedad o administración.</p>','Acceso restringido');return;}
  if(state.demo){shell('<p>Los directorios necesitan una cuenta y una agencia conectada.</p>',directoryTypes[route].title);return;}
  const epoch=state.epoch;
  try {
   const controller=await mountDirectory({type:route,agency:state.agency.agency_id,client:api.client,shell,notice,active:()=>state.epoch===epoch});
   if(state.epoch===epoch)directoryController=controller;
  } catch(e) {
   if(state.epoch!==epoch)return;
   shell(`<section class="panel"><h2>No pudimos cargar el directorio</h2><p>Comprueba tu conexión y vuelve a intentarlo.</p>${btn('Reintentar',route)}</section>`,directoryTypes[route].title);
   notice(e.message||'No se pudo cargar el directorio.',true);
  }
  return;
 }
 if(route==='account'){
  shell(`<section class="panel stack"><div><h2>Tu cuenta, tus accesos</h2><p class="muted">${escape(state.session?.user.email||'Demostración local')}</p></div><p>Conecta otro método desde tu sesión actual. El proveedor verificará tu identidad antes de vincularlo.</p><div class="actions">${btn('Vincular Google','link-google',state.demo||!config.providers.google?'disabled':'')}${btn('Vincular Apple','link-apple',state.demo||!config.providers.apple?'disabled':'')}${btn('Cambiar contraseña','change-password',state.demo?'disabled':'')}</div><small>Apple puede utilizar un correo privado de retransmisión. Vincular desde esta cuenta evita crear espacios separados por error.</small></section>`,'Mi cuenta');return;
 }
 if(!manager()){shell('<section class="panel"><h2>Acceso restringido</h2><p>Esta sección requiere propiedad o administración.</p></section>',route==='team'?'Equipo y accesos':'Archivos privados');return;}
 shell('<p class="loading" role="status">Cargando…</p>',route==='team'?'Equipo y accesos':'Archivos privados');
 const epoch=state.epoch,id=state.agency.agency_id;
 if(route==='team'){
  const [members,invitations,audit,campaignResult]=state.demo?[[{user_id:'demo-owner',email:'equipo@ejemplo.local',role:'owner',cities:[],campaigns:[]}],[],[],{data:[]}]:await Promise.all([api.members(id),api.invitations(id),api.audit(id),api.client.from('campaigns').select('id,name').eq('agency_id',id).order('name')]);
  if(campaignResult.error)throw campaignResult.error;
  if(epoch!==state.epoch)return;state.members=members;state.campaignOptions=campaignResult.data;
  shell(`<div class="workspace-grid"><section class="panel full"><h2>Personas con acceso</h2><p class="muted">Los permisos se comprueban en cada solicitud. Revocar retira el acceso del miembro a los datos de esta agencia.</p><ul class="list">${members.map(m=>`<li><div><strong>${escape(m.email)}</strong><small>${roles[m.role]} · ${m.cities.length?escape(m.cities.join(', ')):'Todas las ciudades'}${m.campaigns.length?' · '+m.campaigns.length+' campañas':''}</small></div><div class="actions">${m.role!=='owner'&&m.user_id!==state.session?.user.id?btn('Permisos','edit-member',`data-id="${m.user_id}"`)+btn('Revocar','revoke-member',`data-id="${m.user_id}" class="danger"`)+(state.agency.role==='owner'?btn('Transferir propiedad','transfer',`data-id="${m.user_id}"`):''):''}</div></li>`).join('')}</ul></section>
 <section class="panel stack"><h2>Invitar a tu equipo</h2><form data-form="invite" class="stack">${input('Correo del miembro','email','email','required maxlength="254"')}${roleSelect()}${scopeInputs()}<button class="primary" ${state.demo?'disabled':''}>Crear enlace de invitación</button></form><small>El enlace vence en 7 días. Lo compartes tú; la app no envía correos de invitación en esta etapa.</small><div id="invite-result"></div></section>
 <section class="panel"><h2>Invitaciones</h2><ul class="list">${invitations.map(i=>`<li><div><strong>${escape(i.email)}</strong><small>${roles[i.role]} · ${i.accepted_at?'Aceptada':i.revoked_at?'Revocada':new Date(i.expires_at)<new Date()?'Vencida':'Vence '+new Date(i.expires_at).toLocaleDateString('es')}</small></div>${!i.accepted_at&&!i.revoked_at?btn('Revocar','revoke-invite',`data-id="${i.id}"`):''}</li>`).join('')||'<li>No hay invitaciones todavía.</li>'}</ul></section>
 <section class="panel full"><h2>Historial de cambios</h2><ul class="list">${audit.map(a=>`<li><div><strong>${escape(auditLabels[a.action]||'Registro operativo actualizado')}</strong><small>${new Date(a.created_at).toLocaleString('es')} · ${escape(members.find(m=>m.user_id===a.actor_id)?.email||'Miembro anterior')}</small></div></li>`).join('')||'<li>Los cambios de acceso y guardado aparecerán aquí.</li>'}</ul></section></div>`,'Equipo y accesos');
 }else if(route==='files'){
  const response=state.demo?{data:[]}:await api.client.from('agency_files').select('id,name,size_bytes,created_at').eq('agency_id',id).order('created_at',{ascending:false});if(response.error)throw response.error;if(epoch!==state.epoch)return;
  shell(`<section class="panel stack"><div><h2>Documentos de tu agencia</h2><p class="muted">Archivos internos. Cada descarga requiere una sesión con permiso.</p></div><form data-form="upload" class="stack">${input('Documento PDF o imagen · Máximo 10 MB','file','file','required accept="application/pdf,image/jpeg,image/png,image/webp"')}<button class="primary" ${state.demo?'disabled':''}>Subir archivo privado</button></form><ul class="list">${response.data.map(f=>`<li><div><strong>${escape(f.name)}</strong><small>${Math.ceil(f.size_bytes/1024)} KB · ${new Date(f.created_at).toLocaleDateString('es')}</small></div>${btn('Descargar','download-file',`data-id="${f.id}" data-name="${escape(f.name)}"`)}</li>`).join('')||'<li>Aún no hay archivos en este espacio.</li>'}</ul></section>`,'Archivos privados');
 }
}
function roleSelect(value='coordinator') {return `<label>Rol<select name="role">${Object.entries(roles).filter(([r])=>r!=='owner'&&(r!=='admin'||state.agency.role==='owner')).map(([r,n])=>`<option value="${r}" ${r===value?'selected':''}>${n}</option>`).join('')}</select></label>`;}
function scopeInputs(m={cities:[],campaigns:[]}) {
 const available=state.campaignOptions||[];
 const options=[...available,...m.campaigns.filter(id=>!available.some(c=>c.id===id)).map(id=>({id,name:'Campaña no disponible · Restricción conservada'}))];
 return `${input('Ciudades permitidas · Separadas por coma','cities','text',`value="${escape(m.cities.join(', '))}" placeholder="Vacío: todas"`)}<fieldset><legend>Campañas permitidas</legend>${options.length?options.map(c=>`<label class="check-option"><input type="checkbox" name="campaigns" value="${c.id}" ${m.campaigns.includes(c.id)?'checked':''}>${escape(c.name)}</label>`).join(''):'<small>Las campañas aparecerán aquí cuando se creen en el módulo de planificación.</small>'}<small>Sin selección: todas las campañas. Estas restricciones se aplican a coordinación y supervisión en los nuevos registros operativos.</small></fieldset>`;
}
function setupPage() {
 root.innerHTML=`<header class="masthead">${brand}${btn('Volver al acceso','login')}</header><main id="content" class="onboarding"><span class="eyebrow">Preparación de la instalación</span><h1>Conectemos tu agencia.</h1><p class="muted">El código está preparado. Estos pasos activan las cuentas reales y la base central.</p><div class="workspace-grid"><section class="panel"><div class="step-number">01</div><h2>Proyecto y datos</h2><ol class="setup-list"><li>Crea un proyecto de desarrollo en Supabase.</li><li>Ejecuta las tres migraciones SQL, en orden.</li><li>Configura la URL del sitio y las URL de retorno.</li></ol></section><section class="panel"><div class="step-number">02</div><h2>Acceso verificado</h2><ol class="setup-list"><li>Activa confirmación de correo y configura SMTP.</li><li>Configura Google y Apple con sus credenciales.</li><li>Habilita la vinculación manual de identidades.</li></ol></section><section class="panel full"><div class="step-number">03</div><h2>Conexión y comprobación</h2><p>Copia config/public.example.json a config/public.local.json. Añade la URL del proyecto y su clave publicable, y ejecuta npm run build. Las claves secretas de proveedores permanecen en Supabase.</p><p>Antes de publicar, verifica dos cuentas y dos agencias, rechazo de acceso cruzado, revocación y guardado desde otro dispositivo.</p><div class="actions">${btn('Explorar ejemplo local','demo')}<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Abrir Supabase</a></div><p class="hint muted">La guía completa está en docs/fase-1-configuracion.md dentro del proyecto.</p></section></div></main>`;
}
async function authenticated(session) {
 invalidate();state.session=session;
 if(!session){state.agency=null;state.agencies=[];state.mode='login';authPage();return;}
 if(state.mode==='password'){authPage();return;}
 root.innerHTML='<main id="content" class="loading" role="status">Abriendo tus agencias…</main>';
 try{await refreshAgencies();if(state.session?.user.id===session.user.id)agenciesPage();}catch(e){authPage();notice('No pudimos cargar tus agencias. Comprueba la conexión y las migraciones. '+e.message,true);}
}

root.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
 const action=button.dataset.action,id=button.dataset.id;
 button.disabled=true;
 try{
  if(['login','signup','reset'].includes(action)){state.mode=action;authPage();return;}
  if(action==='setup'){setupPage();return;}
  if(action==='demo'){
   invalidate();state.demo=true;state.session=null;state.demoAPI=demoAPI();state.agencies=[{agency_id:'demo',role:'owner',agencies:{id:'demo',name:'Agencia de ejemplo'}}];agenciesPage();return;
  }
  if(['google','apple','link-google','link-apple'].includes(action)){
   const provider=action.replace('link-','');const options={redirectTo:callbackURL()};
   const result=action.startsWith('link-')?await api.client.auth.linkIdentity({provider,options}):await api.client.auth.signInWithOAuth({provider,options});if(result.error)throw result.error;return;
  }
  if(action==='change-password'){state.mode='password';authPage();return;}
  if(action==='logout'){
   if(!await canLeave())return;
   invalidate();
   if(!state.demo){const result=await api.client.auth.signOut({scope:'local'});if(result.error)throw result.error;}
   state.demo=false;state.agencies=[];state.agency=null;state.session=null;state.mode='login';authPage();return;
  }
  if(action==='open-agency'){if(await canLeave())await openAgency(id);return;}
  if(['planner','promoters','clients','brands','team','files','account','agencies'].includes(action)){if(await canLeave())await navigate(action);return;}
  if(state.demo)throw new Error('Esta acción necesita una cuenta real.');
  if(action==='edit-member'){
   const member=state.members.find(m=>m.user_id===id);
   shell(`<section class="panel stack"><h2>Permisos de ${escape(member.email)}</h2><form data-form="member" data-id="${id}" class="stack">${roleSelect(member.role)}${scopeInputs(member)}<button class="primary">Guardar permisos</button></form>${btn('Volver al equipo','team')}</section>`,'Permisos del miembro');return;
  }
  if(action==='revoke-member'){
   if(await confirmAction('Esta persona perderá el acceso a la agencia. ¿Revocar su acceso?')){await api.rpc('change_member',{p_agency:state.agency.agency_id,p_user:id,p_role:null});await navigate('team');}return;
  }
  if(action==='transfer'){
   if(await confirmAction('La persona seleccionada será propietaria y tú pasarás a administración. Solo la nueva propiedad podrá revertirlo. Escribe TRANSFERIR para confirmar.',true)){
    await api.rpc('transfer_ownership',{p_agency:state.agency.agency_id,p_user:id});await openAgency(state.agency.agency_id);
   }return;
  }
  if(action==='revoke-invite'){if(await confirmAction('Este enlace dejará de permitir el acceso. ¿Revocar la invitación?')){await api.rpc('revoke_invitation',{p_id:id});await navigate('team');}return;}
  if(action==='download-file'){
   const result=await api.client.storage.from('agency-private').download(`${state.agency.agency_id}/${id}`);if(result.error)throw result.error;
   const url=URL.createObjectURL(result.data),link=document.createElement('a');link.href=url;link.download=button.dataset.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);return;
  }
 }catch(e){notice(e.message||'No se pudo completar la acción. Inténtalo de nuevo.',true);}finally{button.disabled=false;}
});
root.addEventListener('submit',async event=>{
 const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
 if(form.dataset.busy)return;form.dataset.busy='1';const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 const values=new FormData(form),kind=form.dataset.form;
 try{
  if(kind==='auth'){
   if(!api)throw new Error('Primero conecta Supabase.');
   const email=String(values.get('email')||'').trim(),password=String(values.get('password')||'');let result;
   if((state.mode==='signup'||state.mode==='password')&&!validNewPassword(password))throw new Error(passwordRequirements);
   if(state.mode==='signup')result=await api.client.auth.signUp({email,password,options:{emailRedirectTo:callbackURL()}});
   else if(state.mode==='reset')result=await api.client.auth.resetPasswordForEmail(email,{redirectTo:callbackURL()});
   else if(state.mode==='password')result=await api.client.auth.updateUser({password});
   else result=await api.client.auth.signInWithPassword({email,password});
   if(result.error)throw result.error;
   if(state.mode==='signup'){form.reset();notice('Revisa tu correo para confirmar el acceso. Si ya tienes una cuenta, inicia sesión o recupera la contraseña.');}
   else if(state.mode==='reset'){form.reset();notice('Si el correo corresponde a una cuenta, recibirás el enlace. Revisa también spam.');}
   else if(state.mode==='password'){state.mode='login';await authenticated(result.data.user?{...state.session,user:result.data.user}:state.session);notice('Contraseña actualizada.');}
   else if(result.data.session)await authenticated(result.data.session);
   return;
  }
  if(state.demo)throw new Error('Esta acción necesita una cuenta real.');
  if(kind==='create-agency'){const id=await api.rpc('create_agency',{p_name:values.get('name')});await openAgency(id);return;}
  if(kind==='accept'){const id=await api.rpc('accept_invitation',{p_token:String(values.get('token')).trim()});sessionStorage.removeItem('agency-invitation');await openAgency(id);return;}
  if(kind==='invite'||kind==='member'){
   const list=name=>String(values.get(name)||'').split(',').map(x=>x.trim()).filter(Boolean);
   const role=values.get('role'),cities=list('cities'),campaigns=values.getAll('campaigns');
   if(role==='admin'&&(cities.length||campaigns.length))throw new Error('Administración tiene acceso a toda la agencia. Vacía las restricciones o elige otro rol.');
   if(campaigns.some(x=>!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(x)))throw new Error('Cada campaña debe tener un identificador UUID válido.');
   if(kind==='member'){await api.rpc('change_member',{p_agency:state.agency.agency_id,p_user:form.dataset.id,p_role:role,p_cities:cities,p_campaigns:campaigns});await navigate('team');return;}
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
   await api.rpc('invite_member',{p_agency:state.agency.agency_id,p_email:values.get('email'),p_role:role,p_token:token,p_cities:cities,p_campaigns:campaigns});
   await navigate('team');
   const url=new URL(callbackURL());url.hash='invite='+token;
   document.querySelector('#invite-result').innerHTML=`<label>Enlace creado · Cópialo y compártelo con la persona invitada<input class="code-field" readonly value="${escape(url.href)}"></label><small>El código solo se muestra ahora. Puedes revocarlo desde Invitaciones.</small>`;return;
  }
  if(kind==='upload'){
   const file=values.get('file'),id=crypto.randomUUID(),agency=state.agency.agency_id;
   if(!file.size||file.size>10485760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Selecciona un PDF o imagen compatible de hasta 10 MB.');
   let result=await api.client.from('agency_files').insert({id,agency_id:agency,name:file.name,mime_type:file.type,size_bytes:file.size});if(result.error)throw result.error;
   result=await api.client.storage.from('agency-private').upload(`${agency}/${id}`,file,{contentType:file.type,upsert:false});
   if(result.error){await api.client.from('agency_files').delete().eq('agency_id',agency).eq('id',id);throw result.error;}
   await navigate('files');notice('Archivo guardado en el espacio privado.');return;
  }
 }catch(e){notice(e.message||'No se pudo completar la acción.',true);}finally{delete form.dataset.busy;buttons.forEach(b=>b.disabled=false);}
});
window.addEventListener('beforeunload',event=>{if(directoryController?.pending()||directoryController?.dirty()||window.AGENCY_WORKSPACE?.pending||window.AGENCY_WORKSPACE?.controller?.dirty()){event.preventDefault();event.returnValue='';}});
// Recheck membership after returning to the app and periodically. RLS denies revoked tokens immediately on every request.
async function recheckAccess(){
 if(!api||state.demo||!state.agency)return;
 const id=state.agency.agency_id;
 try{const memberships=await api.agencies();if(state.agency?.agency_id!==id)return;const current=memberships.find(m=>m.agency_id===id);
  if(!current||current.role!==state.agency.role){invalidate();state.agencies=memberships;agenciesPage();notice('Tus permisos cambiaron. Selecciona una agencia disponible.',true);}
 }catch{/* A network interruption does not claim a successful save. The next operation reports it. */}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')recheckAccess();});
setInterval(recheckAccess,60000);
const invitation=new URLSearchParams(location.hash.slice(1)).get('invite');
if(invitation&&/^[a-f0-9]{64}$/.test(invitation)){sessionStorage.setItem('agency-invitation',invitation);history.replaceState(null,'',location.pathname+location.search);}
authPage();
if(api){
 api.client.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'){invalidate();state.session=session;state.mode='password';authPage();return;}
  if(event==='SIGNED_OUT'){invalidate();state.session=null;state.agencies=[];state.agency=null;state.mode='login';authPage();return;}
  if(event==='SIGNED_IN'&&session?.user.id!==state.session?.user.id){queueMicrotask(()=>authenticated(session));}
  else if(session&&state.session?.user.id===session.user.id)state.session=session;
 });
 api.client.auth.getSession().then(({data,error})=>{if(error)throw error;if(data.session&&!state.session&&state.mode!=='password')return authenticated(data.session);}).catch(e=>notice(e.message,true));
}
