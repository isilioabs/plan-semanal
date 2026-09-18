class Component extends DCLogic {
__ACTIONS__
  chip(n, on, hue) {
    return on
      ? { n, on, bg: `oklch(0.94 0.05 ${hue})`, fg: `oklch(0.38 0.09 ${hue})`, bd: `oklch(0.80 0.07 ${hue})` }
      : { n, on, bg: '#fff', fg: 'oklch(0.45 0.02 70)', bd: 'oklch(0.90 0.01 85)' };
  }

  vistaEv(e) {
    const L = window.PLANLIB, h = L.hue(e.cliente), est = L.estado(e.estado), ok = e.estado === 'hecho';
    return {
      id: e.id, cliente: e.cliente, pdv: e.pdv || 'PDV sin nombre',
      horario: L.rango(e.horaIni, e.horaFin) + (e.finDiaSiguiente ? ' · termina al día siguiente' : ''),
      fechaTxt: L.fechaLarga(e.fecha),
      fg: `oklch(0.50 0.10 ${h})`,
      estLabel: est.label, estBg: est.bg, estFg: est.fg,
      prods: (e.productos || []).map(n => ({ n })),
      direccion: e.direccion, tieneDir: !!e.direccion,
      popTxt: (e.pop || []).join(' · '), tienePop: (e.pop || []).length > 0,
      btnHecho: ok ? '✓ Realizado' : 'Marcar realizado',
      okBg: ok ? 'oklch(0.93 0.055 152)' : '#fff',
      okFg: ok ? 'oklch(0.38 0.09 152)' : 'oklch(0.40 0.02 70)',
      okBd: ok ? 'oklch(0.80 0.08 152)' : 'oklch(0.89 0.01 85)',
      tipo: e.tipo || '', tieneTipo: !!e.tipo,
      promotora: e.promotora || '', tienePromotora: !!e.promotora,
      facturaLabel: e.factura === 'si' ? 'Requiere factura' : 'No requiere factura',
      facturaBg: e.factura === 'si' ? 'oklch(0.94 0.04 255)' : 'oklch(0.96 0.008 85)',
      facturaFg: e.factura === 'si' ? 'oklch(0.42 0.10 255)' : 'oklch(0.50 0.02 70)',
      facturaBd: e.factura === 'si' ? 'oklch(0.82 0.07 255)' : 'oklch(0.90 0.01 85)',
      onToggleFactura: () => this.toggleFactura(e.id),
      montoTxt: window.PHASE0.money(e.monto) ? window.PHASE0.usd(window.PHASE0.cents(e.monto)) : 'Sin tarifa',
      tieneMonto: window.PHASE0.money(e.monto),
      cobroLabel: (e.cobro === 'cobrado' ? '✓ Cobrado' : 'Por cobrar') + ' · ' + (window.PHASE0.money(e.monto) ? window.PHASE0.usd(window.PHASE0.cents(e.monto)) : 'Sin tarifa'),
      cobroBg: e.cobro === 'cobrado' ? 'oklch(0.93 0.055 152)' : 'oklch(0.95 0.045 75)',
      cobroFg: e.cobro === 'cobrado' ? 'oklch(0.38 0.09 152)' : 'oklch(0.42 0.09 60)',
      cobroBd: e.cobro === 'cobrado' ? 'oklch(0.80 0.08 152)' : 'oklch(0.83 0.08 75)',
      onToggleCobro: () => this.toggleCobro(e.id),
      onToggle: () => this.toggleHecho(e.id),
      onOpen: () => this.abrirEv(e),
      onFecha: ev => this.asignarFecha(e.id, ev.target.value)
    };
  }

  renderVals() {
    const L = window.PLANLIB, D = window.PLAN_DATA, s = this.state, data = s.data;
    const acento = this.props.acento ?? 'oklch(0.50 0.10 28)';
    const verProductos = this.props.verProductos ?? true;
    if (!L || !data) return { tituloSemana: s.error ? 'No se pudo abrir el plan' : 'Cargando plan…', error:s.error || '',hayError:!!s.error,storageNote:'Conectando con la agencia…', dias: [], tabs: [], verProductos,statTotal:0,statHechas:0,statClientes:0,statPorCobrar:0,montoPorCobrar:'—',montoSemana:'—' };

    const hoy = new Date(), hoyISO = L.ISO(hoy);
    const lun = L.addDays(L.lunes(hoy), s.offset * 7);
    const dias = [], enSemana = [];
    for (let i = 0; i < 7; i++) {
      const f = L.ISO(L.addDays(lun, i)), fd = L.parse(f);
      let evs = data.eventos.filter(e => !e.archivado && e.fecha === f);
      if (this.props.ocultarCancelados) evs = evs.filter(e => e.estado !== 'cancelado');
      evs.sort((a, b) => (a.horaIni || '99').localeCompare(b.horaIni || '99'));
      enSemana.push(...evs);
      dias.push({
        nombre: L.DIAS[i], num: fd.getDate(), mes: L.MESES[fd.getMonth()].slice(0, 3),
        hoy: f === hoyISO, vacio: evs.length === 0,
        resumen: evs.length === 0 ? 'Sin actividad' : evs.length === 1 ? '1 promotoría' : evs.length + ' promotorías',
        eventos: evs.map(e => this.vistaEv(e)),
        onAdd: () => this.nuevoEv(f)
      });
    }
    const sinFechaRaw = data.eventos.filter(e => !e.archivado && !e.fecha);
    const q = (s.q || '').trim().toLowerCase();
    const resultados = q
      ? data.eventos.filter(e => !e.archivado && (e.pdv + ' ' + e.cliente + ' ' + (e.productos || []).join(' ') + ' ' + (e.direccion || '')).toLowerCase().includes(q))
          .sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999'))
      : [];
    const tab = (id, label) => ({
      label, onClick: () => this.setState({ tab: id, q: '' }),
      fg: s.tab === id ? 'oklch(0.26 0.012 65)' : 'oklch(0.60 0.02 70)',
      bd: s.tab === id ? acento : 'transparent'
    });

    const ev = s.ev, dsc = s.dsc;
    const F = window.PHASE0, totals = F.stats(data,enSemana);
    const incoming = s.preview ? F.summary(s.preview.data) : null;
    const current = F.summary(data);
    return {
      verProductos,
      tituloSemana: L.rangoSemana(lun),
      statTotal: totals.total,
      statHechas: totals.done,
      statClientes: totals.clients,
      statPorCobrar: totals.unpaid,
      montoPorCobrar: F.usd(totals.unpaidCents) + (totals.missingAll ? ' + ' + totals.missingAll + ' sin tarifa' : ''),
      montoSemana: F.usd(totals.weekCents) + (totals.missingWeek ? ' + ' + totals.missingWeek + ' sin tarifa' : ''),
      cobroOpts: ['por_cobrar', 'cobrado'].map(k => {
        const on = ev && (ev.cobro || 'por_cobrar') === k;
        const c = k === 'cobrado'
          ? { label: 'Cobrado', bg: 'oklch(0.93 0.055 152)', fg: 'oklch(0.38 0.09 152)' }
          : { label: 'Por cobrar', bg: 'oklch(0.95 0.045 75)', fg: 'oklch(0.42 0.09 60)' };
        return { label: c.label, onClick: () => this.setEv('cobro', k),
          bg: on ? c.bg : '#fff', fg: on ? c.fg : 'oklch(0.50 0.02 70)', bd: on ? c.fg : 'oklch(0.90 0.01 85)' };
      }),
      onPrev: () => this.setState(st => ({ offset: st.offset - 1 })),
      onNext: () => this.setState(st => ({ offset: st.offset + 1 })),
      onHoy: () => this.setState({ offset: 0, tab: 'semana' }),
      onExportar: () => this.cerrar(() => setTimeout(() => window.print(), 80)),
      tabs: [tab('semana', 'Semana'), tab('desc', 'Descuentos'), tab('pool', 'Sin fecha (' + sinFechaRaw.length + ')'), tab('prod', 'Productos'), tab('archivo','Archivo')],
      esSemana: s.tab === 'semana' && !q, esDesc: s.tab === 'desc' && !q, esPool: s.tab === 'pool' && !q, esProd: s.tab === 'prod' && !q,
      aviso: s.aviso || '', hayAviso: !!s.aviso, saving:!!s.saving,
      storageNote: s.demo ? 'Ejemplo en memoria · Los cambios desaparecen al recargar la app.' : s.cloud ? 'Plan compartido de tu agencia · Los cambios se guardan en la nube al confirmar.' : 'Guardado local en este navegador · Exporta un respaldo antes de cambiar de dispositivo.',
      previewWarning: s.demo ? 'Este respaldo reemplazará el ejemplo en memoria. Se conservará una copia anterior solo durante esta demostración.' : s.cloud ? 'Este respaldo reemplazará el plan compartido de toda la agencia. Antes se guardará una copia de recuperación en la nube. Descarga también la copia actual para conservarla fuera de la app.' : 'Este respaldo reemplazará el plan de este navegador. Antes se guardará una copia de recuperación local. Descarga también tu copia actual para conservarla fuera del navegador.',
      error: s.error || '', hayError: !!s.error, bloqueado:!!s.bloqueado,
      cambioExterno:!!s.cambioExterno, onRecargar: () => this.cerrar(() => window.location.reload()),
      hayConfirm:!!s.confirmMessage,confirmMessage:s.confirmMessage || '',
      onConfirmAccept: () => this.resolveConfirm(true),onConfirmCancel: () => this.resolveConfirm(false),
      vacio: !data.eventos.length && !data.descuentos.length && !s.bloqueado,
      onEjemplo: () => this.ejemplo(),
      hayRecuperacion:!!s.hayRecuperacion, onRecuperacion: () => this.recuperarAnterior(),
      onDescargarAnterior: () => this.recuperarAnterior(true),
      hayPreview:!!s.preview, previewName:s.preview ? s.preview.name : '',
      previewRows: incoming ? [['Actividades',current.events,incoming.events],['Descuentos',current.discounts,incoming.discounts],['Productos',current.products,incoming.products],['Actividades archivadas',current.archived,incoming.archived],['Actividades incompletas',current.incomplete,incoming.incomplete],['Actividades sin tarifa',current.missing,incoming.missing],['Importe activo conocido',F.usd(current.total),F.usd(incoming.total)]].map(r => ({label:r[0],before:r[1],after:r[2]})) : [],
      onConfirmarRestauracion: () => this.confirmarRestauracion(),
      esArchivo:s.tab === 'archivo' && !q,
      archivoVacio:!data.eventos.some(e => e.archivado) && !data.descuentos.some(e => e.archivado) && !data.productosArchivados.length,
      eventosArchivados:data.eventos.filter(e => e.archivado).map(e => ({label:e.cliente + ' · ' + e.pdv + ' · ' + L.fechaCorta(e.fecha),onRestore: () => this.reactivarEvento(e.id)})),
      descuentosArchivados:data.descuentos.filter(e => e.archivado).map(e => ({label:e.cliente + ' · ' + e.descripcion,onRestore: () => this.reactivarDesc(e.id)})),
      productosArchivados:data.productosArchivados.map(n => ({label:n,onRestore: () => this.reactivarProducto(n)})),
      onFinSiguiente: () => this.setEv('finDiaSiguiente',!ev.finDiaSiguiente),
      finSiguienteLabel:ev && ev.finDiaSiguiente ? '✓ Finaliza al día siguiente' : 'Finaliza al día siguiente',
      onRespaldo: () => this.respaldar(),
      onRestaurar: e => this.restaurar(e),
      catalogo: data.productos.filter(n => !data.productosArchivados.includes(n)).map(n => ({
        n,
        usos: data.eventos.filter(e => (e.productos || []).indexOf(n) >= 0).length + ' eventos',
        onRename: e => this.renombrarProducto(n, e.target.value, e.target),
        onBorrar: () => this.borrarProducto(n)
      })),
      onAgregarProdCat: () => this.agregarProducto('cat'),
      onNuevoProdKeyCat: e => { if (e.key === 'Enter') { e.preventDefault(); this.agregarProducto('cat'); } },
      q: s.q || '', hayQ: !!q,
      onQ: e => this.setState({ q: e.target.value, tab: 'semana' }),
      onLimpiarQ: () => this.setState({ q: '' }),
      resultados: resultados.map(e => this.vistaEv(e)),
      resumenQ: resultados.length === 1 ? '1 resultado' : resultados.length + ' resultados',
      dias,
      sinFecha: sinFechaRaw.map(e => this.vistaEv(e)),
      clientes: D.clientes.map(c => ({ n: c.nombre })),
      descuentos: data.descuentos.filter(x => !x.archivado).map(x => {
        const vig = L.vigencia(x, hoyISO), h = L.hue(x.cliente);
        return {
          cliente: x.cliente, pct: (x.pct || 0) + '%', descripcion: x.descripcion || 'Sin descripción',
          rango: x.inicio && x.cierre ? L.fechaCorta(x.inicio) + ' → ' + L.fechaCorta(x.cierre) : 'Fechas por definir',
          prods: (x.productos || []).map(n => ({ n })),
          fg: `oklch(0.50 0.10 ${h})`, vigLabel: vig.label, vigBg: vig.bg, vigFg: vig.fg,
          onOpen: () => this.openDraft('dsc',x)
        };
      }),
      onNuevoDesc: () => this.nuevoDesc(),
      onCerrar: () => this.cerrar(),

      hayEv: !!ev,
      ev: ev || {},
      evTitulo: ev ? (ev.pdv || 'Nueva promotoría') : '',
      on: {
        cliente: e => this.setEv('cliente', e.target.value),
        pdv: e => this.setEv('pdv', e.target.value),
        fecha: e => this.setEv('fecha', e.target.value),
        hi: e => this.setEv('horaIni', e.target.value),
        hf: e => this.setEv('horaFin', e.target.value),
        dir: e => this.setEv('direccion', e.target.value),
        promotora: e => this.setEv('promotora', e.target.value),
        monto: e => this.setEv('monto', e.target.value === '' ? '' : Number(e.target.value))
      },
      promotoras: Array.from(new Set(data.eventos.map(e => e.promotora).filter(Boolean))).map(n => ({ n })),
      facturaOpts: ['no', 'si'].map(k => {
        const on = ev && (ev.factura || 'no') === k;
        const c = k === 'si'
          ? { label: 'Requiere factura', bg: 'oklch(0.94 0.04 255)', fg: 'oklch(0.42 0.10 255)' }
          : { label: 'No requiere', bg: 'oklch(0.95 0.012 85)', fg: 'oklch(0.45 0.02 70)' };
        return { label: c.label, onClick: () => this.setEv('factura', k),
          bg: on ? c.bg : '#fff', fg: on ? c.fg : 'oklch(0.50 0.02 70)', bd: on ? c.fg : 'oklch(0.90 0.01 85)' };
      }),
      tipoOpts: ev ? (data.tipos || []).map(t => {
        const on = ev.tipo === t;
        return { n: t, onClick: () => this.setEv('tipo', on ? '' : t),
          bg: on ? 'oklch(0.94 0.05 28)' : '#fff', fg: on ? 'oklch(0.38 0.09 28)' : 'oklch(0.45 0.02 70)',
          bd: on ? 'oklch(0.80 0.07 28)' : 'oklch(0.90 0.01 85)' };
      }) : [],
      nuevoTipo: s.nuevoTipo || '',
      onNuevoTipo: e => this.setState({ nuevoTipo: e.target.value }),
      onNuevoTipoKey: e => { if (e.key === 'Enter') { e.preventDefault(); this.agregarTipo(); } },
      onAgregarTipo: () => this.agregarTipo(),
      nuevoProd: s.nuevoProd || '',
      onNuevoProd: e => this.setState({ nuevoProd: e.target.value }),
      onNuevoProdKey: e => { if (e.key === 'Enter') { e.preventDefault(); this.agregarProducto('ev'); } },
      onAgregarProd: () => this.agregarProducto('ev'),
      onNuevoProdKeyDsc: e => { if (e.key === 'Enter') { e.preventDefault(); this.agregarProducto('dsc'); } },
      onAgregarProdDsc: () => this.agregarProducto('dsc'),
      prodChips: ev ? data.productos.filter(n => !data.productosArchivados.includes(n) || ev.productos.includes(n)).map(n => ({ ...this.chip(n, ev.productos.includes(n), 28), onClick: () => this.toggleEn('productos', n) })) : [],
      popChips: ev ? D.pop.map(n => ({ ...this.chip(n, ev.pop.includes(n), 255), onClick: () => this.toggleEn('pop', n) })) : [],
      estadoOpts: ['pendiente', 'hecho', 'cancelado'].map(k => {
        const est = L.estado(k), on = ev && ev.estado === k;
        return { label: est.label, onClick: () => this.setEv('estado', k),
          bg: on ? est.bg : '#fff', fg: on ? est.fg : 'oklch(0.50 0.02 70)', bd: on ? est.fg : 'oklch(0.90 0.01 85)' };
      }),
      onGuardar: () => this.guardarEv(),
      onRepetir: () => this.repetirEv(),
      onBorrar: () => this.borrarEv(),

      hayDesc: !!dsc,
      dsc: dsc || {},
      onD: {
        cliente: e => this.setState(st => ({ dsc: { ...st.dsc, cliente: e.target.value } })),
        pct: e => this.setState(st => ({ dsc: { ...st.dsc, pct: e.target.value } })),
        inicio: e => this.setState(st => ({ dsc: { ...st.dsc, inicio: e.target.value } })),
        cierre: e => this.setState(st => ({ dsc: { ...st.dsc, cierre: e.target.value } })),
        descripcion: e => this.setState(st => ({ dsc: { ...st.dsc, descripcion: e.target.value } })),
        detalles: e => this.setState(st => ({ dsc: { ...st.dsc, detalles: e.target.value } }))
      },
      dscChips: dsc ? data.productos.filter(n => !data.productosArchivados.includes(n) || dsc.productos.includes(n)).map(n => ({ ...this.chip(n, (dsc.productos || []).includes(n), 28),
        onClick: () => this.setState(st => {
          const arr = (st.dsc.productos || []).slice(), i = arr.indexOf(n);
          if (i < 0) arr.push(n); else arr.splice(i, 1);
          return { dsc: { ...st.dsc, productos: arr } };
        }) })) : [],
      onGuardarDesc: () => this.guardarDesc(),
      onBorrarDesc: () => this.borrarDesc()
    };
  }
}
