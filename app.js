/* ============ DATOS DE HONEY CREAM ============ */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCNsjIRD6nsdleMEfdL7OELN0mUpdLJwOVbI_ICsMwbhmlybjCnO9VfsFbCEmzfg6NCg/exec';
const SHEET_ID = '11gpTcGFAPMcElmUwwHpCeKTWIDSCBjZZxbFTtOLIrzc';
const LOGO_SRC = 'logo.jpg';

const NEG = {
  nombre: 'Honey Cream',
  rubro: 'Como la miel pero más rico...',
  colorPrincipal: '#e3b04b',
  colorSecundario: '#ffe5a3',
  tel: '+58 424-5284850',
  wa: '584245284850',
  mail: 'yoseabdel@gmail.com',
  dir: 'Ciudadela, Zona 18, Edif. 4, Apto 3-6, San Felipe, Yaracuy',
  delivery: ['Casco de San Felipe', 'Cocorotico', 'Marín', 'Albarico'],
  moneda: '$',
  resena: ''
};

const HORARIO = { 0: null, 1: [8, 17], 2: [8, 17], 3: [8, 17], 4: [8, 17], 5: [8, 17], 6: [8, 17] };
const PAGO = [
  ['Pago Móvil', [['Banco', 'Banco de Venezuela (0102)'], ['Teléfono', '0412-5770565'], ['Cédula', '20.890.298']]]
];
const RESENAS = [];

const FOTOS_PRODUCTOS = {};

const RESPALDO = [
  ['Torta de tres leches', 4, 2.5, 10],
  ['Triple Chocolate', 4, 2.5, 5],
  ['Pastel Imposible', 4, 2.5, 6],
  ['Choco Quesillo', 4, 2.5, 5],
  ['Torta Samba', 4, 2.5, 4],
  ['Torta de quesillo', 4, 2.5, 5],
  ['Torta de Zanahoria', 4, 2.5, 5],
  ['Chocomantecado', 4, 2.5, 5],
  ['Torta fría', 4, 2.5, 7]
];

/* ============ ESTADO Y LÓGICA DE PEDIDO ============ */
const $ = id => document.getElementById(id);
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => NEG.moneda + Number(n || 0).toFixed(2);
const num = v => parseFloat(String(v).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
const f12 = h => (h % 12 || 12) + ':00 ' + (h < 12 ? 'a.m.' : 'p.m.');
const waURL = t => 'https://wa.me/' + NEG.wa + (t ? '?text=' + encodeURIComponent(t) : '');

let productos = [];
let modoActual = 'a';
let carrito = {};
let firmaInventario = '';
let consultando = false;
let escenaControl = null;

if (LOGO_SRC && $('logo-img')) $('logo-img').src = LOGO_SRC;
else if ($('logo-img')) $('logo-img').remove();

const etiquetaModo = m => m === 'a' ? 'Al Detal' : 'Al Mayor';
const formatoPresentacion = m => m === 'a' ? 'Presentación Al Detal (porción / unidad)' : 'Presentación Al Mayor (bandeja / lote)';
const precioUnitario = (p, m) => m === 'a' ? p.a : (p.m || p.a);
const claveItem = (nombre, m) => nombre + '::' + m;

function norm(r) {
  if (Array.isArray(r)) {
    return {
      n: String(r[0] || '').trim(),
      a: num(r[1]),
      m: num(r[2]),
      s: Math.max(0, parseInt(r[3], 10) || 0)
    };
  }
  const g = re => {
    const k = Object.keys(r).find(x => re.test(x.toLowerCase()));
    return k ? r[k] : '';
  };
  return {
    n: String(g(/prod|nom|tit/) || '').trim(),
    a: num(g(/detal/)),
    m: num(g(/mayor/)),
    s: Math.max(0, parseInt(g(/disp|stock|cant/), 10) || 0)
  };
}

async function leerSheetDirecto() {
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json';
  const txt = await (await fetch(url)).text();
  const json = JSON.parse(txt.substring(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  return (json.table.rows || []).map(row => {
    const c = row.c || [];
    return norm([c[0] ? c[0].v : '', c[1] ? c[1].v : 0, c[2] ? c[2].v : 0, c[3] ? c[3].v : 0]);
  }).filter(p => p.n && p.n.toLowerCase() !== 'producto' && (p.a || p.m));
}

function stockReservadoDeProducto(nombre) {
  let total = 0;
  for (const [k, cant] of Object.entries(carrito)) {
    const [prodNombre] = k.split('::');
    if (prodNombre === nombre) total += cant;
  }
  return total;
}

async function cargar(esFondo = false) {
  if (consultando) return;
  consultando = true;
  let ok = false, nuevos = null;

  try {
    if (/^https?:\/\//.test(APPS_SCRIPT_URL)) {
      try {
        const c = new AbortController(), t = setTimeout(() => c.abort(), 4500);
        const res = await fetch(APPS_SCRIPT_URL + '?t=' + Date.now(), { signal: c.signal, cache: 'no-store' });
        const j = await res.json();
        clearTimeout(t);
        const x = (Array.isArray(j) ? j : j.tortas || j.data || j.items || []).map(norm).filter(p => p.n && (p.a || p.m));
        if (x.length) { nuevos = x; ok = true; }
      } catch (e) {}
    }

    if (!ok && SHEET_ID) {
      try {
        const x = await leerSheetDirecto();
        if (x.length) { nuevos = x; ok = true; }
      } catch (e) {}
    }

    if (ok && nuevos) {
      const nuevaFirma = JSON.stringify(nuevos.map(p => [p.n, p.a, p.m, p.s]));
      if (nuevaFirma !== firmaInventario) {
        firmaInventario = nuevaFirma;
        productos = nuevos;
        try { localStorage.setItem('hc_proto', JSON.stringify(productos)); } catch (e) {}
        pintarCatalogo();
        actualizarBarra();
      }
      $('aviso-estado').textContent = 'Inventario sincronizado · Toca o arrastra';
    } else if (!esFondo) {
      try { productos = JSON.parse(localStorage.getItem('hc_proto') || '[]'); } catch (e) { productos = []; }
      if (!productos.length) productos = RESPALDO.map(norm);
      firmaInventario = JSON.stringify(productos.map(p => [p.n, p.a, p.m, p.s]));
      $('aviso-estado').textContent = 'Mostrando respaldo local';
      pintarCatalogo();
      actualizarBarra();
    }
  } finally {
    consultando = false;
  }
}

function pintarCatalogo() {
  $('titulo-menu').textContent = etiquetaModo(modoActual);
  $('nota-catalogo').textContent = modoActual === 'a'
    ? 'Precios al detal · Puedes combinar con Al Mayor en el mismo pedido'
    : 'Precios al mayor · Se suman con tus unidades Al Detal';

  $('lista').innerHTML = productos.map((p, i) => {
    const k = claveItem(p.n, modoActual);
    const cantEnModo = carrito[k] || 0;
    const totalReservado = stockReservadoDeProducto(p.n);
    const sinStock = p.s <= 0;
    const fotoUrl = FOTOS_PRODUCTOS[p.n];
    const miniaturaHtml = fotoUrl
      ? '<img src="' + esc(fotoUrl) + '" alt="' + esc(p.n) + '" loading="lazy">'
      : '<svg viewBox="0 0 40 40" aria-hidden="true"><use href="#bee"/></svg>';

    return '<li class="item">' +
      '<button type="button" class="miniatura" data-foto="' + i + '" aria-label="Ver foto de ' + esc(p.n) + '">' + miniaturaHtml + '</button>' +
      '<span class="nombre-item">' + esc(p.n) + '</span>' +
      '<span class="detalle">' + (sinStock ? 'Agotado por ahora' : 'Disponibles: ' + p.s + (totalReservado ? ' (' + totalReservado + ' en tu pedido)' : '')) + '</span>' +
      '<span class="precio">' + money(precioUnitario(p, modoActual)) + ' · ' + etiquetaModo(modoActual) + '</span>' +
      '<div class="cantidad">' +
        '<button type="button" data-i="' + i + '" data-d="-1" aria-label="Quitar ' + esc(p.n) + ' ' + etiquetaModo(modoActual) + '">−</button>' +
        '<output id="q-' + i + '">' + cantEnModo + '</output>' +
        '<button type="button" class="mas" data-i="' + i + '" data-d="1" ' + (sinStock ? 'disabled' : '') + ' aria-label="Agregar ' + esc(p.n) + ' ' + etiquetaModo(modoActual) + '">+</button>' +
      '</div>' +
    '</li>';
  }).join('');
}

function resumenCarrito() {
  let unidades = 0, total = 0;
  const lineas = [];
  for (const [k, cant] of Object.entries(carrito)) {
    if (!cant) continue;
    const [nombre, m] = k.split('::');
    const prod = productos.find(x => x.n === nombre);
    if (!prod) continue;
    const unit = precioUnitario(prod, m);
    unidades += cant;
    total += unit * cant;
    lineas.push({ clave: k, producto: prod, modo: m, cantidad: cant, unitario: unit, subtotal: unit * cant });
  }
  return { unidades, total, lineas };
}

function actualizarBarra() {
  const { unidades, total } = resumenCarrito();
  $('pedido').hidden = unidades === 0;
  document.body.classList.toggle('con-pedido', unidades > 0);
  if (unidades > 0) {
    $('resumen').innerHTML = '<strong>' + money(total) + '</strong>' + unidades + (unidades === 1 ? ' producto en total' : ' productos en total');
  }
  if (!$('hoja-pedido').hidden) {
    if (unidades === 0) cerrarHojaPedido();
    else { pintarHojaPedido(); actualizarEnlaceWhatsApp(); }
  }
}

$('lista').addEventListener('click', e => {
  const btnFoto = e.target.closest('button[data-foto]');
  if (btnFoto) {
    const p = productos[btnFoto.dataset.foto];
    if (!p) return;
    $('visor-titulo').textContent = p.n;
    $('visor-desc').textContent = 'Precio Al Detal: ' + money(p.a) + ' · Precio Al Mayor: ' + money(p.m || p.a) + ' · Disponibles: ' + p.s;
    const img = $('visor-img');
    if (FOTOS_PRODUCTOS[p.n]) {
      img.src = FOTOS_PRODUCTOS[p.n];
      img.alt = p.n;
      img.hidden = false;
    } else {
      img.hidden = true;
      $('visor-desc').textContent += ' (Aún no hay foto cargada para este producto; se muestra vista previa de ficha).';
    }
    $('visor-foto').hidden = false;
    return;
  }

  const btn = e.target.closest('button[data-i]');
  if (!btn) return;
  const p = productos[btn.dataset.i];
  if (!p) return;
  const delta = Number(btn.dataset.d);
  const k = claveItem(p.n, modoActual);
  const act = carrito[k] || 0;
  const next = Math.max(0, act + delta);

  if (delta > 0) {
    const otrosModos = stockReservadoDeProducto(p.n) - act;
    if (p.s > 0 && (otrosModos + next) > p.s) {
      toast('Solo quedan ' + p.s + ' disponibles de ' + p.n);
      return;
    }
  }

  if (next > 0) carrito[k] = next;
  else delete carrito[k];

  $('q-' + btn.dataset.i).textContent = carrito[k] || 0;
  pintarCatalogo();
  actualizarBarra();
});

document.querySelectorAll('.pestana').forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    modoActual = btn.dataset.modo;
    document.querySelectorAll('.pestana').forEach(b => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
    pintarCatalogo();
    if (escenaControl) escenaControl.cambiarCatalogo(idx);
  });
});

let relojToast;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(relojToast);
  relojToast = setTimeout(() => t.classList.remove('visible'), 2000);
}

async function copiar(texto, msg) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    ta.remove();
  }
  toast(msg || 'Copiado');
}

function pintarPagos() {
  const all = [];
  $('filas-pago').innerHTML = PAGO.map(([titulo, filas]) => {
    all.push(titulo + ':');
    filas.forEach(([et, val]) => all.push(et + ': ' + val));
    return '<h3 class="subtitulo">' + esc(titulo) + '</h3>' + filas.map(([et, val]) =>
      '<div class="fila"><span class="etiqueta">' + esc(et) + '</span><span class="valor">' + esc(val) + '</span>' +
      '<button type="button" class="copiar" data-copy="' + esc(val) + '">Copiar</button></div>'
    ).join('');
  }).join('');

  $('filas-pago').addEventListener('click', e => {
    const b = e.target.closest('button[data-copy]');
    if (b) copiar(b.dataset.copy, 'Dato copiado');
  });
  $('copiar-todo').addEventListener('click', () => copiar(all.join('\n'), 'Datos de Pago Móvil copiados'));
  $('datos-pago-hoja').innerHTML = $('filas-pago').innerHTML;
  $('datos-pago-hoja').addEventListener('click', e => {
    const b = e.target.closest('button[data-copy]');
    if (b) copiar(b.dataset.copy, 'Dato copiado');
  });
  $('copiar-pago-hoja').addEventListener('click', () => copiar(all.join('\n'), 'Datos de Pago Móvil copiados'));
}

const CAMPOS = ['nombre', 'apellido', 'cedula', 'telefono', 'referencia'];
const limpiarNum = s => String(s || '').replace(/[\s.\-()+]/g, '');

function leerDatosCliente() {
  return {
    nombre: $('f-nombre').value.replace(/\s+/g, ' ').trim(),
    apellido: $('f-apellido').value.replace(/\s+/g, ' ').trim(),
    tipo: $('f-tipo').value,
    cedula: limpiarNum($('f-cedula').value).replace(/^[VvEe](?=\d)/, ''),
    telefono: limpiarNum($('f-telefono').value),
    referencia: limpiarNum($('f-referencia').value),
    entrega: $('f-entrega').value,
    direccion: $('f-direccion').value.trim()
  };
}

const REGLAS = {
  nombre: { ok: d => d.nombre.length >= 2 && !/\d/.test(d.nombre), msg: 'Escribe tu nombre.' },
  apellido: { ok: d => d.apellido.length >= 2 && !/\d/.test(d.apellido), msg: 'Escribe tu apellido.' },
  cedula: { ok: d => /^\d{6,9}$/.test(d.cedula), msg: 'Cédula de 6 a 9 dígitos.' },
  telefono: { ok: d => /^\d{10,13}$/.test(d.telefono), msg: 'Teléfono de 10 a 13 dígitos.' },
  referencia: { ok: d => /^\d{4,20}$/.test(d.referencia), msg: 'Referencia del Pago Móvil (mínimo 4 dígitos).' }
};

function validarCampo(id, mostrar) {
  const input = $('f-' + id);
  const err = $('e-' + id);
  const ok = REGLAS[id].ok(leerDatosCliente());
  if (mostrar || input.getAttribute('aria-invalid') === 'true') {
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    err.textContent = ok ? '' : REGLAS[id].msg;
    err.hidden = ok;
  }
  return ok;
}

function datosClienteValidos() {
  const d = leerDatosCliente();
  return CAMPOS.every(id => REGLAS[id].ok(d)) ? d : null;
}

function construirMensajeWhatsApp(d) {
  const { total, lineas } = resumenCarrito();
  const detalleItems = lineas.map(l =>
    '• ' + l.cantidad + ' × ' + l.producto.n + ' [' + etiquetaModo(l.modo) + ' — ' + formatoPresentacion(l.modo) + '] = ' + money(l.subtotal)
  ).join('\n');

  return 'Hola ' + NEG.nombre + ', quiero realizar este pedido:\n' +
    detalleItems +
    '\nTotal a pagar: ' + money(total) +
    '\n\nDatos de verificación de pago:\n' +
    'Cliente: ' + d.nombre + ' ' + d.apellido + '\n' +
    'Cédula: ' + d.tipo + '-' + d.cedula + '\n' +
    'Teléfono: ' + d.telefono + '\n' +
    'Referencia Pago Móvil: ' + d.referencia + '\n' +
    'Modalidad de entrega: ' + d.entrega +
    (d.direccion ? '\nDirección / referencia: ' + d.direccion : '');
}

function actualizarEnlaceWhatsApp() {
  const { unidades } = resumenCarrito();
  const d = datosClienteValidos();
  $('enviar-pedido').href = (unidades > 0 && d) ? waURL(construirMensajeWhatsApp(d)) : '#';
}

function pintarHojaPedido() {
  const { total, lineas } = resumenCarrito();
  $('lineas-pedido').innerHTML = lineas.map(l =>
    '<div class="linea-pedido">' +
      '<div class="datos-linea">' +
        '<span class="nombre-linea">' + esc(l.producto.n) + '</span>' +
        '<span class="nota-linea">' + esc(formatoPresentacion(l.modo)) + '</span>' +
        '<span class="precio-linea">' + l.cantidad + ' × ' + money(l.unitario) + ' = ' + money(l.subtotal) + '</span>' +
      '</div>' +
      '<div class="cantidad">' +
        '<button type="button" data-hoja-clave="' + esc(l.clave) + '" data-d="-1">−</button>' +
        '<output>' + l.cantidad + '</output>' +
        '<button type="button" class="mas" data-hoja-clave="' + esc(l.clave) + '" data-d="1">+</button>' +
      '</div>' +
    '</div>'
  ).join('');
  $('total-pedido').textContent = money(total);
}

function abrirHojaPedido() {
  if (!resumenCarrito().unidades) return;
  $('hoja-pedido').hidden = false;
  $('estado-envio').textContent = '';
  pintarHojaPedido();
  actualizarEnlaceWhatsApp();
  $('cerrar-pedido').focus();
}

function cerrarHojaPedido() {
  $('hoja-pedido').hidden = true;
  if (!$('pedido').hidden) $('abrir-pedido').focus();
}

async function descontarInventario(itemsPorProducto) {
  if (!/^https?:\/\//.test(APPS_SCRIPT_URL) || !itemsPorProducto.length) return;
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ items: itemsPorProducto })
    });
    itemsPorProducto.forEach(it => {
      const prod = productos.find(x => x.n.toLowerCase() === String(it.producto || '').toLowerCase());
      if (prod) prod.s = Math.max(0, prod.s - it.cantidad);
    });
    firmaInventario = JSON.stringify(productos.map(p => [p.n, p.a, p.m, p.s]));
    try { localStorage.setItem('hc_proto', JSON.stringify(productos)); } catch (e) {}
    pintarCatalogo();
    actualizarBarra();
  } catch (e) {}
}

function prepararHojaPedido() {
  const selEntrega = $('f-entrega');
  selEntrega.innerHTML = ['Retiro en punto acordado', ...NEG.delivery.map(z => 'Delivery: ' + z), 'Delivery (otra zona)']
    .map(op => '<option value="' + esc(op) + '">' + esc(op) + '</option>').join('');

  $('abrir-pedido').addEventListener('click', abrirHojaPedido);
  $('cerrar-pedido').addEventListener('click', cerrarHojaPedido);
  $('hoja-pedido').addEventListener('click', e => { if (e.target === $('hoja-pedido')) cerrarHojaPedido(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('hoja-pedido').hidden) cerrarHojaPedido(); });

  $('lineas-pedido').addEventListener('click', e => {
    const b = e.target.closest('button[data-hoja-clave]');
    if (!b) return;
    const clave = b.dataset.hoja-clave;
    const delta = Number(b.dataset.d);
    const [nombre] = clave.split('::');
    const prod = productos.find(x => x.n === nombre);
    if (!prod) return;
    const act = carrito[clave] || 0;
    const next = Math.max(0, act + delta);
    if (delta > 0 && prod.s > 0) {
      const otros = stockReservadoDeProducto(nombre) - act;
      if (otros + next > prod.s) {
        toast('Solo quedan ' + prod.s + ' disponibles de ' + nombre);
        return;
      }
    }
    if (next > 0) carrito[clave] = next;
    else delete carrito[clave];
    pintarCatalogo();
    actualizarBarra();
  });

  CAMPOS.forEach(id => {
    $('f-' + id).addEventListener('input', () => {
      validarCampo(id, false);
      actualizarEnlaceWhatsApp();
    });
  });
  $('f-tipo').addEventListener('change', actualizarEnlaceWhatsApp);
  $('f-entrega').addEventListener('change', actualizarEnlaceWhatsApp);
  $('f-direccion').addEventListener('input', actualizarEnlaceWhatsApp);

  $('enviar-pedido').addEventListener('click', e => {
    let primero = null;
    CAMPOS.forEach(id => { if (!validarCampo(id, true) && !primero) primero = id; });
    if (primero) {
      e.preventDefault();
      $('estado-envio').textContent = 'Completa o corrige los campos marcados para armar el mensaje.';
      $('f-' + primero).focus();
      return;
    }
    actualizarEnlaceWhatsApp();
    $('estado-envio').textContent = 'Abriendo WhatsApp con tu pedido y referencia...';

    const mapaStock = {};
    resumenCarrito().lineas.forEach(l => {
      mapaStock[l.producto.n] = (mapaStock[l.producto.n] || 0) + l.cantidad;
    });
    const itemsDescuento = Object.entries(mapaStock).map(([producto, cantidad]) => ({ producto, cantidad }));
    carrito = {};
    pintarCatalogo();
    actualizarBarra();
    descontarInventario(itemsDescuento);
  });

  $('vaciar-pedido').addEventListener('click', () => {
    carrito = {};
    pintarCatalogo();
    actualizarBarra();
    cerrarHojaPedido();
  });
}

$('cerrar-visor').addEventListener('click', () => { $('visor-foto').hidden = true; });
$('visor-foto').addEventListener('click', e => { if (e.target === $('visor-foto')) $('visor-foto').hidden = true; });

const caracas = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));

function pintarHorarioYEstado() {
  const ahora = caracas();
  const hHoy = HORARIO[ahora.getDay()];
  const mins = ahora.getHours() * 60 + ahora.getMinutes();
  const abierto = !!hHoy && mins >= hHoy[0] * 60 && mins < hHoy[1] * 60;
  const hLun = HORARIO[1];
  $('estado').classList.toggle('abierto', abierto);
  $('estado-texto').textContent = abierto
    ? 'Abierto ahora · cerramos a las ' + f12(hHoy[1])
    : 'Cerrado ahora · Lun a Sáb, ' + f12(hLun[0]) + ' a ' + f12(hLun[1]);

  $('horario').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => {
    const tramo = HORARIO[d];
    const esHoy = d === ahora.getDay();
    const cls = esHoy ? ' class="hoy"' : '';
    return '<span' + cls + '>' + DIAS[d] + (esHoy ? ' (hoy)' : '') + '</span>' +
           '<span' + cls + '>' + (tramo ? f12(tramo[0]) + ' a ' + f12(tramo[1]) : 'Cerrado') + '</span>';
  }).join('');
}

function pintarContactoYLegales() {
  const q = encodeURIComponent(NEG.dir);
  $('enlace-whatsapp').href = waURL('Hola ' + NEG.nombre + ', quisiera hacer un pedido.');
  $('enlace-telefono').textContent = NEG.tel;
  $('enlace-telefono').href = 'tel:' + NEG.tel.replace(/[^+\d]/g, '');
  const rvUrl = NEG.resena || 'https://www.google.com/maps/search/?api=1&query=' + q;
  $('enlace-resena').href = rvUrl;
  $('enlace-opinar').href = rvUrl;

  $('filas-contacto').innerHTML =
    '<div class="fila"><span class="etiqueta">WhatsApp</span><span class="valor">' + esc(NEG.tel) + '</span><a class="copiar" href="' + esc(waURL('Hola ' + NEG.nombre)) + '" target="_blank" rel="noopener">Escribir</a></div>' +
    '<div class="fila"><span class="etiqueta">Correo</span><span class="valor">' + esc(NEG.mail) + '</span><a class="copiar" href="mailto:' + esc(NEG.mail) + '">Enviar</a></div>';

  $('zonas-delivery').innerHTML = NEG.delivery.map(z => '<li>' + esc(z) + '</li>').join('');
  $('como-llegar').href = 'https://www.google.com/maps/dir/?api=1&destination=' + q;
  $('mapa').src = 'https://www.google.com/maps?q=' + q + '&output=embed';
  $('direccion').textContent = NEG.dir;

  $('opiniones').innerHTML = RESENAS.length
    ? RESENAS.map(r => '<blockquote class="opinion"><p>' + esc(r.texto) + '</p><cite>' + esc(r.nombre) + '</cite></blockquote>').join('')
    : '<p class="opinion">Aún no hay reseñas publicadas. Aquí solo se muestran opiniones reales de clientes.</p>';

  $('privacidad').innerHTML = [
    'Los datos del formulario y la referencia del Pago Móvil se usan para armar el mensaje de WhatsApp y verificar el pago.',
    'Las actualizaciones de disponibilidad consultan la hoja configurada para mostrar el stock al día.'
  ].map(x => '<li>' + esc(x) + '</li>').join('');

  $('accesibilidad').innerHTML = [
    'Incluye botón para pausar movimiento y respeta la preferencia de movimiento reducido.',
    'Controles táctiles amplios y soporte de teclado.'
  ].map(x => '<li>' + esc(x) + '</li>').join('');
}

function prepararAyuda() {
  const h = HORARIO[1];
  const faqs = [
    ['¿Cuál es el horario?', 'Atendemos de lunes a sábado de ' + f12(h[0]) + ' a ' + f12(h[1]) + '. Domingos cerrado.'],
    ['¿Dónde están ubicados?', NEG.dir + '.'],
    ['¿Cómo hago el pago?', 'Aceptamos Pago Móvil. Copia los datos en «Datos de pago» o dentro de «Tu pedido» y anota tu referencia.'],
    ['¿Hacen delivery?', 'Sí, hacia ' + NEG.delivery.join(', ') + '.']
  ];
  const msgs = $('chat-mensajes');
  const addMsg = (txt, mia) => {
    const p = document.createElement('p');
    p.className = 'burbuja' + (mia ? ' mia' : '');
    p.textContent = txt;
    msgs.append(p);
    msgs.scrollTop = msgs.scrollHeight;
  };
  addMsg('Hola. Elige una pregunta rápida sobre Honey Cream:', false);
  $('chat-preguntas').innerHTML = faqs.map(([q], i) => '<button type="button" data-q="' + i + '">' + esc(q) + '</button>').join('');
  $('chat-preguntas').addEventListener('click', e => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    const [q, a] = faqs[b.dataset.q];
    addMsg(q, true);
    addMsg(a, false);
  });
  $('chat-boton').addEventListener('click', () => {
    $('chat').hidden = false;
    $('chat-boton').hidden = true;
    $('chat-boton').setAttribute('aria-expanded', 'true');
  });
  $('chat-cerrar').addEventListener('click', () => {
    $('chat').hidden = true;
    $('chat-boton').hidden = false;
    $('chat-boton').setAttribute('aria-expanded', 'false');
  });
}

function crearEscenaMiel() {
  const cv = $('mar'), pz = $('pausa'), escenario = $('escenario');
  const mq = matchMedia('(prefers-reduced-motion:reduce)');
  let paused = mq.matches, raf = 0, px = -1e3, py = -1e3, W = 0, H = 0, sy = scrollY, last = 0, gl = null;
  let catalogoIdx = 0, giro = 0, vGiro = 0, arrastrando = false, xPrev = 0, reunion = 0;

  try { gl = cv.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (e) {}
  if (!gl) return { cambiarCatalogo() {}, pausar() {} };

  const vs = 'attribute vec3 a;attribute vec2 b;uniform vec2 r;uniform float d;varying float k,g;void main(){vec2 c=a.xy/r*2.-1.;gl_Position=vec4(c.x,-c.y,0.,1.);gl_PointSize=min(a.z*d,64.);k=b.x;g=b.y;}';
  const fs = 'precision mediump float;varying float k,g;void main(){vec2 p=(gl_PointCoord-.5)*2.;float a;if(k<.5){vec2 q=abs(p);float h=max(q.x*.866+q.y*.5,q.y);a=smoothstep(.16,0.,abs(h-.8))+smoothstep(.8,0.,h)*.1;}else if(k<1.5){a=smoothstep(1.,0.,length(p));a*=a*1.3;}else{float e=length(p*vec2(.85,1.3));a=smoothstep(.75,.6,e)*(.6+.4*step(0.,sin(p.y*10.)));}a*=.32+.68*g;vec3 c=mix(vec3(.89,.69,.29),vec3(1.,.9,.64),g);gl_FragColor=vec4(c*a,a);}';

  const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram();
  gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  gl.useProgram(pr);

  const lo = n => gl.getUniformLocation(pr, n);
  const low = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 2;
  const N = low ? 48 : 88;
  const F = new Float32Array(N * 5);
  const V = [];
  const bf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bf);
  gl.bufferData(gl.ARRAY_BUFFER, F.byteLength, gl.DYNAMIC_DRAW);

  const A = gl.getAttribLocation(pr, 'a'), B = gl.getAttribLocation(pr, 'b');
  gl.enableVertexAttribArray(A); gl.vertexAttribPointer(A, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(B); gl.vertexAttribPointer(B, 2, gl.FLOAT, false, 20, 12);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0, 0, 0, 0);

  function rs() {
    const d = Math.min(devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(lo('r'), W, H);
    gl.uniform1f(lo('d'), d);
  }
  rs();

  for (let i = 0; i < N; i++) {
    const k = i < N * .5 ? 0 : i < N * .92 ? 1 : 2;
    const ang = (i / N) * Math.PI * 2;
    V.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: 0, vy: 0,
      bx: (Math.random() - .5) * .3,
      by: -.08 - Math.random() * .22,
      s: k ? (k == 1 ? 8 + Math.random() * 14 : 20) : 16 + Math.random() * 28,
      k, g: 0,
      z: .25 + Math.random() * .75,
      ph: Math.random() * 6.3,
      ang,
      rad: 24 + (i % 5) * 14
    });
  }

  function suave(a, b, x) {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function frame(t) {
    raf = 0;
    if (low && !paused && t - last < 30) { raf = requestAnimationFrame(frame); return; }
    last = t;
    const s = t / 1000;

    const rect = escenario.getBoundingClientRect();
    const cx = rect.left + rect.width * .5;
    const cy = rect.top + rect.height * .48;
    const normY = cy / Math.max(1, H);
    const metaReunion = suave(.95, .55, normY) * suave(-.35, .05, normY);
    reunion += (metaReunion - reunion) * .12;

    if (!arrastrando) {
      giro += vGiro * .016 + (catalogoIdx === 1 ? .012 : .005);
      vGiro *= .94;
    }

    for (let i = 0; i < N; i++) {
      const p = V[i];
      if (p.k == 2) {
        p.bx = Math.sin(s * .9 + p.ph) * .7;
        p.by = Math.cos(s * 1.3 + p.ph) * .5;
      }
      p.vx += (p.bx - p.vx) * .03;
      p.vy += (p.by - p.vy) * .03;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -60) p.x = W + 60; else if (p.x > W + 60) p.x = -60;

      const baseRy = ((p.y - sy * p.z * .5) % H + H) % H;
      const dx = p.x - px, dy = baseRy - py, d2 = dx * dx + dy * dy;
      if (d2 < 19600) {
        const dist = Math.sqrt(d2) || 1, f = 1 - dist / 140;
        p.vx += dx / dist * f * 1.2;
        p.vy += dy / dist * f * 1.2;
        p.g = Math.min(1, p.g + f * .6);
      }
      p.g *= .95;

      const factorForma = catalogoIdx === 1 ? 1.25 : .88;
      const a = p.ang + giro;
      const tx = cx + Math.cos(a) * p.rad * factorForma;
      const ty = cy + Math.sin(a) * p.rad * .68 * factorForma;

      const drawX = p.x + (tx - p.x) * reunion;
      const drawY = baseRy + (ty - baseRy) * reunion;

      const o = i * 5;
      F[o] = drawX;
      F[o + 1] = drawY;
      F[o + 2] = p.s * (1 + reunion * .18);
      F[o + 3] = p.k;
      F[o + 4] = Math.min(1, p.g + reunion * .35);
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, F);
    gl.drawArrays(gl.POINTS, 0, N);
    if (!paused && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function setP(v) {
    paused = v;
    pz.textContent = paused ? 'Reanudar movimiento' : 'Pausar movimiento';
    document.documentElement.classList.toggle('pausado', paused);
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const mv = (x, y) => { px = x; py = y; }, off = () => mv(-1e3, -1e3);
  addEventListener('pointermove', e => mv(e.clientX, e.clientY), { passive: true });
  addEventListener('pointerdown', e => mv(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) mv(t.clientX, t.clientY); }, { passive: true });
  addEventListener('pointerup', off);
  addEventListener('touchend', off);
  document.addEventListener('mouseleave', off);
  addEventListener('scroll', () => { sy = scrollY; if (paused && !raf) raf = requestAnimationFrame(frame); }, { passive: true });
  addEventListener('resize', () => { rs(); if (!raf) raf = requestAnimationFrame(frame); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !paused && !raf) raf = requestAnimationFrame(frame); });
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); paused = true; });

  escenario.addEventListener('pointerdown', e => { arrastrando = true; xPrev = e.clientX; vGiro = 0; });
  escenario.addEventListener('pointermove', e => {
    if (!arrastrando) return;
    const dx = e.clientX - xPrev;
    xPrev = e.clientX;
    giro += dx * .014;
    vGiro = dx * .5;
    if (!raf) raf = requestAnimationFrame(frame);
  });
  ['pointerup', 'pointercancel'].forEach(ev => escenario.addEventListener(ev, () => { arrastrando = false; }));

  pz.addEventListener('click', () => setP(!paused));
  setP(paused);

  return {
    cambiarCatalogo(idx) {
      catalogoIdx = idx;
      vGiro += idx === 1 ? 1.8 : -1.8;
      if (!raf) raf = requestAnimationFrame(frame);
    }
  };
}

function iniciar() {
  pintarHorarioYEstado();
  pintarContactoYLegales();
  pintarPagos();
  prepararHojaPedido();
  prepararAyuda();
  escenaControl = crearEscenaMiel();
  cargar();
  setInterval(pintarHorarioYEstado, 60000);
  setInterval(() => { if (!document.hidden) cargar(true); }, 5000);
}
iniciar();
