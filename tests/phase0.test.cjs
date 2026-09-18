const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/phase0.js');
const ev = changes => ({id:'event-1',cliente:'Marca ficticia',pdv:'Expo de ejemplo',fecha:'2026-09-05',horaIni:'09:00',horaFin:'12:00',monto:60,productos:['Muestra'],pop:['Mesa'],estado:'pendiente',cobro:'por_cobrar',...changes});
const dataset = changes => F.normalize({eventos:[ev()],descuentos:[],productos:['Muestra'],tipos:[],...changes});
function memory(initial) {
  const values = new Map(initial === undefined ? [] : [[F.KEY, initial]]);
  return {getItem:k=>values.get(k) ?? null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};
}
test('legacy backup keeps records and custom fields, recovering missing catalogues', () => {
  const input = {eventos:[ev({extra:{nota:'Conservar'}})],descuentos:[{id:'d1',pct:10,productos:['Otro producto'],admin:'Conservar'}],config:{zona:'Ejemplo'}};
  const output = F.normalize(input);
  assert.equal(output.schemaVersion,2);
  assert.deepEqual(output.productos,['Muestra','Otro producto']);
  assert.equal(output.eventos[0].extra.nota,'Conservar');
  assert.equal(output.descuentos[0].admin,'Conservar');
  assert.equal(output.config.zona,'Ejemplo');
  assert.equal(input.schemaVersion,undefined);
});
test('invalid backup shapes and duplicate IDs are rejected', () => {
  for (const data of [{eventos:{}},{eventos:[null]},{eventos:[ev(),ev()]},{eventos:[],descuentos:'bad'},{eventos:[ev({productos:{}})]}]) {
    assert.throws(() => F.normalize(data));
  }
});
test('future schema and prototype properties are rejected without execution', () => {
  assert.throws(()=>F.parse('{"schemaVersion":99,"eventos":[]}'),/Versión/);
  assert.throws(()=>F.parse('{"eventos":[],"__proto__":{"polluted":true}}'),/propiedad/);
  assert.equal({}.polluted,undefined);
  assert.throws(()=>F.parse('{'));
});
test('calendar dates, currency and states are validated', () => {
  for (const change of [{fecha:'2026-02-30'},{horaIni:'25:00'},{monto:-1},{monto:' '},{monto:true},{monto:Infinity},{monto:NaN},{monto:1.234},{monto:'1e3'},{estado:'unknown'}]) {
    assert.throws(()=>dataset({eventos:[ev(change)]}));
  }
  assert.equal(F.date('2028-02-29'),true);
  assert.equal(F.date('2026-02-29'),false);
});
test('incomplete legacy records remain available for correction', () => {
  const data = dataset({eventos:[ev({pdv:'',horaIni:'',horaFin:'',fecha:'',monto:''})]});
  assert.equal(F.summary(data).incomplete,1);
  assert.equal(F.summary(data).missing,1);
  assert.throws(()=>F.validateEvent(data.eventos[0]),/punto de venta/);
});
test('saving supports unscheduled activities, explicit overnight shifts, and rejects malformed times', () => {
  assert.equal(F.validateEvent(ev({fecha:'',horaIni:'',horaFin:''})).fecha,'');
  assert.throws(()=>F.validateEvent(ev({horaFin:''})),/dos horas/);
  assert.throws(()=>F.validateEvent(ev({horaIni:'22:00',horaFin:'02:00'})),/día siguiente/);
  assert.equal(F.validateEvent(ev({horaIni:'22:00',horaFin:'02:00',finDiaSiguiente:true})).finDiaSiguiente,true);
  assert.throws(()=>F.validateEvent(ev({horaIni:'09:00',horaFin:'12:00',finDiaSiguiente:true})),/24 horas/);
  assert.throws(()=>F.validateEvent(ev({fecha:'',estado:'hecho'})),/fecha/);
});
test('zero is a defined price; missing price cannot be marked paid', () => {
  assert.equal(F.validateEvent(ev({monto:0,cobro:'cobrado'})).monto,0);
  assert.throws(()=>F.validateEvent(ev({monto:'',cobro:'cobrado'})),/monto/);
});
test('repeat resets collection, execution and delivered POP across year boundary', () => {
  const original = ev({fecha:'2026-12-29',estado:'hecho',cobro:'cobrado',abonos:[{monto:60}],evidencias:['foto'],confirmaciones:['si']});
  const copy = F.repeat(original,'new-id');
  assert.equal(copy.fecha,'2027-01-05');
  assert.equal(copy.cobro,'por_cobrar');
  assert.equal(copy.estado,'pendiente');
  assert.equal(copy.monto,60);
  assert.deepEqual(copy.productos,['Muestra']);
  assert.deepEqual(copy.pop,[]);
  assert.equal(copy.abonos,undefined);
  assert.equal(copy.evidencias,undefined);
  assert.equal(copy.confirmaciones,undefined);
  assert.equal(original.cobro,'cobrado');
  assert.throws(()=>F.repeat(ev({fecha:''}),'new'),/fecha/);
});
test('money totals exclude cancelled and archived events and do not pretend missing prices are zero', () => {
  const data = dataset({eventos:[
    ev({id:'a',monto:0.1}),ev({id:'b',monto:0.2}),ev({id:'c',monto:''}),
    ev({id:'d',monto:100,estado:'cancelado'}),ev({id:'e',monto:200,archivado:true}),
    ev({id:'f',monto:0}),ev({id:'g',monto:10,cobro:'cobrado'})
  ]});
  const result = F.stats(data,data.eventos);
  assert.equal(result.weekCents,1030);
  assert.equal(result.unpaidCents,30);
  assert.equal(result.unpaid,4);
  assert.equal(result.missingAll,1);
  assert.equal(result.total,5);
});
test('archive preserves product associations and reactivation is lossless', () => {
  const data = dataset();
  data.productosArchivados.push('Muestra');
  const parsed = F.parse(JSON.stringify(data));
  assert.deepEqual(parsed.eventos[0].productos,['Muestra']);
  assert.deepEqual(parsed.productos,['Muestra']);
  assert.deepEqual(parsed.productosArchivados,['Muestra']);
});
test('renaming rejects collisions and updates active and archived references', () => {
  const data = dataset({productos:['Muestra','Otro'],productosArchivados:['Muestra']});
  assert.throws(()=>F.rename(data,'Muestra',' otro '),/Ya existe/);
  const renamed = F.rename(data,'Muestra','Nuevo');
  assert.deepEqual(renamed.productosArchivados,['Nuevo']);
  assert.deepEqual(renamed.eventos[0].productos,['Nuevo']);
  assert.deepEqual(data.eventos[0].productos,['Muestra']);
});
test('discount validation handles zero, invalid percent and reversed periods', () => {
  const d = {id:'discount',cliente:'Marca',pct:0,productos:[]};
  assert.equal(F.validateDiscount(d).pct,0);
  assert.throws(()=>F.validateDiscount({...d,pct:101}));
  assert.throws(()=>F.validateDiscount({...d,pct:''}));
  assert.throws(()=>F.validateDiscount({...d,inicio:'2026-09-05',cierre:'2026-09-04'}));
});
test('save verifies persistence and is round-trip compatible', () => {
  const storage = memory();
  const saved = F.save(storage,dataset(),null);
  assert.deepEqual(F.parse(storage.getItem(F.KEY)),saved.data);
});
test('outdated tab cannot overwrite another tab, even during restore', () => {
  const storage = memory('newer');
  assert.throws(()=>F.save(storage,dataset(),'older',true),/otra pestaña/);
  assert.equal(storage.getItem(F.KEY),'newer');
  assert.equal(storage.getItem(F.RECOVERY),null);
});
test('restore stores exact previous bytes before replacement', () => {
  const before = JSON.stringify({eventos:[ev({monto:10})]});
  const storage = memory(before);
  F.save(storage,dataset(),before,true);
  assert.equal(storage.getItem(F.RECOVERY),before);
  assert.equal(F.parse(storage.getItem(F.KEY)).eventos[0].monto,60);
});
test('recovery storage failure prevents any replacement', () => {
  const before = JSON.stringify(dataset());
  const storage = memory(before);
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(()=>F.save(storage,dataset({eventos:[]}),before,true),/quota/);
  assert.equal(storage.getItem(F.KEY),before);
});
test('failed main write leaves original and recovery accessible', () => {
  const before = JSON.stringify(dataset());
  const storage = memory(before), realSet = storage.setItem;
  storage.setItem = (k,v) => { if (k === F.KEY) throw new Error('quota'); realSet(k,v); };
  assert.throws(()=>F.save(storage,dataset({eventos:[]}),before,true),/quota/);
  assert.equal(storage.getItem(F.KEY),before);
  assert.equal(storage.getItem(F.RECOVERY),before);
});
test('silent non-persistence is detected', () => {
  const storage = memory(), realSet = storage.setItem;
  storage.setItem = (k,v) => { if (k !== F.KEY) realSet(k,v); };
  assert.throws(()=>F.save(storage,dataset(),null),/verificar/);
});
