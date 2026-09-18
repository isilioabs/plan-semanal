  KEY = window.PHASE0.KEY;
  state = { data:null, offset:0, tab:'semana', ev:null, dsc:null, aviso:'', error:'', preview:null };
  lastRaw = null;
  originalDraft = null;
  componentDidMount() {
    this.boot();
    this.onStorage = e => {
      if (!this.cloud && (e.key === this.KEY || e.key === null)) this.setState({cambioExterno:true, aviso:'Otra pestaña cambió los datos. Recarga antes de seguir editando.'});
    };
    this.onUnload = e => { if (this.dirty()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('beforeunload', this.onUnload);
  }
  componentWillUnmount() {
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('beforeunload', this.onUnload);
  }
  boot() {
    if (window.location && new URLSearchParams(window.location.search).get('agency') === '1') {
      this.cloud = window.parent !== window ? window.parent.AGENCY_WORKSPACE : null;
      if (!this.cloud) { this.setState({error:'Abre este plan desde tu agencia.',bloqueado:true}); return; }
      this.cloud.controller = this;
      this.cloud.load().then(data => this.setState({data:window.PHASE0.normalize(data),cloud:true,demo:!!this.cloud.demo,hayRecuperacion:true}))
        .catch(e => this.setState({error:e.message,bloqueado:true}));
      return;
    }
    const F = window.PHASE0;
    let data = F.normalize({eventos:[],descuentos:[],productos:[],tipos:window.PLAN_DATA.tipos});
    let blocked = false, error = '', recovery = false;
    try {
      this.lastRaw = localStorage.getItem(this.KEY);
      if (this.lastRaw !== null) data = F.parse(this.lastRaw);
      recovery = localStorage.getItem(F.RECOVERY) !== null;
    } catch (e) {
      blocked = true;
      error = 'No se pudo leer tu información. No se ha reemplazado. Descarga el archivo actual o importa un respaldo válido. ' + (e.message || '');
    }
    this.setState({data, bloqueado:blocked, error, hayRecuperacion:recovery});
  }
  dirty() {
    const draft = this.state.ev || this.state.dsc;
    return !!draft && JSON.stringify(draft) !== this.originalDraft;
  }
  openDraft(field, value) {
    if (this.saving) return;
    const draft = window.PHASE0.clone(value);
    this.originalDraft = JSON.stringify(draft);
    this.setState({ev:null,dsc:null,preview:null,[field]:draft,error:'',nuevoProd:'',nuevoTipo:''});
  }
  ask(message, action) {
    this.confirmedAction = action;
    this.setState({confirmMessage:message});
  }
  resolveConfirm(accept) {
    const action = this.confirmedAction;
    this.confirmedAction = null;
    this.setState({confirmMessage:''});
    if (accept && action) action();
  }
  cerrar(after = () => {}) {
    if (this.saving) return;
    const close = () => {
      this.originalDraft = null;
      this.setState({ev:null,dsc:null,preview:null,error:''});
      after();
    };
    if (this.dirty()) this.ask('Tienes cambios sin guardar. ¿Quieres descartarlos?', close);
    else close();
  }
  notice(message) { this.setState({error:message,aviso:''}); }
  persist(data, recovery = false) {
    if (this.cloud) { this.notice('Guarda mediante la conexión de tu agencia.'); return false; }
    if (this.state.bloqueado && !recovery) {
      this.notice('Primero recupera un respaldo válido. La información existente sigue protegida.'); return false;
    }
    try {
      const saved = window.PHASE0.save(localStorage, data, this.lastRaw, recovery);
      this.lastRaw = saved.raw;
      this.setState({data:saved.data,error:'',aviso:'Guardado en este navegador',bloqueado:false,cambioExterno:false,hayRecuperacion:recovery || this.state.hayRecuperacion});
      return true;
    } catch (e) {
      const storageError = ['QuotaExceededError','SecurityError'].includes(e.name);
      this.notice(storageError ? 'No se pudo guardar en este navegador. Tus cambios siguen en el formulario; descarga una copia antes de cerrar.' : e.message);
      return false;
    }
  }
  commit(data, recovery = false, success = () => {}) {
    if (!this.cloud) { const ok=this.persist(data,recovery); if (ok) success(); return ok; }
    if (this.saving) { this.notice('Espera a que termine el guardado anterior.'); return false; }
    let normalized;
    try { normalized=window.PHASE0.normalize(data); } catch(e) { this.notice(e.message); return false; }
    this.saving=true;
    this.setState({saving:true,error:'',aviso:'Guardando en tu agencia…'});
    return Promise.resolve().then(() => this.cloud.save(normalized,recovery)).then(saved => {
      this.setState({data:window.PHASE0.normalize(saved),error:'',aviso:this.state.demo?'Cambio aplicado al ejemplo local':'Guardado en tu agencia',bloqueado:false});
      success(); return true;
    }).catch(e => { this.notice(e.message || 'No se pudo guardar. Conserva tu borrador y reintenta.'); return false; })
      .finally(() => { this.saving=false; this.setState({saving:false}); });
  }
  upd(fn, success = () => {}) {
    if (!this.state.data) return false;
    try {
      const next = window.PHASE0.clone(this.state.data);
      fn(next);
      return this.commit(next,false,success);
    } catch (e) { this.notice(e.message); return false; }
  }
  renombrarProducto(old, name, input) {
    const n = (name || '').trim();
    if (n === old) return;
    try {
      const next = window.PHASE0.rename(this.state.data, old, n);
      const uses = [...next.eventos,...next.descuentos].some(e => e.productos.includes(n));
      const apply = () => this.commit(next,false,() => { if (input) input.value = n; });
      if (input) input.value = old;
      if (uses) this.ask('Esta corrección de nombre se aplicará también al historial. Para un producto distinto, crea uno nuevo. ¿Corregir el nombre?', apply);
      else apply();
    } catch (e) { if (input) input.value = old; this.notice(e.message); }
  }
  borrarProducto(name) {
    this.upd(d => {
      if (!d.productosArchivados.includes(name)) d.productosArchivados.push(name);
    }, () => this.setState({aviso:'Producto archivado. Su historial se conserva; puedes reactivarlo en Archivo.'}));
  }
  reactivarProducto(name) {
    this.upd(d => { d.productosArchivados = d.productosArchivados.filter(p => p !== name); });
  }
  download(raw, prefix) {
    const blob = new Blob([raw], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = prefix + '-' + new Date().toISOString().replace(/[:.]/g,'-') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  respaldar() {
    try {
      // Export corrupt original verbatim so recovery does not lose information.
      if (this.state.bloqueado) {
        if (this.lastRaw === null) throw new Error('No se pudo leer un archivo para descargar.');
        this.download(this.lastRaw, 'recuperacion-original'); return;
      }
      const F = window.PHASE0;
      const data = F.clone(this.state.data);
      if (this.dirty()) {
        const field = this.state.ev ? 'eventos' : 'descuentos';
        const item = F.clone(this.state.ev || this.state.dsc);
        delete item.nuevo;
        const i = data[field].findIndex(x => x.id === item.id);
        if (i < 0) data[field].push(item); else data[field][i] = item;
      }
      const raw = JSON.stringify(data, null, 2);
      this.download(raw, this.dirty() ? 'borrador-plan-semanal' : 'respaldo-plan-semanal');
      this.setState({aviso:this.dirty() ? 'Copia del borrador solicitada. Revisa la descarga; puede necesitar correcciones antes de restaurarla.' : 'Descarga del respaldo solicitada. Comprueba el archivo en tus descargas.'});
    } catch (e) { this.notice(e.message); }
  }
  async restaurar(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      if (file.size > window.PHASE0.MAX_BYTES) throw new Error('El respaldo supera el límite de 10 MB.');
      const parsed = window.PHASE0.parse(await file.text());
      this.showPreview(parsed, file.name);
    } catch (e) { this.notice(e.message); }
  }
  showPreview(data, name) {
    this.cerrar(() => this.setState({preview:{data,name},error:''}));
  }
  confirmarRestauracion() {
    const preview = this.state.preview;
    if (!preview) return;
    this.commit(preview.data, true, () => {
      this.setState({preview:null,tab:'semana',q:'',offset:0,aviso:'Respaldo restaurado. La versión anterior está disponible en Recuperación anterior.'});
    });
  }
  async recuperarAnterior(download = false) {
    try {
      const remote = this.cloud ? await this.cloud.recovery() : null;
      const raw = this.cloud ? (remote ? JSON.stringify(remote) : null) : localStorage.getItem(window.PHASE0.RECOVERY);
      if (!raw) throw new Error('No hay una copia de recuperación anterior.');
      if (download) this.download(raw,'recuperacion-anterior');
      else this.showPreview(window.PHASE0.parse(raw), 'Recuperación anterior');
    } catch (e) { this.notice(e.message); }
  }
  ejemplo() {
    const F = window.PHASE0, L = window.PLANLIB;
    const date = L.ISO(new Date());
    this.showPreview(F.normalize({
      eventos:[{id:'demo-actividad-1',cliente:'Marca de ejemplo',pdv:'Punto de venta de ejemplo',fecha:date,horaIni:'09:00',horaFin:'12:00',productos:['Producto de ejemplo'],promotora:'Persona de ejemplo',monto:60,estado:'pendiente',cobro:'por_cobrar',pop:[]}],
      descuentos:[],productos:['Producto de ejemplo'],tipos:window.PLAN_DATA.tipos
    }), 'Datos ficticios de demostración');
  }
  agregarTipo() {
    const name = (this.state.nuevoTipo || '').trim();
    if (!name) return;
    const exists = this.state.data.tipos.find(t => window.PHASE0.key(t) === window.PHASE0.key(name));
    const done=() => this.setState(s => ({nuevoTipo:'',ev:s.ev ? {...s.ev,tipo:exists || name} : s.ev}));
    if (!exists) this.upd(d => d.tipos.push(name),done); else done();
  }
  agregarProducto(destino) {
    const name = (this.state.nuevoProd || '').trim();
    if (!name) return;
    const data = this.state.data;
    const existing = data.productos.find(p => window.PHASE0.key(p) === window.PHASE0.key(name));
    const selected = existing || name;
    this.upd(d => {
      if (!existing) d.productos.push(selected);
      d.productosArchivados = d.productosArchivados.filter(p => p !== selected);
    }, () => this.setState(s => {
      const result = {nuevoProd:''};
      const field = destino === 'dsc' ? 'dsc' : destino === 'ev' ? 'ev' : null;
      if (field && s[field]) {
        result[field] = {...s[field],productos:[...new Set([...s[field].productos,selected])]};
      }
      return result;
    }));
  }
  nuevoEv(fecha) {
    this.openDraft('ev', {id:window.crypto.randomUUID(),nuevo:true,cliente:'',pdv:'',fecha:fecha || '',horaIni:'16:00',horaFin:'19:00',productos:[],direccion:'',promotora:'',monto:'',estado:'pendiente',cobro:'por_cobrar',factura:'no',pop:[]});
  }
  nuevoDesc() {
    this.openDraft('dsc', {id:window.crypto.randomUUID(),nuevo:true,cliente:'',inicio:'',cierre:'',pct:0,descripcion:'',productos:[],detalles:''});
  }
  abrirEv(e) { this.openDraft('ev', e); }
  setEv(k,v) { if (!this.saving) this.setState(s => ({ev:{...s.ev,[k]:v}})); }
  toggleEn(k,val) {
    this.setState(s => {
      const values = s.ev[k] || [];
      return {ev:{...s.ev,[k]:values.includes(val) ? values.filter(x => x !== val) : [...values,val]}};
    });
  }
  guardarEv() {
    try {
      const item = window.PHASE0.validateEvent(this.state.ev);
      delete item.nuevo;
      this.upd(d => {
        const i = d.eventos.findIndex(x => x.id === item.id);
        if (i < 0) d.eventos.push(item); else d.eventos[i] = item;
      }, () => { this.setState({ev:null}); this.originalDraft = null; });
    } catch (e) { this.notice(e.message); }
  }
  repetirEv() {
    try {
      const F = window.PHASE0;
      const current = F.validateEvent(this.state.ev);
      const copy = F.repeat(current,window.crypto.randomUUID());
      this.ask('Se guardará la actividad actual y se creará otra el ' + window.PLANLIB.fechaLarga(copy.fecha) + ', pendiente de realizar y cobrar, sin material marcado como entregado. ¿Continuar?', () => {
        delete current.nuevo;
        this.upd(d => {
          const i = d.eventos.findIndex(x => x.id === current.id);
          if (i < 0) d.eventos.push(current); else d.eventos[i] = current;
          d.eventos.push(copy);
        }, () => {
          this.setState({ev:null,aviso:'Nueva actividad creada para ' + window.PLANLIB.fechaLarga(copy.fecha) + '. Pendiente de realizar y cobrar.'});
          this.originalDraft = null;
        });
      });
    } catch (e) { this.notice(e.message); }
  }
  borrarEv() {
    const item = this.state.ev;
    if (!item) return;
    if (item.nuevo) { this.cerrar(); return; }
    const archive = () => {
      this.upd(d => { d.eventos = d.eventos.map(e => e.id === item.id ? {...e,archivado:true} : e); }, () => {
        this.setState({ev:null,aviso:'Actividad archivada. Puedes recuperarla desde Archivo.'});
        this.originalDraft = null;
      });
    };
    if (this.dirty()) this.ask('Se archivará la versión guardada. Los cambios del formulario se descartarán. ¿Continuar?', archive);
    else archive();
  }
  reactivarEvento(id) { this.upd(d => { d.eventos = d.eventos.map(e => e.id === id ? {...e,archivado:false} : e); }); }
  reactivarDesc(id) { this.upd(d => { d.descuentos = d.descuentos.map(e => e.id === id ? {...e,archivado:false} : e); }); }
  toggleFactura(id) {
    this.upd(d => { d.eventos = d.eventos.map(e => e.id === id ? {...e,factura:e.factura === 'si' ? 'no' : 'si'} : e); });
  }
  toggleCobro(id) {
    const item = this.state.data.eventos.find(e => e.id === id);
    if (item.estado === 'cancelado') { this.notice('Esta actividad está cancelada. Revisa su detalle antes de cambiar el cobro.'); return; }
    const next = {...item,cobro:item.cobro === 'cobrado' ? 'por_cobrar' : 'cobrado'};
    if (next.cobro === 'cobrado' && !window.PHASE0.money(next.monto)) { this.abrirEv(item); this.notice('Define el monto antes de marcarlo como cobrado.'); return; }
    this.upd(d => { d.eventos = d.eventos.map(e => e.id === id ? next : e); });
  }
  toggleHecho(id) {
    const item = this.state.data.eventos.find(e => e.id === id);
    if (item.estado === 'cancelado') { this.notice('Abre el detalle para reactivar una actividad cancelada.'); return; }
    try {
      const next = window.PHASE0.validateEvent({...item,estado:item.estado === 'hecho' ? 'pendiente' : 'hecho'});
      this.upd(d => { d.eventos = d.eventos.map(e => e.id === id ? next : e); });
    } catch (e) { this.abrirEv(item); this.notice(e.message); }
  }
  asignarFecha(id,fecha) {
    if (!fecha) return;
    if (!window.PHASE0.date(fecha)) { this.notice('Fecha no válida.'); return; }
    this.upd(d => { d.eventos = d.eventos.map(e => e.id === id ? {...e,fecha} : e); });
  }
  guardarDesc() {
    try {
      const item = window.PHASE0.validateDiscount(this.state.dsc);
      delete item.nuevo;
      this.upd(d => {
        const i = d.descuentos.findIndex(e => e.id === item.id);
        if (i < 0) d.descuentos.push(item); else d.descuentos[i] = item;
      }, () => { this.setState({dsc:null}); this.originalDraft = null; });
    } catch (e) { this.notice(e.message); }
  }
  borrarDesc() {
    const item = this.state.dsc;
    if (item.nuevo) { this.cerrar(); return; }
    const archive = () => {
      this.upd(d => { d.descuentos = d.descuentos.map(e => e.id === item.id ? {...e,archivado:true} : e); }, () => {
        this.setState({dsc:null,aviso:'Descuento archivado. Puedes recuperarlo desde Archivo.'});
        this.originalDraft = null;
      });
    };
    if (this.dirty()) this.ask('Se archivará la versión guardada y se descartarán los cambios pendientes. ¿Continuar?', archive);
    else archive();
  }
