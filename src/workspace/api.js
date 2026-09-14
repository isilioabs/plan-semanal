import { createClient } from '@supabase/supabase-js';

export function validateConfig(config) {
  if (!config.supabaseUrl && !config.supabasePublishableKey) return false;
  const url = new URL(config.supabaseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('La conexión a Supabase debe usar HTTPS.');
  const key = config.supabasePublishableKey || '';
  if (key.startsWith('sb_secret_')) throw new Error('Una clave secreta no puede incluirse en la web. Usa la clave publicable.');
  if (!key.startsWith('sb_publishable_')) {
    try { if (JSON.parse(atob(key.split('.')[1])).role !== 'anon') throw new Error(); }
    catch { throw new Error('Se necesita una clave publicable o anon; nunca service_role.'); }
  }
  return true;
}

export function createAPI(config) {
  if (!validateConfig(config)) return null;
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { flowType:'pkce', autoRefreshToken:true, persistSession:true, detectSessionInUrl:true },
    global: {
      headers: { 'X-Client-Info':'agency-planner-phase1' },
      fetch: (url,options={}) => fetch(url,{...options,signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)})
    }
  });
  const unwrap = result => { if (result.error) throw result.error; return result.data; };
  const rpc = async (name,args) => unwrap(await client.rpc(name,args));
  return {
    client, rpc,
    async agencies() {
      const {user}=unwrap(await client.auth.getUser());
      if(!user)throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
      return unwrap(await client.from('agency_members').select('agency_id,role,cities,campaigns,agencies(id,name)').eq('user_id',user.id).order('created_at'));
    },
    async plan(id) { return unwrap(await client.from('agency_plans').select('data,revision').eq('agency_id',id).single()); },
    async recovery(id) { return unwrap(await client.from('plan_recovery').select('data').eq('agency_id',id).maybeSingle()); },
    async members(id) { return unwrap(await client.from('agency_members').select('user_id,email,role,cities,campaigns').eq('agency_id',id)); },
    async invitations(id) { return unwrap(await client.from('agency_invitations').select('id,email,role,expires_at,revoked_at,accepted_at').eq('agency_id',id).order('created_at',{ascending:false}).limit(50)); },
    async audit(id) { return unwrap(await client.from('agency_audit').select('id,action,actor_id,created_at,details').eq('agency_id',id).order('id',{ascending:false}).limit(30)); },
    async save(id,revision,data,recovery) { return rpc('save_agency_plan',{p_agency:id,p_revision:revision,p_data:data,p_recovery:recovery}); }
  };
}

// A bridge is bound to one agency and one authenticated session. Never persist agency data locally.
export function createWorkspaceBridge(api, agencyId, onInvalidate = () => {}) {
  let valid = true, pending = false, revision;
  const assertActive = () => { if (!valid) throw new Error('La sesión o agencia cambió. Vuelve a abrir el plan.'); };
  return {
    get pending() { return pending; },
    invalidate() { valid = false; onInvalidate(); },
    async load() { assertActive(); const plan = await api.plan(agencyId); assertActive(); revision=plan.revision; return plan.data; },
    async recovery() { assertActive(); const result=await api.recovery(agencyId); assertActive(); return result?.data || null; },
    async save(data,recovery=false) {
      assertActive();
      if (pending) throw new Error('Espera a que termine el guardado anterior.');
      pending=true;
      try {
        const result=await api.save(agencyId,revision,data,recovery);
        assertActive(); revision=result.revision; return result.data;
      } finally { pending=false; }
    }
  };
}
