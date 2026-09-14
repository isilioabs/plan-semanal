const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../src/phase0.js');
const source = fs.readFileSync(path.join(__dirname,'../src/component.js'),'utf8').replace('__ACTIONS__',()=>fs.readFileSync(path.join(__dirname,'../src/actions.js'),'utf8'));
function setup(raw = null) {
  const values = new Map(raw === null ? [] : [[F.KEY,raw]]);
  const storage = {getItem:k=>values.get(k) ?? null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  class Logic {
    props = {};
    setState(update) { Object.assign(this.state,typeof update === 'function' ? update(this.state) : update); }
  }
  const window = {PHASE0:F,PLAN_DATA:{tipos:[]},crypto:require('node:crypto').webcrypto,confirm:()=>true};
  const context = {DCLogic:Logic,window,localStorage:storage};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/data.js'),'utf8'),context);
  const C = vm.runInNewContext(source + '\nComponent;',context);
  const app = new C(); app.boot();
  return {app,storage,values};
}
test('corrupt current data does not get replaced on boot or edits', () => {
  const {app,storage} = setup('{bad json');
  assert.equal(app.state.bloqueado,true);
  assert.equal(app.persist(F.normalize({eventos:[]})),false);
  assert.equal(storage.getItem(F.KEY),'{bad json');
});
test('failed event save keeps draft open and persisted state unchanged', () => {
  const {app,storage} = setup();
  app.nuevoEv('2026-09-05'); app.setEv('cliente','Marca ficticia'); app.setEv('pdv','Expo');
  storage.setItem = () => { throw Object.assign(new Error('quota'),{name:'QuotaExceededError'}); };
  app.guardarEv();
  assert.ok(app.state.ev);
  assert.equal(app.state.data.eventos.length,0);
  assert.match(app.state.error,/No se pudo guardar/);
});
test('archive and reactivate never remove the original event', () => {
  const {app} = setup();
  app.nuevoEv('2026-09-05'); app.setEv('cliente','Marca ficticia'); app.setEv('pdv','Expo'); app.guardarEv();
  const original = app.state.data.eventos[0];
  app.abrirEv(original); app.borrarEv();
  assert.equal(app.state.data.eventos.length,1);
  assert.equal(app.state.data.eventos[0].archivado,true);
  app.reactivarEvento(original.id);
  assert.equal(app.state.data.eventos[0].archivado,false);
  assert.equal(app.state.data.eventos[0].pdv,'Expo');
});
test('preview does not write data until explicitly applied', () => {
  const {app,storage} = setup();
  const incoming = F.normalize({eventos:[],productos:['Ejemplo']});
  app.showPreview(incoming,'test.json');
  assert.equal(storage.getItem(F.KEY),null);
  app.confirmarRestauracion();
  assert.equal(app.state.preview,null);
  assert.deepEqual(app.state.data.productos,['Ejemplo']);
  assert.ok(storage.getItem(F.RECOVERY));
});
test('recovery failure leaves preview visible', () => {
  const {app,storage} = setup();
  app.showPreview(F.normalize({eventos:[]}), 'test.json');
  storage.setItem = () => { throw new Error('quota'); };
  app.confirmarRestauracion();
  assert.ok(app.state.preview);
  assert.equal(storage.getItem(F.KEY),null);
});
test('invalid events and discounts stay open with actionable validation', () => {
  const {app} = setup();
  app.nuevoEv(''); app.guardarEv();
  assert.ok(app.state.ev); assert.match(app.state.error,/cliente/);
  app.nuevoDesc(); app.guardarDesc();
  assert.ok(app.state.dsc); assert.match(app.state.error,/cliente/);
});
test('repeat waits for confirmation and then resets the payment state', () => {
  const {app} = setup();
  app.nuevoEv('2026-12-29');
  app.setEv('cliente','Marca ficticia'); app.setEv('pdv','Expo');
  app.setEv('monto',60); app.setEv('cobro','cobrado'); app.guardarEv();
  app.abrirEv(app.state.data.eventos[0]); app.repetirEv();
  assert.equal(app.state.data.eventos.length,1);
  assert.ok(app.state.confirmMessage);
  app.resolveConfirm(true);
  assert.equal(app.state.data.eventos.length,2);
  assert.equal(app.state.data.eventos[1].cobro,'por_cobrar');
  assert.equal(app.state.data.eventos[1].fecha,'2027-01-05');
});
test('cancelling a repeat leaves records and the original editor unchanged', () => {
  const {app} = setup();
  app.nuevoEv('2026-09-05'); app.setEv('cliente','Ejemplo'); app.setEv('pdv','Expo');
  app.repetirEv(); app.resolveConfirm(false);
  assert.equal(app.state.data.eventos.length,0);
  assert.ok(app.state.ev);
  assert.equal(app.state.confirmMessage,'');
});
test('discard confirmation preserves pending work when cancelled and resumes import when accepted', () => {
  const {app} = setup();
  app.nuevoEv(''); app.setEv('cliente','Borrador');
  app.showPreview(F.normalize({eventos:[]}), 'test.json');
  assert.equal(app.state.preview,null);
  app.resolveConfirm(false);
  assert.equal(app.state.ev.cliente,'Borrador');
  app.showPreview(F.normalize({eventos:[]}), 'test.json');
  app.resolveConfirm(true);
  assert.equal(app.state.ev,null);
  assert.equal(app.state.preview.name,'test.json');
});
test('catalogue rename applies only on confirmation and preserves display on failure', () => {
  const raw = JSON.stringify({eventos:[{id:'1',productos:['Original']}],productos:['Original']});
  const {app,storage} = setup(raw);
  const input = {value:'Nuevo'};
  app.renombrarProducto('Original','Nuevo',input);
  assert.equal(input.value,'Original');
  app.resolveConfirm(true);
  assert.equal(input.value,'Nuevo');
  assert.deepEqual(app.state.data.eventos[0].productos,['Nuevo']);
  storage.setItem = () => { throw new Error('quota'); };
  app.renombrarProducto('Nuevo','Otra corrección',input);
  app.resolveConfirm(true);
  assert.equal(input.value,'Nuevo');
  assert.deepEqual(app.state.data.eventos[0].productos,['Nuevo']);
});
