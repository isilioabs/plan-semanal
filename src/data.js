(function () {
window.PLAN_DATA = { clientes: [], productos: [], tipos: ["Volanteo", "Degustación", "Protocolo", "Impulso", "Grabación de contenido"], pop: ["Afiches", "Exhibidor", "Mesa de degustación", "Muestras", "Volantes"], eventos: [], descuentos: [] };
  var DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  function parse(iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ISO(d) {
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (dd < 10 ? '0' + dd : dd);
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }

  window.PLANLIB = {
    DIAS: DIAS, MESES: MESES, parse: parse, ISO: ISO, addDays: addDays,
    lunes: function (d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var w = (x.getDay() + 6) % 7; return addDays(x, -w); },
    hora12: function (h) {
      if (!h) return '';
      var p = h.split(':'), H = +p[0], m = p[1] || '00';
      var suf = H < 12 ? 'am' : 'pm', h12 = H % 12 === 0 ? 12 : H % 12;
      return h12 + ':' + m + ' ' + suf;
    },
    rango: function (a, b) {
      var L = window.PLANLIB;
      if (!a && !b) return 'Horario por definir';
      if (!b) return L.hora12(a);
      return L.hora12(a) + ' – ' + L.hora12(b);
    },
    fechaCorta: function (iso) { if (!iso) return 'Sin fecha'; var d = parse(iso); return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3); },
    fechaLarga: function (iso) { if (!iso) return 'Sin fecha'; var d = parse(iso); return DIAS[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; },
    rangoSemana: function (lun) {
      var dom = addDays(lun, 6);
      if (lun.getMonth() === dom.getMonth()) return lun.getDate() + ' – ' + dom.getDate() + ' de ' + MESES[lun.getMonth()] + ' ' + dom.getFullYear();
      return lun.getDate() + ' ' + MESES[lun.getMonth()].slice(0, 3) + ' – ' + dom.getDate() + ' ' + MESES[dom.getMonth()].slice(0, 3) + ' ' + dom.getFullYear();
    },
    hue: function (cliente) {
      var c = window.PLAN_DATA.clientes.filter(function (x) { return x.nombre === cliente; })[0];
      return c ? c.hue : 60;
    },
    estado: function (est) {
      if (est === 'hecho') return { label: 'Realizado', bg: 'oklch(0.93 0.055 152)', fg: 'oklch(0.40 0.09 152)' };
      if (est === 'cancelado') return { label: 'Cancelado', bg: 'oklch(0.94 0.035 25)', fg: 'oklch(0.48 0.10 25)' };
      return { label: 'Pendiente', bg: 'oklch(0.94 0.012 85)', fg: 'oklch(0.45 0.02 70)' };
    },
    vigencia: function (d, hoyISO) {
      if (!d.inicio || !d.cierre) return { label: 'Por definir', bg: 'oklch(0.94 0.012 85)', fg: 'oklch(0.45 0.02 70)' };
      if (hoyISO < d.inicio) return { label: 'Programado', bg: 'oklch(0.94 0.03 255)', fg: 'oklch(0.45 0.10 255)' };
      if (hoyISO > d.cierre) return { label: 'Vencido', bg: 'oklch(0.94 0.012 85)', fg: 'oklch(0.55 0.02 70)' };
      return { label: 'Activo', bg: 'oklch(0.93 0.055 152)', fg: 'oklch(0.40 0.09 152)' };
    }
  };
})();
