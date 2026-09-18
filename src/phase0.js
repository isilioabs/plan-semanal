(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PHASE0 = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const KEY = 'plan-trade-zulia-v1';
  const RECOVERY = KEY + '-recovery';
  const MAX_BYTES = 10 * 1024 * 1024;
  const clone = value => JSON.parse(JSON.stringify(value));
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fail = message => { throw new Error(message); };
  const key = value => String(value || '').trim().toLocaleLowerCase('es');
  const money = value => value !== '' && value !== null && value !== undefined;
  const cents = value => money(value) ? Math.round(Number(value) * 100) : 0;
  const usd = value => '$' + (value / 100).toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2});
  function text(value, name, fallback = '') {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'string' || value.length > 10000) fail(name + ': texto no válido.');
    return value;
  }
  function array(value, name, fallback = []) {
    if (value === undefined) return fallback;
    if (!Array.isArray(value) || value.length > 50000) fail(name + ': se esperaba una lista válida.');
    return value;
  }
  function strings(value, name) {
    return [...new Set(array(value, name).map(x => {
      const s = text(x, name).trim();
      if (!s) fail(name + ': hay un nombre vacío.');
      return s;
    }))];
  }
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
  }
  function optionalDate(value, name) {
    const s = text(value, name);
    if (s && !date(s)) fail(name + ': fecha no válida.');
    return s;
  }
  function optionalTime(value, name) {
    const s = text(value, name);
    if (s && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail(name + ': horario no válido.');
    return s;
  }
  function amount(value, name) {
    if (!money(value)) return '';
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !/^\d+(\.\d{1,2})?$/.test(value.trim()))) fail(name + ': usa un importe con hasta dos decimales.');
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 1000000000 || Math.abs(n * 100 - Math.round(n * 100)) > 0.0001) fail(name + ': importe no válido.');
    return n;
  }
  function choice(value, values, fallback, name) {
    const s = value === undefined || value === '' ? fallback : value;
    if (!values.includes(s)) fail(name + ': estado no reconocido.');
    return s;
  }
  function checkSafe(value, depth = 0) {
    if (depth > 30) fail('El respaldo tiene demasiados niveles.');
    if (value && typeof value === 'object') {
      for (const name of Object.keys(value)) {
        if (['__proto__','prototype','constructor'].includes(name)) fail('El respaldo contiene una propiedad no admitida.');
        checkSafe(value[name], depth + 1);
      }
    }
  }
  function event(value, name = 'Actividad') {
    if (!record(value)) fail(name + ': registro no válido.');
    amount(value.monto, name + ' monto');
    const e = clone(value);
    e.id = text(e.id, name + ' ID').trim();
    if (!e.id) fail(name + ': falta el identificador.');
    for (const f of ['cliente','pdv','direccion','promotora','tipo']) e[f] = text(e[f], name + ' ' + f);
    e.fecha = optionalDate(e.fecha, name);
    e.horaIni = optionalTime(e.horaIni, name);
    e.horaFin = optionalTime(e.horaFin, name);
    e.productos = strings(e.productos, name + ' productos');
    e.pop = strings(e.pop, name + ' material POP');
    e.monto = amount(e.monto, name + ' monto');
    e.estado = choice(e.estado, ['pendiente','hecho','cancelado'], 'pendiente', name);
    e.cobro = choice(e.cobro, ['por_cobrar','cobrado'], 'por_cobrar', name);
    e.factura = choice(e.factura, ['no','si'], 'no', name);
    if (e.archivado !== undefined && typeof e.archivado !== 'boolean') fail(name + ': archivo no válido.');
    if (e.finDiaSiguiente !== undefined && typeof e.finDiaSiguiente !== 'boolean') fail(name + ': fin de turno no válido.');
    return e;
  }
  function discount(value, name = 'Descuento') {
    if (!record(value)) fail(name + ': registro no válido.');
    amount(value.pct, name + ' porcentaje');
    const d = clone(value);
    d.id = text(d.id, name + ' ID').trim();
    if (!d.id) fail(name + ': falta el identificador.');
    for (const f of ['cliente','descripcion','detalles']) d[f] = text(d[f], name + ' ' + f);
    d.inicio = optionalDate(d.inicio, name);
    d.cierre = optionalDate(d.cierre, name);
    d.pct = amount(d.pct, name + ' porcentaje');
    if (d.pct !== '' && d.pct > 100) fail(name + ': el porcentaje debe estar entre 0 y 100.');
    d.productos = strings(d.productos, name + ' productos');
    if (d.archivado !== undefined && typeof d.archivado !== 'boolean') fail(name + ': archivo no válido.');
    return d;
  }
  function uniqueIds(list, name) {
    const ids = new Set();
    for (const item of list) {
      if (ids.has(item.id)) fail(name + ': identificador duplicado ' + item.id + '.');
      ids.add(item.id);
    }
    return list;
  }
  function normalize(input) {
    if (!record(input)) fail('El respaldo debe ser un objeto JSON.');
    checkSafe(input);
    if (input.schemaVersion !== undefined && ![1,2].includes(input.schemaVersion)) fail('Versión de respaldo no compatible. No se ha modificado tu información.');
    if (!Array.isArray(input.eventos)) fail('El respaldo no contiene una lista de actividades.');
    const data = clone(input);
    data.schemaVersion = 2;
    data.eventos = uniqueIds(array(input.eventos, 'Actividades').map((e,i) => event(e, 'Actividad ' + (i + 1))), 'Actividades');
    data.descuentos = uniqueIds(array(input.descuentos, 'Descuentos').map((d,i) => discount(d, 'Descuento ' + (i + 1))), 'Descuentos');
    data.productos = strings(input.productos, 'Productos');
    data.tipos = strings(input.tipos, 'Tipos');
    data.productosArchivados = strings(input.productosArchivados, 'Productos archivados');
    // Recover catalogue references from legacy backups without changing historical records.
    for (const item of [...data.eventos, ...data.descuentos]) {
      for (const p of item.productos) if (!data.productos.includes(p)) data.productos.push(p);
    }
    for (const e of data.eventos) if (e.tipo && !data.tipos.includes(e.tipo)) data.tipos.push(e.tipo);
    return data;
  }
  function parse(raw) {
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) fail('El archivo supera el límite de 10 MB.');
    let data;
    try { data = JSON.parse(raw); } catch (_) { fail('El archivo no contiene JSON válido.'); }
    return normalize(data);
  }
  function validateEvent(input) {
    const e = event(input);
    if (!e.cliente.trim()) fail('Escribe el cliente o la cadena.');
    if (!e.pdv.trim()) fail('Escribe el punto de venta o el nombre de la actividad.');
    if (!!e.horaIni !== !!e.horaFin) fail('Completa las dos horas o deja ambas sin definir.');
    if (e.horaIni && e.horaFin <= e.horaIni && !e.finDiaSiguiente) fail('La hora final debe ser posterior. Si termina mañana, marca “Finaliza al día siguiente”.');
    if (e.finDiaSiguiente && !e.horaIni) fail('Define las horas para indicar que finaliza al día siguiente.');
    if (e.finDiaSiguiente && e.horaFin > e.horaIni) fail('Divide las actividades de más de 24 horas en turnos separados.');
    if (e.estado === 'hecho' && (!e.fecha || !e.horaIni)) fail('Una actividad realizada debe tener fecha y horario.');
    if (e.cobro === 'cobrado' && !money(e.monto)) fail('Define el monto antes de marcarlo como cobrado.');
    e.cliente = e.cliente.trim(); e.pdv = e.pdv.trim();
    return e;
  }
  function validateDiscount(input) {
    const d = discount(input);
    if (!d.cliente.trim()) fail('Escribe el cliente del descuento.');
    if (d.pct === '') fail('Define el porcentaje del descuento.');
    if (!!d.inicio !== !!d.cierre) fail('Completa las dos fechas o deja ambas sin definir.');
    if (d.inicio && d.cierre < d.inicio) fail('El cierre no puede ser anterior al inicio.');
    return d;
  }
  function repeat(input, id) {
    const e = validateEvent(input);
    if (!e.fecha) fail('Asigna una fecha antes de repetir.');
    const next = new Date(e.fecha + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + 7);
    const copy = clone(e);
    Object.assign(copy, {id, fecha:next.toISOString().slice(0,10), estado:'pendiente', cobro:'por_cobrar', pop:[], archivado:false});
    delete copy.nuevo;
    // Delivery/evidence/settlement fields never carry over into another occurrence.
    for (const f of ['evidencias','asistencia','confirmaciones','pagos','abonos','comprobante','fechaCobro','realizadoEn','archivadoEn']) delete copy[f];
    return copy;
  }
  function stats(data, week) {
    const live = data.eventos.filter(e => !e.archivado && e.estado !== 'cancelado');
    const visible = week.filter(e => !e.archivado && e.estado !== 'cancelado');
    const unpaid = live.filter(e => e.cobro !== 'cobrado');
    return {
      total:visible.length, done:visible.filter(e => e.estado === 'hecho').length,
      clients:new Set(visible.map(e => e.cliente)).size,
      unpaid:visible.filter(e => e.cobro !== 'cobrado').length,
      unpaidCents:unpaid.reduce((t,e) => t + cents(e.monto),0),
      weekCents:visible.reduce((t,e) => t + cents(e.monto),0),
      missingAll:unpaid.filter(e => !money(e.monto)).length,
      missingWeek:visible.filter(e => !money(e.monto)).length
    };
  }
  function summary(data) {
    return {
      events:data.eventos.length, discounts:data.descuentos.length, products:data.productos.length,
      archived:data.eventos.filter(e => e.archivado).length,
      missing:data.eventos.filter(e => !e.archivado && e.estado !== 'cancelado' && !money(e.monto)).length,
      incomplete:data.eventos.filter(e => !e.cliente.trim() || !e.pdv.trim() || !e.fecha || !e.horaIni || !e.horaFin).length,
      total:stats(data, data.eventos).weekCents
    };
  }
  function rename(data, old, name) {
    const n = name.trim();
    if (!n) fail('El producto necesita un nombre.');
    if (data.productos.some(p => p !== old && key(p) === key(n))) fail('Ya existe otro producto con ese nombre.');
    const next = clone(data);
    next.productos = next.productos.map(p => p === old ? n : p);
    next.productosArchivados = next.productosArchivados.map(p => p === old ? n : p);
    for (const e of [...next.eventos, ...next.descuentos]) e.productos = e.productos.map(p => p === old ? n : p);
    return next;
  }
  function save(storage, data, expectedRaw, recovery = false) {
    const before = storage.getItem(KEY);
    if (before !== expectedRaw) fail('Hay cambios en otra pestaña. Recarga después de respaldar tus cambios pendientes.');
    const normalized = normalize(data);
    const raw = JSON.stringify(normalized);
    if (recovery) {
      storage.setItem(RECOVERY, before === null ? JSON.stringify(normalize({eventos:[],descuentos:[]})) : before);
      if (storage.getItem(RECOVERY) !== (before === null ? JSON.stringify(normalize({eventos:[],descuentos:[]})) : before)) fail('No se pudo crear la copia de recuperación. Restauración cancelada.');
    }
    storage.setItem(KEY, raw);
    if (storage.getItem(KEY) !== raw) {
      if (before === null) storage.removeItem(KEY); else storage.setItem(KEY, before);
      fail('No se pudo verificar el guardado.');
    }
    return {data:normalized, raw};
  }
  return {KEY, RECOVERY, MAX_BYTES, clone, key, money, cents, usd, date, normalize, parse,
    validateEvent, validateDiscount, repeat, stats, summary, rename, save};
});
