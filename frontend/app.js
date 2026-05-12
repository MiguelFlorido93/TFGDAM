// =============================================================
// Stockly - Frontend (vanilla JS)
// Autores: Adrián Bravo Santos y Miguel Ángel Florido
// =============================================================

// API siempre relativa: el backend sirve también el frontend, así que la API
// está en el mismo origin que la página. Esto evita romper desde otros PCs.
const API = '/api';

// ----------- Estado global -----------
const state = {
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    view: 'productos',
    page: 1,
    limit: 20,
    total: 0,
    search: '',
    categoria: '',
    sort: 'id',
    dir: 'asc',
    productoSel: null,
    reservaFiltro: '',
    invFiltro: { search: '', categoria: '', stockBajo: false },
};

// ----------- Utilidades -----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function el(tag, attrs = {}, ...hijos) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
        if (v == null || v === false) return;
        if (k === 'class') n.className = v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else if (k === 'html') n.innerHTML = v;
        else n.setAttribute(k, v);
    });
    hijos.flat().forEach(h => {
        if (h == null || h === false) return;
        n.append(h?.nodeType ? h : document.createTextNode(h));
    });
    return n;
}

function toast(msg, tipo = 'info', ms = 2800) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + tipo;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}

async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    const r = await fetch(`${API}${path}`, { ...opts, headers });
    if (r.status === 401) {
        cerrarSesion();
        throw new Error('Sesión expirada');
    }
    const data = r.headers.get('content-type')?.includes('application/json') ? await r.json() : await r.text();
    if (!r.ok) throw new Error(data.error || data || `HTTP ${r.status}`);
    return data;
}

function fmt(n) {
    return new Intl.NumberFormat('es-ES').format(n);
}
function fmtMoney(n) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(+n || 0);
}
/** Formato monetario compacto (1,2K / 3,4M / 5,6B €) — útil para stats grandes. */
function fmtMoneyCompact(n) {
    const v = +n || 0;
    if (Math.abs(v) < 10000) return fmtMoney(v);
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(v);
}
function fmtDate(d) {
    return d ? new Date(d).toLocaleString('es-ES') : '—';
}
function iniciales(n) {
    return (n || '?')
        .split(' ')
        .map(x => x[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

// Escapa contenido para inserción segura en innerHTML
const _div = document.createElement('div');
function esc(s) {
    if (s == null) return '';
    _div.textContent = String(s);
    return _div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Debounce reutilizable
function debounce(fn, ms = 250) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

// =============================================================
// Skeleton loaders
// =============================================================
function skLine(extra = '') {
    return el('span', { class: 'skeleton sk-line ' + extra });
}
function skPill() {
    return el('span', { class: 'skeleton sk-pill' });
}

function skeletonProductos(count = 8) {
    const grid = $('#productos-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
        grid.append(
            el(
                'div',
                { class: 'card skeleton-card' },
                skLine('short'),
                skLine('long'),
                skLine('medium'),
                skLine('short'),
                skLine('medium'),
                skLine('short')
            )
        );
    }
    $('#prod-count').textContent = '';
}

function skeletonReservas(count = 5) {
    const cont = $('#reservas-lista');
    if (!cont) return;
    cont.innerHTML = '';
    for (let i = 0; i < count; i++) {
        cont.append(
            el(
                'div',
                { class: 'reserva skeleton-card' },
                el('div', { class: 'info' }, skLine('long'), skLine('medium'), skLine('short')),
                skPill(),
                el('div', {})
            )
        );
    }
}

function skeletonTabla(selector, cols, rows = 6) {
    const tbody = $(selector);
    if (!tbody) return;
    tbody.innerHTML = '';
    for (let i = 0; i < rows; i++) {
        const tr = el('tr', { class: 'skeleton-card' });
        for (let j = 0; j < cols; j++) {
            tr.append(el('td', {}, el('span', { class: 'skeleton sk-line ' + (j === cols - 1 ? 'short' : '') })));
        }
        tbody.append(tr);
    }
}

function skeletonDashboard() {
    ['st-productos', 'st-stock-bajo', 'st-usuarios', 'st-pendientes', 'st-entregadas', 'st-valor'].forEach(id => {
        const n = $('#' + id);
        if (!n) return;
        n.innerHTML = '';
        n.append(el('span', { class: 'skeleton sk-line', style: 'display:inline-block;width:84px;height:1.6rem' }));
    });
    ['chart-reservas', 'chart-categorias'].forEach(id => {
        const c = $('#' + id);
        if (!c) return;
        c.innerHTML = '';
        c.append(el('span', { class: 'skeleton sk-block', style: 'height:200px' }));
    });
    const top = $('#top-productos');
    if (top) {
        top.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            top.append(
                el(
                    'div',
                    { class: 'rank-row skeleton-card' },
                    el('span', { class: 'skeleton sk-line short', style: 'width:36px' }),
                    el('div', { style: 'flex:1' }, skLine('long'), skLine('short')),
                    skPill()
                )
            );
        }
    }
    const mov = $('#movimientos');
    if (mov) {
        mov.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            mov.append(
                el(
                    'div',
                    { class: 'mov-row skeleton-card' },
                    el('span', { class: 'skeleton sk-line short' }),
                    el('span', { class: 'skeleton sk-line long' }),
                    el('span', { class: 'skeleton sk-line short' }),
                    el('span', { class: 'skeleton sk-line short' })
                )
            );
        }
    }
}

// =============================================================
// Autenticación
// =============================================================
async function login(email, password) {
    const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = r.token;
    state.user = r.user;
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    entrarApp();
}

async function registro(nombre, email, password) {
    const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ nombre, email, password }) });
    state.token = r.token;
    state.user = r.user;
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    entrarApp();
}

function cerrarSesion() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    $('#auth-screen').classList.remove('hidden');
    $('#app').classList.add('hidden');
}

function entrarApp() {
    $('#auth-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    pintarUsuario();
    aplicarRol();
    cambiarVista('productos');
    cargarCategorias();
}

function pintarUsuario() {
    const u = state.user;
    if (!u) return;
    $('#user-name').textContent = u.nombre.split(' ')[0];
    $('#user-avatar').textContent = iniciales(u.nombre);
    $('#dd-name').textContent = u.nombre;
    $('#dd-email').textContent = u.email;
    $('#dd-rol').textContent = u.rol;
}

function aplicarRol() {
    const esAdmin = state.user && (state.user.rol === 'admin' || state.user.rol === 'operario');
    $$('.admin-only').forEach(n => (n.style.display = esAdmin ? '' : 'none'));
}

// =============================================================
// Navegación de vistas
// =============================================================
function cambiarVista(view) {
    state.view = view;
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${view}`)?.classList.add('active');
    $$('.tab, .bn').forEach(t => t.classList.toggle('active', t.dataset.view === view));

    if (view === 'productos') cargarProductos();
    if (view === 'reservas') cargarReservas();
    if (view === 'dashboard') cargarDashboard();
    if (view === 'inventario') {
        cargarInventario();
        cargarCategorias();
    }
    if (view === 'usuarios') cargarUsuarios();
}

// =============================================================
// Productos (catálogo cliente)
// =============================================================
async function cargarCategorias() {
    try {
        const cats = await api('/categorias');
        const opts = [
            '<option value="">Todas las categorías</option>',
            ...cats.map(c => `<option value="${c.id}">${c.nombre}</option>`),
        ].join('');
        const fc = $('#filtro-categoria');
        if (fc) fc.innerHTML = opts;
        const ic = $('#inv-categoria');
        if (ic) ic.innerHTML = opts;
        cargarCategorias._cache = cats;
    } catch (e) {
        console.warn(e);
    }
}

async function cargarProductos() {
    skeletonProductos();
    const params = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        search: state.search,
        categoria: state.categoria,
        sort: state.sort,
        dir: state.dir,
    });
    try {
        const r = await api('/productos?' + params);
        state.total = r.total;
        renderProductos(r.data);
        renderPaginacion(r.pages || Math.ceil(r.total / state.limit));
        $('#prod-count').textContent = `${fmt(r.total)} resultado${r.total === 1 ? '' : 's'}`;
    } catch (e) {
        toast(e.message, 'error');
    }
}

function stockChip(disp, min) {
    if (disp <= 0) return el('span', { class: 'stock-chip bad' }, 'Sin stock');
    if (disp <= (min || 5)) return el('span', { class: 'stock-chip warn' }, `Bajo: ${disp}`);
    return el('span', { class: 'stock-chip' }, `Disponible: ${disp}`);
}

function renderProductos(productos) {
    const grid = $('#productos-grid');
    grid.innerHTML = '';
    if (!productos.length) {
        grid.append(el('p', { class: 'muted' }, 'No se encontraron productos.'));
        return;
    }
    productos.forEach(p => {
        const disp = p.stock - p.stock_reservado;
        const card = el(
            'div',
            { class: 'card' },
            el('span', { class: 'sku' }, p.sku),
            el('h3', {}, p.nombre),
            p.categoria && el('span', { class: 'cat-pill' }, p.categoria),
            el('div', { class: 'meta' }, '📍 ', p.ubicacion),
            stockChip(disp, p.stock_minimo),
            el('div', { class: 'precio' }, fmtMoney(p.precio)),
            el(
                'button',
                {
                    class: 'btn btn-primary btn-block',
                    onclick: () => abrirModalReserva(p),
                    disabled: disp <= 0,
                },
                disp <= 0 ? 'Sin stock' : 'Reservar'
            )
        );
        grid.append(card);
    });
}

function renderPaginacion(pages) {
    pages = Math.max(1, pages);
    $('#pagina-info').textContent = `Página ${state.page} de ${pages}`;
    $('#prev').disabled = state.page <= 1;
    $('#next').disabled = state.page >= pages;
}

// =============================================================
// Modal reserva
// =============================================================
function abrirModalReserva(producto) {
    state.productoSel = producto;
    const disp = producto.stock - producto.stock_reservado;
    $('#modal-titulo').textContent = `Reservar · ${producto.sku}`;
    $('#modal-body').innerHTML = `
        <p><strong>${producto.nombre}</strong></p>
        <p class="muted">Disponible: ${disp} · Ubicación: ${producto.ubicacion}</p>
        <label>Cantidad
            <input id="m-cantidad" type="number" min="1" max="${disp}" value="1">
        </label>
        <label class="row-2">
            <span>Fecha de recogida<input id="m-fecha" type="date"></span>
            <span>Notas<input id="m-notas" type="text" placeholder="Opcional"></span>
        </label>
    `;
    $('#modal-foot').innerHTML = `
        <button class="btn btn-ghost" id="m-cancel">Cancelar</button>
        <button class="btn btn-primary" id="m-ok">Confirmar reserva</button>
    `;
    $('#m-cancel').onclick = cerrarModal;
    $('#m-ok').onclick = confirmarReserva;
    abrirModal();
}

async function confirmarReserva() {
    try {
        const body = {
            producto_id: state.productoSel.id,
            cantidad: parseInt($('#m-cantidad').value, 10),
            fecha_recogida: $('#m-fecha').value || null,
            notas: $('#m-notas').value || null,
        };
        const r = await api('/reservas', { method: 'POST', body: JSON.stringify(body) });
        toast(`Reserva #${r.id} creada`, 'ok');
        cerrarModal();
        cargarProductos();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// =============================================================
// Reservas
// =============================================================
async function cargarReservas() {
    skeletonReservas();
    const params = new URLSearchParams();
    if (state.reservaFiltro) params.set('estado', state.reservaFiltro);
    try {
        const data = await api('/reservas?' + params);
        renderReservas(data);
    } catch (e) {
        toast(e.message, 'error');
    }
}

// Selección bulk de reservas — Set<id>. Se vacía al recargar la lista.
const _resSel = { ids: new Set(), data: [] };

function renderReservas(data) {
    const cont = $('#reservas-lista');
    cont.innerHTML = '';
    _resSel.data = data;
    // Filtra IDs huérfanos de la selección (estado ya cambiado o filtro distinto)
    const idsVisibles = new Set(data.map(r => r.id));
    for (const id of [..._resSel.ids]) if (!idsVisibles.has(id)) _resSel.ids.delete(id);

    if (!data.length) {
        cont.append(el('p', { class: 'muted' }, 'No hay reservas con estos filtros.'));
        actualizarBarraSeleccion();
        return;
    }
    const staff = esStaff();

    // Cabecera con "Seleccionar todas" (sólo si hay reservas seleccionables)
    const seleccionables = data.filter(r => puedeAccionarReserva(r));
    if (seleccionables.length) {
        const todos = seleccionables.every(r => _resSel.ids.has(r.id));
        const algunos = seleccionables.some(r => _resSel.ids.has(r.id));
        const cab = el(
            'label',
            { class: 'reservas-seltodo' },
            (() => {
                const cb = el('input', { type: 'checkbox' });
                cb.checked = todos;
                cb.indeterminate = algunos && !todos;
                cb.onchange = () => {
                    if (cb.checked) seleccionables.forEach(r => _resSel.ids.add(r.id));
                    else seleccionables.forEach(r => _resSel.ids.delete(r.id));
                    renderReservas(data);
                };
                return cb;
            })(),
            el('span', { class: 'muted' }, `Seleccionar ${seleccionables.length} reserva(s)`)
        );
        cont.append(cab);
    }

    data.forEach(r => {
        const seleccionable = puedeAccionarReserva(r);
        const checked = _resSel.ids.has(r.id);

        const checkbox = el('input', {
            type: 'checkbox',
            class: 'reserva-check',
            disabled: !seleccionable,
            title: seleccionable ? 'Seleccionar para acción en bloque' : 'Reserva en estado final',
            onchange: e => {
                if (e.target.checked) _resSel.ids.add(r.id);
                else _resSel.ids.delete(r.id);
                actualizarBarraSeleccion();
                // Re-render sólo si el "seleccionar todas" debe cambiar
                renderReservas(data);
            },
        });
        if (checked) checkbox.checked = true;

        const acciones = el('div', { class: 'small-actions' });
        acciones.append(
            el(
                'button',
                {
                    class: 'btn btn-ghost btn-mini',
                    title: 'Imprimir albarán',
                    onclick: () => imprimirAlbaran(r),
                },
                '🖨'
            )
        );
        if (staff && r.estado === 'pendiente')
            acciones.append(
                el(
                    'button',
                    { class: 'btn btn-ghost btn-mini', onclick: () => cambiarEstadoReserva(r.id, 'confirmada') },
                    'Confirmar'
                )
            );
        if (staff && (r.estado === 'pendiente' || r.estado === 'confirmada'))
            acciones.append(
                el(
                    'button',
                    { class: 'btn btn-primary btn-mini', onclick: () => cambiarEstadoReserva(r.id, 'entregada') },
                    'Entregar'
                )
            );
        if (r.estado === 'pendiente' || r.estado === 'confirmada')
            acciones.append(
                el('button', { class: 'btn btn-danger btn-mini', onclick: () => cancelarReserva(r.id) }, 'Cancelar')
            );

        const fila = el(
            'div',
            { class: 'reserva' + (checked ? ' seleccionada' : '') },
            checkbox,
            el(
                'div',
                { class: 'info' },
                el('strong', {}, skuLink({ id: r.producto_id, sku: r.sku }, 'sku sku-inline'), ' · ', r.producto),
                el('div', { class: 'muted' }, `Cantidad: ${r.cantidad} · Ubicación: ${r.ubicacion}`),
                el(
                    'div',
                    { class: 'muted' },
                    `Reservada: ${fmtDate(r.fecha_reserva)}` +
                        (r.fecha_recogida ? ` · Recogida: ${r.fecha_recogida}` : '')
                ),
                staff && el('div', { class: 'muted' }, `👤 ${r.usuario}`)
            ),
            el('span', { class: 'estado ' + r.estado }, r.estado),
            acciones
        );
        cont.append(fila);
    });

    actualizarBarraSeleccion();
}

/** True si esta reserva puede transicionarse por el usuario actual. */
function puedeAccionarReserva(r) {
    if (r.estado === 'entregada' || r.estado === 'cancelada') return false;
    if (state.user.rol === 'cliente') return r.usuario_id === state.user.id;
    return true; // staff: cualquier no-final
}

function actualizarBarraSeleccion() {
    const bar = $('#bulk-bar');
    if (!bar) return;
    if (_resSel.ids.size === 0) {
        bar.classList.add('hidden');
        return;
    }

    const seleccionadas = _resSel.data.filter(r => _resSel.ids.has(r.id));
    const algunaPendiente = seleccionadas.some(r => r.estado === 'pendiente');
    const algunaActiva = seleccionadas.some(r => r.estado === 'pendiente' || r.estado === 'confirmada');
    const staff = esStaff();

    bar.classList.remove('hidden');
    bar.innerHTML = `
        <div class="bulk-info">
            <span class="bulk-count">${_resSel.ids.size}</span>
            <span class="muted">reserva(s) seleccionada(s)</span>
        </div>
        <div class="bulk-acciones">
            ${staff && algunaPendiente ? '<button class="btn btn-ghost"   data-bulk="confirmar">✓ Confirmar</button>' : ''}
            ${staff && algunaActiva ? '<button class="btn btn-primary" data-bulk="entregar">📦 Entregar</button>' : ''}
            ${algunaActiva ? '<button class="btn btn-danger"  data-bulk="cancelar">✕ Cancelar</button>' : ''}
            <button class="btn btn-ghost" data-bulk="clear">Limpiar</button>
        </div>
    `;
    bar.querySelectorAll('[data-bulk]').forEach(b => {
        b.onclick = () => accionBulk(b.dataset.bulk);
    });
}

const _ACCION_LABEL = {
    confirmar: { titulo: 'Confirmar reservas', verbo: 'confirmar', icono: '✓', peligroso: false },
    entregar: { titulo: 'Entregar reservas', verbo: 'entregar', icono: '📦', peligroso: false },
    cancelar: { titulo: 'Cancelar reservas', verbo: 'cancelar', icono: '✕', peligroso: true },
};

async function accionBulk(accion) {
    if (accion === 'clear') {
        _resSel.ids.clear();
        renderReservas(_resSel.data);
        return;
    }
    const conf = _ACCION_LABEL[accion];
    if (!conf) return;
    const ids = [..._resSel.ids];
    const ok = await confirmar({
        titulo: conf.titulo,
        mensaje: `Se va a ${conf.verbo} ${ids.length} reserva(s). Las que no estén en un estado válido se omitirán.`,
        ok: `Sí, ${conf.verbo}`,
        cancel: 'Volver',
        peligroso: conf.peligroso,
        icono: conf.icono,
    });
    if (!ok) return;

    try {
        const r = await api('/reservas/bulk', { method: 'POST', body: JSON.stringify({ ids, accion }) });
        const tipo = r.fallidas === 0 ? 'ok' : r.aplicadas > 0 ? 'info' : 'error';
        toast(`Bulk: ${r.aplicadas} aplicada(s) · ${r.fallidas} fallo(s)`, tipo);
        _resSel.ids.clear();
        cargarReservas();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function cambiarEstadoReserva(id, estado) {
    try {
        await api(`/reservas/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) });
        toast(`Reserva ${estado}`, 'ok');
        cargarReservas();
    } catch (e) {
        toast(e.message, 'error');
    }
}

/**
 * Genera el HTML del albarán en un div oculto y dispara window.print().
 * Tras imprimir/cancelar, limpia el DOM.
 */
function imprimirAlbaran(r) {
    // Elimina cualquier albarán anterior
    document.getElementById('albaran-print')?.remove();

    const estadoLabel =
        {
            pendiente: 'PENDIENTE',
            confirmada: 'CONFIRMADA',
            entregada: 'ENTREGADA',
            cancelada: 'CANCELADA',
        }[r.estado] || r.estado.toUpperCase();

    const ahora = new Date();
    const impreso = ahora.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const div = document.createElement('div');
    div.id = 'albaran-print';
    div.innerHTML = `
        <header class="alb-head">
            <div class="alb-brand">
                <div class="alb-logo">📦</div>
                <div>
                    <div class="alb-titulo">STOCKLY</div>
                    <div class="alb-subtitulo">Albarán de reserva</div>
                </div>
            </div>
            <div class="alb-meta">
                <div><strong>Nº</strong> ${esc(String(r.id).padStart(6, '0'))}</div>
                <div><strong>Estado</strong> ${esc(estadoLabel)}</div>
                <div><strong>Fecha reserva</strong> ${esc(fmtDate(r.fecha_reserva))}</div>
            </div>
        </header>

        <div class="alb-hazard"></div>

        <section class="alb-bloque">
            <h2>Cliente</h2>
            <table>
                <tr><th>Nombre</th><td>${esc(r.usuario || '—')}</td></tr>
                <tr><th>Email</th> <td>${esc(r.usuario_email || '—')}</td></tr>
            </table>
        </section>

        <section class="alb-bloque">
            <h2>Producto</h2>
            <table>
                <tr><th>SKU</th>       <td><code>${esc(r.sku)}</code></td></tr>
                <tr><th>Descripción</th><td>${esc(r.producto)}</td></tr>
                <tr><th>Ubicación</th> <td>${esc(r.ubicacion || '—')}</td></tr>
                <tr><th>Precio unidad</th><td>${esc(fmtMoney(r.precio))}</td></tr>
            </table>
        </section>

        <section class="alb-bloque alb-detalles">
            <h2>Detalles de la reserva</h2>
            <table>
                <tr><th>Cantidad</th>     <td class="alb-cantidad">${r.cantidad}</td></tr>
                <tr><th>Importe total</th><td>${esc(fmtMoney((+r.precio || 0) * r.cantidad))}</td></tr>
                <tr><th>Recogida prevista</th><td>${esc(r.fecha_recogida || '— sin fecha —')}</td></tr>
                <tr><th>Fecha entrega</th><td>${esc(r.fecha_entrega ? fmtDate(r.fecha_entrega) : '—')}</td></tr>
                ${r.notas ? `<tr><th>Notas</th><td>${esc(r.notas)}</td></tr>` : ''}
            </table>
        </section>

        <footer class="alb-firma">
            <div>
                <div class="alb-firma-linea"></div>
                <small>Firma del operario</small>
            </div>
            <div>
                <div class="alb-firma-linea"></div>
                <small>Firma del cliente · Recibí conforme</small>
            </div>
        </footer>

        <div class="alb-pie">
            Documento generado el ${esc(impreso)} · Stockly · TFG DAM
        </div>
    `;
    document.body.appendChild(div);

    // Llamar a print en el siguiente frame para que el navegador layoutee
    requestAnimationFrame(() => {
        window.print();
        // Limpieza tras cerrar el diálogo (afterprint funciona en Chrome/Firefox/Edge)
        const limpiar = () => {
            div.remove();
            window.removeEventListener('afterprint', limpiar);
        };
        window.addEventListener('afterprint', limpiar);
        // Fallback: si afterprint no dispara (Safari viejo), limpia a los 2 s
        setTimeout(limpiar, 60_000);
    });
}

async function cancelarReserva(id) {
    const ok = await confirmar({
        titulo: 'Cancelar reserva',
        mensaje: `¿Seguro que quieres cancelar la reserva #${id}? El stock volverá a estar disponible.`,
        ok: 'Sí, cancelar',
        cancel: 'Volver',
        peligroso: true,
        icono: '✕',
    });
    if (!ok) return;
    try {
        await api(`/reservas/${id}`, { method: 'DELETE' });
        toast('Reserva cancelada', 'ok');
        cargarReservas();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// =============================================================
// Dashboard
// =============================================================
async function cargarDashboard() {
    skeletonDashboard();
    try {
        const s = await api('/admin/stats');
        $('#st-productos').textContent = fmt(s.totales.productos);
        $('#st-stock-bajo').textContent = fmt(s.totales.stock_bajo);
        $('#st-usuarios').textContent = fmt(s.totales.usuarios);
        $('#st-pendientes').textContent = fmt(s.totales.pendientes);
        $('#st-entregadas').textContent = fmt(s.totales.entregadas);
        const valor = s.totales.valor_inventario;
        const stValor = $('#st-valor');
        stValor.textContent = fmtMoneyCompact(valor);
        stValor.title = fmtMoney(valor); // valor exacto al hacer hover

        renderBarChart(
            '#chart-reservas',
            s.reservasPorDia.map(d => ({ label: d.dia.slice(5), value: d.total }))
        );
        renderBarChart(
            '#chart-categorias',
            s.porCategoria.map(c => ({ label: c.nombre.slice(0, 6), value: c.stock_total }))
        );

        const top = $('#top-productos');
        top.innerHTML = '';
        s.topProductos.forEach((p, i) =>
            top.append(
                el(
                    'div',
                    {
                        class: 'rank-row rank-clickable',
                        title: 'Ver histórico de movimientos',
                        onclick: () => abrirHistorial(p.id),
                    },
                    el('span', { class: 'rank-pos' }, `#${i + 1}`),
                    el('div', { style: 'flex:1' }, el('strong', {}, p.nombre), el('div', { class: 'muted' }, p.sku)),
                    el('span', { class: 'role-badge' }, `${p.reservas} reservas`)
                )
            )
        );

        const movs = await api('/admin/movimientos?limit=20');
        const cont = $('#movimientos');
        cont.innerHTML = '';
        movs.forEach(m =>
            cont.append(
                el(
                    'div',
                    { class: 'mov-row' },
                    el('span', { class: 'mov-tipo ' + m.tipo }, m.tipo),
                    el('span', {}, `${m.sku} · ${m.producto}`),
                    el('span', { class: 'muted' }, `${m.cantidad > 0 ? '+' : ''}${m.cantidad}`),
                    el('span', { class: 'muted' }, fmtDate(m.fecha))
                )
            )
        );

        $('#link-csv').onclick = e => {
            e.preventDefault();
            descargarBlob('/admin/export/reservas.csv', 'reservas.csv');
        };
    } catch (e) {
        toast(e.message, 'error');
    }
}

function renderBarChart(sel, data) {
    const cont = $(sel);
    cont.innerHTML = '';
    if (!data.length) {
        cont.append(el('p', { class: 'muted' }, 'Sin datos'));
        return;
    }
    const max = Math.max(...data.map(d => d.value), 1);
    data.forEach(d => {
        const h = (d.value / max) * 100;
        const bar = el(
            'div',
            { class: 'bar', style: `height:${h}%`, title: `${d.label}: ${d.value}` },
            el('span', { class: 'val' }, d.value),
            el('small', {}, d.label)
        );
        cont.append(bar);
    });
}

// =============================================================
// Inventario (admin)
// =============================================================
async function cargarInventario() {
    skeletonTabla('#inv-body', 9);
    const f = state.invFiltro;
    const params = new URLSearchParams({
        limit: 100,
        search: f.search,
        categoria: f.categoria,
        stock_bajo: f.stockBajo ? 1 : 0,
    });
    try {
        const r = await api('/productos?' + params);
        const tbody = $('#inv-body');
        tbody.innerHTML = '';
        r.data.forEach(p => {
            const disp = p.stock - p.stock_reservado;
            const fila = el(
                'tr',
                {},
                el('td', {}, skuLink(p, 'sku')),
                el('td', {}, p.nombre),
                el('td', {}, p.categoria || '—'),
                el('td', {}, p.ubicacion),
                el('td', {}, String(p.stock)),
                el('td', {}, String(p.stock_reservado)),
                el('td', {}, String(p.stock_minimo)),
                el('td', {}, fmtMoney(p.precio)),
                el(
                    'td',
                    {},
                    el(
                        'div',
                        { class: 'small-actions' },
                        el('button', { class: 'btn btn-ghost', onclick: () => abrirModalProducto(p) }, '✏️'),
                        state.user.rol === 'admin' &&
                            el('button', { class: 'btn btn-danger', onclick: () => eliminarProducto(p.id) }, '🗑')
                    )
                )
            );
            if (disp <= p.stock_minimo) fila.style.background = 'rgba(217,119,6,.08)';
            tbody.append(fila);
        });
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function abrirModalProducto(p) {
    const editar = !!p?.id;
    $('#modal-titulo').textContent = editar ? `Editar · ${p.sku}` : 'Nuevo producto';

    if (!cargarCategorias._cache) await cargarCategorias();
    const cats = (cargarCategorias._cache || [])
        .map(c => `<option value="${c.id}" ${p?.categoria_id === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`)
        .join('');

    let skuSugerido = '';
    if (!editar) {
        try {
            skuSugerido = (await api('/productos/sku-sugerido')).sku;
        } catch {}
    }

    $('#modal-body').innerHTML = `
        <label class="row-2">
            <span>SKU *<input id="p-sku" value="${esc(p?.sku || skuSugerido)}" placeholder="SKU-00001" required maxlength="20" autocomplete="off"></span>
            <span>Ubicación *<input id="p-ubic" value="${esc(p?.ubicacion || '')}" placeholder="A-12-3" required maxlength="20" autocomplete="off"></span>
        </label>
        <label>Nombre *<input id="p-nombre" value="${esc(p?.nombre || '')}" placeholder="Ej: Taladro percutor 750W" required minlength="3" maxlength="150"></label>
        <label>Descripción<textarea id="p-desc" rows="2" placeholder="Detalles, modelo, características...">${esc(p?.descripcion || '')}</textarea></label>
        <label>Categoría<select id="p-cat"><option value="">— Sin categoría —</option>${cats}</select></label>
        <label class="row-2">
            <span>Stock inicial<input id="p-stock" type="number" min="0" step="1" value="${p?.stock ?? 0}"></span>
            <span>Stock mínimo<input id="p-min" type="number" min="0" step="1" value="${p?.stock_minimo ?? 5}"></span>
        </label>
        <label>Precio (€)<input id="p-precio" type="number" step="0.01" min="0" value="${p?.precio ?? 0}"></label>
    `;
    $('#modal-foot').innerHTML = `
        <button class="btn btn-ghost" id="p-cancel">Cancelar</button>
        <button class="btn btn-primary" id="p-ok">${editar ? 'Guardar cambios' : 'Crear producto'}</button>
    `;
    $('#p-cancel').onclick = cerrarModal;
    $('#p-ok').onclick = async () => {
        const body = {
            sku: $('#p-sku').value.trim().toUpperCase(),
            nombre: $('#p-nombre').value.trim(),
            descripcion: $('#p-desc').value.trim() || null,
            categoria_id: $('#p-cat').value ? +$('#p-cat').value : null,
            ubicacion: $('#p-ubic').value.trim().toUpperCase(),
            stock: +$('#p-stock').value || 0,
            stock_minimo: +$('#p-min').value || 0,
            precio: +$('#p-precio').value || 0,
        };
        const okBtn = $('#p-ok');
        okBtn.disabled = true;
        try {
            if (editar) await api('/productos/' + p.id, { method: 'PUT', body: JSON.stringify(body) });
            else await api('/productos', { method: 'POST', body: JSON.stringify(body) });
            toast(editar ? 'Producto actualizado' : `Producto creado · ${body.sku}`, 'ok');
            cerrarModal();
            if (state.view === 'inventario') cargarInventario();
            if (state.view === 'productos') cargarProductos();
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            okBtn.disabled = false;
        }
    };
    abrirModal();
    setTimeout(() => $('#p-nombre')?.focus(), 50);
}

async function eliminarProducto(id) {
    const ok = await confirmar({
        titulo: 'Dar de baja producto',
        mensaje:
            'El producto dejará de aparecer en el catálogo y no podrá reservarse. Los movimientos históricos se conservan.',
        ok: 'Dar de baja',
        cancel: 'Cancelar',
        peligroso: true,
        icono: '🗑',
    });
    if (!ok) return;
    try {
        await api('/productos/' + id, { method: 'DELETE' });
        toast('Producto dado de baja', 'ok');
        cargarInventario();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// =============================================================
// Usuarios (admin)
// =============================================================
async function cargarUsuarios() {
    if (state.user.rol !== 'admin') return;
    skeletonTabla('#usr-body', 6);
    try {
        const data = await api('/admin/usuarios');
        const tbody = $('#usr-body');
        tbody.innerHTML = '';
        data.forEach(u =>
            tbody.append(
                el(
                    'tr',
                    {},
                    el('td', {}, u.nombre),
                    el('td', {}, u.email),
                    el('td', {}, el('span', { class: 'role-badge' }, u.rol)),
                    el('td', {}, u.activo ? 'Activo' : 'Inactivo'),
                    el('td', {}, fmtDate(u.creado_en)),
                    el(
                        'td',
                        {},
                        el(
                            'div',
                            { class: 'small-actions' },
                            el('button', { class: 'btn btn-ghost', onclick: () => abrirModalUsuario(u) }, '✏️')
                        )
                    )
                )
            )
        );
    } catch (e) {
        toast(e.message, 'error');
    }
}

function abrirModalUsuario(u) {
    const editar = !!u?.id;
    $('#modal-titulo').textContent = editar ? `Editar · ${esc(u.nombre)}` : 'Nuevo usuario';
    $('#modal-body').innerHTML = `
        <label>Nombre<input id="u-nombre" value="${esc(u?.nombre || '')}" required></label>
        <label>Email<input id="u-email" type="email" value="${esc(u?.email || '')}" required></label>
        <label class="row-2">
            <span>Rol<select id="u-rol">
                <option value="cliente" ${u?.rol === 'cliente' ? 'selected' : ''}>Cliente</option>
                <option value="operario" ${u?.rol === 'operario' ? 'selected' : ''}>Operario</option>
                <option value="admin" ${u?.rol === 'admin' ? 'selected' : ''}>Admin</option>
            </select></span>
            <span>Activo<select id="u-activo">
                <option value="1" ${u?.activo !== 0 ? 'selected' : ''}>Sí</option>
                <option value="0" ${u?.activo === 0 ? 'selected' : ''}>No</option>
            </select></span>
        </label>
        <label>Contraseña ${editar ? '(dejar en blanco para mantener)' : ''}
            <input id="u-pass" type="password" minlength="6">
        </label>
    `;
    $('#modal-foot').innerHTML = `
        <button class="btn btn-ghost" id="u-cancel">Cancelar</button>
        <button class="btn btn-primary" id="u-ok">${editar ? 'Guardar' : 'Crear'}</button>
    `;
    $('#u-cancel').onclick = cerrarModal;
    $('#u-ok').onclick = async () => {
        try {
            const body = {
                nombre: $('#u-nombre').value.trim(),
                email: $('#u-email').value.trim(),
                rol: $('#u-rol').value,
                activo: +$('#u-activo').value,
            };
            const pass = $('#u-pass').value;
            if (pass) body.password = pass;
            if (editar) await api('/admin/usuarios/' + u.id, { method: 'PUT', body: JSON.stringify(body) });
            else {
                if (!pass) return toast('La contraseña es obligatoria', 'error');
                await api('/admin/usuarios', { method: 'POST', body: JSON.stringify(body) });
            }
            toast(editar ? 'Usuario actualizado' : 'Usuario creado', 'ok');
            cerrarModal();
            cargarUsuarios();
        } catch (e) {
            toast(e.message, 'error');
        }
    };
    abrirModal();
}

// =============================================================
// Descargas autenticadas (CSV exports)
// =============================================================
async function descargarBlob(path, filenameDefault) {
    try {
        const headers = {};
        if (state.token) headers.Authorization = `Bearer ${state.token}`;
        const r = await fetch(`${API}${path}`, { headers });
        if (!r.ok) {
            const txt = await r.text().catch(() => '');
            throw new Error(txt || `HTTP ${r.status}`);
        }
        const blob = await r.blob();
        // Si el servidor mandó Content-Disposition con filename, lo respetamos
        const cd = r.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename="?([^";]+)"?/i);
        const filename = m ? m[1] : filenameDefault;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        toast('No se pudo descargar: ' + e.message, 'error');
    }
}

function exportarInventarioCSV() {
    const f = state.invFiltro || {};
    const params = new URLSearchParams();
    if (f.search) params.set('search', f.search);
    if (f.categoria) params.set('categoria', f.categoria);
    if (f.stockBajo) params.set('stock_bajo', '1');
    const q = params.toString();
    descargarBlob(
        '/admin/export/inventario.csv' + (q ? '?' + q : ''),
        'inventario-' + new Date().toISOString().slice(0, 10) + '.csv'
    );
}

/**
 * Parser CSV mínimo pero robusto:
 *  - Soporta comillas dobles para escapar comas y saltos de línea
 *  - "" dentro de comillas escapa una comilla
 *  - Acepta separador coma o punto y coma (auto-detección por la cabecera)
 *  - Ignora líneas totalmente vacías
 * Devuelve un array de arrays de strings.
 */
function parseCSV(texto) {
    if (!texto) return [];
    // BOM UTF-8
    if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);

    // Auto-detección de separador (cabecera): cuenta ; vs , en la primera línea
    const firstLineEnd = texto.indexOf('\n');
    const headerLine = firstLineEnd === -1 ? texto : texto.slice(0, firstLineEnd);
    const sep = headerLine.split(';').length > headerLine.split(',').length ? ';' : ',';

    const filas = [];
    let actual = [];
    let campo = '';
    let dentroComillas = false;

    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (dentroComillas) {
            if (c === '"') {
                if (texto[i + 1] === '"') {
                    campo += '"';
                    i++;
                } else dentroComillas = false;
            } else campo += c;
        } else {
            if (c === '"') dentroComillas = true;
            else if (c === sep) {
                actual.push(campo);
                campo = '';
            } else if (c === '\n' || c === '\r') {
                if (c === '\r' && texto[i + 1] === '\n') i++;
                actual.push(campo);
                campo = '';
                if (actual.some(s => s !== '')) filas.push(actual);
                actual = [];
            } else campo += c;
        }
    }
    if (campo !== '' || actual.length) {
        actual.push(campo);
        if (actual.some(s => s !== '')) filas.push(actual);
    }
    return filas;
}

const _importState = {
    filas: [], // [{ linea, raw, errores, body }]
    importando: false,
};

async function abrirImportCSV() {
    if (!esStaff()) return;
    _importState.filas = [];
    _importState.importando = false;

    // Aseguramos cache de categorías
    if (!cargarCategorias._cache) {
        try {
            cargarCategorias._cache = await api('/categorias');
        } catch {}
    }

    $('#modal-titulo').textContent = 'Importar productos desde CSV';
    pintarImportPaso1();
    $('#modal-foot').innerHTML = `<button class="btn btn-ghost" id="imp-cerrar">Cerrar</button>`;
    $('#imp-cerrar').onclick = cerrarModal;
    abrirModal();
}

function pintarImportPaso1() {
    $('#modal-body').innerHTML = `
        <div class="imp-help">
            <p>Sube un archivo <code>.csv</code> con cabecera. Las columnas reconocidas son:</p>
            <code class="imp-cabecera-ejemplo">sku,nombre,descripcion,categoria,ubicacion,stock,stock_minimo,precio</code>
            <ul class="imp-notas muted">
                <li>El <strong>nombre</strong> y la <strong>ubicación</strong> son obligatorios. Si dejas el SKU vacío se autogenera.</li>
                <li><strong>categoria</strong> es el nombre exacto (se resuelve al ID). Si no existe, esa fila se marca como error.</li>
                <li>Numéricos vacíos → 0 (precio/stock) o 5 (stock_mínimo).</li>
                <li>Separador detectado automáticamente: coma o punto y coma.</li>
            </ul>
            <div class="imp-actions">
                <label class="btn btn-primary imp-file-btn">
                    📁 Seleccionar archivo CSV
                    <input id="imp-file" type="file" accept=".csv,text/csv" hidden>
                </label>
                <a class="btn btn-ghost" id="imp-plantilla" href="#">⬇ Descargar plantilla</a>
            </div>
        </div>
    `;
    $('#imp-file').onchange = onFicheroSeleccionado;
    $('#imp-plantilla').onclick = e => {
        e.preventDefault();
        descargarPlantillaCSV();
    };
}

function descargarPlantillaCSV() {
    const csv =
        'sku,nombre,descripcion,categoria,ubicacion,stock,stock_minimo,precio\n' +
        ',Taladro percutor 750W,Profesional con maletín,Herramientas eléctricas,A-12-3,15,5,89.90\n' +
        ',Caja de tornillos M6 x 200ud,Acero inoxidable,Tornillería,B-04-1,40,10,12.50\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-productos.csv';
    a.click();
    URL.revokeObjectURL(url);
}

async function onFicheroSeleccionado(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        toast('Archivo demasiado grande (>5 MB)', 'error');
        return;
    }

    const texto = await file.text();
    const filas = parseCSV(texto);
    if (filas.length < 2) {
        toast('El CSV no tiene datos', 'error');
        return;
    }

    const cabecera = filas[0].map(s => s.trim().toLowerCase());
    if (!cabecera.includes('nombre') || !cabecera.includes('ubicacion')) {
        toast('La cabecera debe incluir al menos "nombre" y "ubicacion"', 'error');
        return;
    }

    _importState.filas = filas.slice(1).map((raw, i) => parsearFila(raw, cabecera, i + 2));
    pintarImportPaso2(file.name);
}

function parsearFila(raw, cabecera, lineNumber) {
    const col = nombre => {
        const i = cabecera.indexOf(nombre);
        return i >= 0 ? String(raw[i] ?? '').trim() : '';
    };
    const errores = [];

    const sku = col('sku'); // opcional
    const nombre = col('nombre');
    const ubicacion = col('ubicacion');
    if (!nombre) errores.push("'nombre' vacío");
    if (!ubicacion) errores.push("'ubicacion' vacía");

    let categoria_id = null;
    const nombreCat = col('categoria');
    if (nombreCat) {
        const cats = cargarCategorias._cache || [];
        const match = cats.find(c => c.nombre.toLowerCase() === nombreCat.toLowerCase());
        if (!match) errores.push(`Categoría desconocida: "${nombreCat}"`);
        else categoria_id = match.id;
    }

    const toInt = (s, def) => {
        const n = parseInt(s, 10);
        return isNaN(n) ? def : n;
    };
    const toFloat = (s, def) => {
        const n = parseFloat(String(s).replace(',', '.'));
        return isNaN(n) ? def : n;
    };

    const body = {
        __linea: lineNumber,
        sku: sku ? sku.toUpperCase() : '',
        nombre: nombre,
        descripcion: col('descripcion') || null,
        categoria_id,
        ubicacion: ubicacion.toUpperCase(),
        stock: toInt(col('stock'), 0),
        stock_minimo: toInt(col('stock_minimo'), 5),
        precio: toFloat(col('precio'), 0),
    };

    return { linea: lineNumber, raw, body, errores };
}

function pintarImportPaso2(filename) {
    const filas = _importState.filas;
    const validas = filas.filter(f => !f.errores.length);
    const invalidas = filas.length - validas.length;

    const filasPreview = filas
        .slice(0, 50)
        .map(
            f => `
        <tr class="${f.errores.length ? 'imp-fila-error' : 'imp-fila-ok'}" title="${esc(f.errores.join('; '))}">
            <td>${f.linea}</td>
            <td>${f.errores.length ? '<span class="imp-badge bad">✗</span>' : '<span class="imp-badge ok">✓</span>'}</td>
            <td><code>${esc(f.body.sku || '(auto)')}</code></td>
            <td>${esc(f.body.nombre || '—')}</td>
            <td>${esc(f.body.ubicacion || '—')}</td>
            <td>${esc(String(f.body.stock))}</td>
            <td>${esc(fmtMoney(f.body.precio))}</td>
            <td class="imp-error-msg">${esc(f.errores.join('; '))}</td>
        </tr>`
        )
        .join('');

    $('#modal-body').innerHTML = `
        <div class="imp-resumen">
            <div><strong>${esc(filename)}</strong> · ${filas.length} fila(s) leídas</div>
            <div class="imp-counts">
                <span class="imp-badge ok">${validas.length} válidas</span>
                <span class="imp-badge ${invalidas ? 'bad' : 'muted'}">${invalidas} con error</span>
            </div>
        </div>
        <div class="imp-tabla-wrap">
            <table class="table imp-tabla">
                <thead><tr>
                    <th>Línea</th><th></th><th>SKU</th><th>Nombre</th><th>Ubic.</th><th>Stock</th><th>Precio</th><th>Errores</th>
                </tr></thead>
                <tbody>${filasPreview}</tbody>
            </table>
            ${filas.length > 50 ? `<p class="muted imp-mas">...y ${filas.length - 50} fila(s) más (no mostradas en preview)</p>` : ''}
        </div>
    `;
    $('#modal-foot').innerHTML = `
        <button class="btn btn-ghost" id="imp-volver">← Cambiar archivo</button>
        <button class="btn btn-primary" id="imp-aplicar" ${validas.length ? '' : 'disabled'}>
            ⤴ Importar ${validas.length} fila(s)
        </button>
    `;
    $('#imp-volver').onclick = () => pintarImportPaso1();
    $('#imp-aplicar').onclick = aplicarImport;
}

async function aplicarImport() {
    if (_importState.importando) return;
    _importState.importando = true;
    const validas = _importState.filas.filter(f => !f.errores.length);
    if (!validas.length) return;

    $('#imp-aplicar').disabled = true;
    $('#imp-aplicar').textContent = 'Importando…';

    try {
        const r = await api('/productos/import', {
            method: 'POST',
            body: JSON.stringify({ productos: validas.map(f => f.body) }),
        });
        pintarImportResultado(r);
    } catch (e) {
        toast(e.message, 'error');
        $('#imp-aplicar').disabled = false;
        $('#imp-aplicar').textContent = `⤴ Importar ${validas.length} fila(s)`;
    } finally {
        _importState.importando = false;
    }
}

function pintarImportResultado(r) {
    const fallidos = r.resultados.filter(x => !x.ok);
    $('#modal-body').innerHTML = `
        <div class="imp-resultado">
            <div class="confirm-icon ${r.fallidos > 0 ? 'danger' : ''}">${r.fallidos > 0 ? '⚠' : '✓'}</div>
            <h3 class="imp-result-titulo">${r.creados} producto(s) creado(s) · ${r.fallidos} con error</h3>
            ${
                fallidos.length
                    ? `
                <div class="imp-tabla-wrap" style="max-height:260px">
                    <table class="table imp-tabla">
                        <thead><tr><th>Línea</th><th>Error</th></tr></thead>
                        <tbody>
                            ${fallidos.map(f => `<tr><td>${f.linea}</td><td>${esc(f.error)}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>`
                    : '<p class="muted">Sin errores. Inventario actualizado.</p>'
            }
        </div>
    `;
    $('#modal-foot').innerHTML = `<button class="btn btn-primary" id="imp-ok">Cerrar</button>`;
    $('#imp-ok').onclick = () => {
        cerrarModal();
        if (state.view === 'inventario') cargarInventario();
        if (state.view === 'productos') cargarProductos();
    };
    toast(`Import: ${r.creados} ok · ${r.fallidos} error`, r.fallidos === 0 ? 'ok' : r.creados > 0 ? 'info' : 'error');
}

// =============================================================
// Editor de categorías (admin)
// =============================================================
const _catState = { editandoId: null, fusionandoId: null, borrandoId: null };

async function abrirEditorCategorias() {
    if (state.user?.rol !== 'admin') return;
    _catState.editandoId = _catState.fusionandoId = _catState.borrandoId = null;
    $('#modal-titulo').textContent = 'Gestión de categorías';
    $('#modal-foot').innerHTML = `<button class="btn btn-primary" id="cat-cerrar">Cerrar</button>`;
    $('#cat-cerrar').onclick = () => {
        cerrarModal();
        cargarCategorias();
        if (state.view === 'inventario') cargarInventario();
    };
    abrirModal();
    await pintarCategorias();
}

async function pintarCategorias() {
    $('#modal-body').innerHTML = `<div class="skeleton sk-block" style="height:300px"></div>`;
    try {
        const cats = await api('/categorias');
        cargarCategorias._cache = cats;
        renderCategorias(cats);
    } catch (e) {
        $('#modal-body').innerHTML = `<p class="muted">Error: ${esc(e.message)}</p>`;
    }
}

function renderCategorias(cats) {
    const filas = cats.map(c => renderCatFila(c, cats)).join('');
    $('#modal-body').innerHTML = `
        <div class="cat-nuevo">
            <h4 class="cat-mini-titulo">Nueva categoría</h4>
            <div class="cat-form">
                <input id="cat-new-icono" type="text" placeholder="🏷" maxlength="4" style="width:64px">
                <input id="cat-new-nombre" type="text" placeholder="Nombre de la categoría" maxlength="80" required>
                <input id="cat-new-color" type="color" value="#8a4d0a" style="width:48px">
                <button class="btn btn-primary" id="cat-new-ok">+ Crear</button>
            </div>
        </div>
        <h4 class="cat-mini-titulo">Categorías existentes (${cats.length})</h4>
        <div class="cat-lista">${filas || '<p class="muted">Sin categorías.</p>'}</div>
    `;

    $('#cat-new-ok').onclick = crearCategoria;
    $('#cat-new-nombre').onkeydown = e => {
        if (e.key === 'Enter') crearCategoria();
    };

    cats.forEach(c => bindFilaCategoria(c, cats));
}

function renderCatFila(c, cats) {
    const editando = _catState.editandoId === c.id;
    const fusionando = _catState.fusionandoId === c.id;
    const borrando = _catState.borrandoId === c.id;

    if (editando) {
        return `
            <div class="cat-fila editando" data-id="${c.id}">
                <input class="cat-icono" id="cat-${c.id}-icono" type="text" maxlength="4" value="${esc(c.icono || '')}" placeholder="🏷">
                <input class="cat-nombre" id="cat-${c.id}-nombre" type="text" value="${esc(c.nombre)}" maxlength="80" required>
                <input class="cat-color" id="cat-${c.id}-color" type="color" value="${esc(c.color || '#8a4d0a')}">
                <button class="btn btn-primary btn-mini" data-act="save" data-id="${c.id}">Guardar</button>
                <button class="btn btn-ghost btn-mini" data-act="cancel" data-id="${c.id}">Cancelar</button>
            </div>`;
    }

    if (fusionando) {
        const opts = cats
            .filter(x => x.id !== c.id)
            .map(x => `<option value="${x.id}">${esc(x.icono || '')} ${esc(x.nombre)} (${x.productos})</option>`)
            .join('');
        return `
            <div class="cat-fila fusionando" data-id="${c.id}">
                <span class="cat-icono-display">${esc(c.icono || '🏷')}</span>
                <span class="cat-nombre-display">${esc(c.nombre)} · ${c.productos} prod.</span>
                <span class="muted">→</span>
                <select class="cat-merge-dest" id="cat-${c.id}-dest">${opts || '<option disabled>No hay otras categorías</option>'}</select>
                <button class="btn btn-primary btn-mini" data-act="merge-ok" data-id="${c.id}" ${!opts ? 'disabled' : ''}>Fusionar</button>
                <button class="btn btn-ghost btn-mini" data-act="cancel" data-id="${c.id}">Cancelar</button>
            </div>`;
    }

    if (borrando) {
        const advertencia =
            c.productos > 0
                ? `${c.productos} producto(s) quedarán sin categoría.`
                : 'Esta categoría no tiene productos.';
        return `
            <div class="cat-fila borrando" data-id="${c.id}">
                <span class="cat-icono-display">${esc(c.icono || '🏷')}</span>
                <span class="cat-nombre-display">${esc(c.nombre)}</span>
                <span class="muted cat-warn">⚠ ${esc(advertencia)}</span>
                <button class="btn btn-danger btn-mini" data-act="del-ok" data-id="${c.id}">Borrar</button>
                <button class="btn btn-ghost btn-mini" data-act="cancel" data-id="${c.id}">Cancelar</button>
            </div>`;
    }

    const color = c.color || '#8a4d0a';
    return `
        <div class="cat-fila" data-id="${c.id}">
            <span class="cat-icono-display" style="background:${esc(color)}33;color:${esc(color)}">${esc(c.icono || '🏷')}</span>
            <span class="cat-nombre-display">${esc(c.nombre)}</span>
            <span class="muted cat-count">${c.productos} prod.</span>
            <div class="cat-acciones">
                <button class="btn btn-ghost btn-mini" data-act="edit"   data-id="${c.id}" title="Renombrar">✏</button>
                <button class="btn btn-ghost btn-mini" data-act="merge"  data-id="${c.id}" title="Fusionar con otra">↔</button>
                <button class="btn btn-ghost btn-mini" data-act="del"    data-id="${c.id}" title="Borrar">🗑</button>
            </div>
        </div>`;
}

function bindFilaCategoria(c) {
    document.querySelectorAll(`.cat-fila[data-id="${c.id}"] [data-act]`).forEach(b => {
        b.onclick = () => accionCategoria(b.dataset.act, c);
    });
    if (_catState.editandoId === c.id) {
        const inp = $(`#cat-${c.id}-nombre`);
        if (inp) {
            inp.focus();
            inp.select();
        }
    }
}

async function crearCategoria() {
    const nombre = $('#cat-new-nombre').value.trim();
    if (!nombre) return toast('Nombre obligatorio', 'error');
    const icono = $('#cat-new-icono').value.trim();
    const color = $('#cat-new-color').value;
    try {
        await api('/categorias', { method: 'POST', body: JSON.stringify({ nombre, icono, color }) });
        toast(`Categoría "${nombre}" creada`, 'ok');
        await pintarCategorias();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function accionCategoria(act, c) {
    const cats = cargarCategorias._cache || [];

    if (act === 'cancel') {
        _catState.editandoId = _catState.fusionandoId = _catState.borrandoId = null;
        renderCategorias(cats);
        return;
    }

    if (act === 'edit') {
        _catState.editandoId = c.id;
        _catState.fusionandoId = _catState.borrandoId = null;
        renderCategorias(cats);
        return;
    }

    if (act === 'save') {
        const nombre = $(`#cat-${c.id}-nombre`).value.trim();
        const icono = $(`#cat-${c.id}-icono`).value.trim();
        const color = $(`#cat-${c.id}-color`).value;
        if (!nombre) return toast('Nombre no puede estar vacío', 'error');
        try {
            await api(`/categorias/${c.id}`, { method: 'PATCH', body: JSON.stringify({ nombre, icono, color }) });
            _catState.editandoId = null;
            toast('Categoría actualizada', 'ok');
            await pintarCategorias();
        } catch (e) {
            toast(e.message, 'error');
        }
        return;
    }

    if (act === 'merge') {
        _catState.fusionandoId = c.id;
        _catState.editandoId = _catState.borrandoId = null;
        renderCategorias(cats);
        return;
    }

    if (act === 'merge-ok') {
        const destino_id = +$(`#cat-${c.id}-dest`).value;
        if (!destino_id) return;
        try {
            const r = await api(`/categorias/${c.id}/merge`, { method: 'POST', body: JSON.stringify({ destino_id }) });
            toast(`Fusionada · ${r.productos_movidos} producto(s) movido(s)`, 'ok');
            _catState.fusionandoId = null;
            await pintarCategorias();
        } catch (e) {
            toast(e.message, 'error');
        }
        return;
    }

    if (act === 'del') {
        _catState.borrandoId = c.id;
        _catState.editandoId = _catState.fusionandoId = null;
        renderCategorias(cats);
        return;
    }

    if (act === 'del-ok') {
        try {
            const r = await api(`/categorias/${c.id}?force=true`, { method: 'DELETE' });
            toast(
                r.productos_desasignados > 0
                    ? `Borrada · ${r.productos_desasignados} producto(s) quedaron sin categoría`
                    : 'Categoría borrada',
                'ok'
            );
            _catState.borrandoId = null;
            await pintarCategorias();
        } catch (e) {
            toast(e.message, 'error');
        }
        return;
    }
}

// =============================================================
// Histórico de movimientos por producto
// =============================================================
function esStaff() {
    return state.user && (state.user.rol === 'admin' || state.user.rol === 'operario');
}

/**
 * Devuelve un DOM Node con el SKU. Si el usuario es staff, lo hace clicable
 * y abre el histórico del producto al pulsarlo.
 */
function skuLink(producto, claseExtra = 'sku') {
    if (esStaff() && producto?.id) {
        return el(
            'button',
            {
                class: claseExtra + ' sku-link',
                title: 'Ver histórico de movimientos',
                onclick: e => {
                    e.stopPropagation();
                    abrirHistorial(producto.id);
                },
            },
            producto.sku
        );
    }
    return el('span', { class: claseExtra }, producto.sku);
}

async function abrirHistorial(productoId) {
    $('#modal-titulo').textContent = 'Histórico de movimientos';
    $('#modal-body').innerHTML = `
        <div class="hist-cabecera skeleton-card">
            <span class="skeleton sk-line long"></span>
            <span class="skeleton sk-line medium"></span>
        </div>
        <div class="movimientos hist-lista">
            ${Array.from({ length: 8 })
                .map(
                    () => `
                <div class="mov-row skeleton-card">
                    <span class="skeleton sk-line short"></span>
                    <span class="skeleton sk-line long"></span>
                    <span class="skeleton sk-line short"></span>
                    <span class="skeleton sk-line short"></span>
                </div>`
                )
                .join('')}
        </div>
    `;
    $('#modal-foot').innerHTML = `<button class="btn btn-primary" id="hist-cerrar">Cerrar</button>`;
    $('#hist-cerrar').onclick = cerrarModal;
    abrirModal();

    try {
        const r = await api(`/productos/${productoId}/movimientos?limit=200`);
        renderHistorial(r);
    } catch (e) {
        $('#modal-body').innerHTML = `<p class="muted">No se pudo cargar el histórico: ${esc(e.message)}</p>`;
    }
}

function renderHistorial({ producto, movimientos, totales }) {
    const disp = producto.stock - producto.stock_reservado;
    const stockClase = disp <= 0 ? 'bad' : disp <= producto.stock_minimo ? 'warn' : '';

    const chip = (label, value, extra = '') =>
        value ? `<span class="hist-totals-chip ${extra}">${esc(label)}: <strong>${value}</strong></span>` : '';

    const cabecera = `
        <div class="hist-cabecera">
            <div>
                <code class="sku">${esc(producto.sku)}</code>
                <strong class="hist-nombre">${esc(producto.nombre)}</strong>
                <div class="muted">📍 ${esc(producto.ubicacion)}</div>
            </div>
            <div class="hist-stock">
                <span class="stock-chip ${stockClase}">Disponible: ${disp}</span>
                <span class="muted">Stock total: ${producto.stock} · Reservado: ${producto.stock_reservado}</span>
            </div>
        </div>
        <div class="hist-totals">
            ${chip('Movimientos', totales._total)}
            ${chip('Entradas', totales.entrada, 'ok')}
            ${chip('Salidas', totales.salida, 'bad')}
            ${chip('Ajustes', totales.ajuste)}
            ${chip('Reservas', totales.reserva, 'warn')}
            ${chip('Liberadas', totales.liberacion)}
        </div>
    `;

    if (!movimientos.length) {
        $('#modal-body').innerHTML = cabecera + '<p class="muted hist-empty">Sin movimientos registrados todavía.</p>';
        return;
    }

    const lista = movimientos
        .map(m => {
            const signo = m.cantidad > 0 ? `+${m.cantidad}` : String(m.cantidad);
            return `
            <div class="mov-row">
                <span class="mov-tipo ${m.tipo}">${m.tipo}</span>
                <span>
                    <strong class="mov-cantidad">${signo}</strong>
                    <span class="muted"> · ${m.stock_anterior} → ${m.stock_posterior}</span>
                    ${m.motivo ? ` · <span class="muted">${esc(m.motivo)}</span>` : ''}
                </span>
                <span class="muted">${esc(m.usuario || '—')}</span>
                <span class="muted">${esc(fmtDate(m.fecha))}</span>
            </div>`;
        })
        .join('');

    $('#modal-body').innerHTML = cabecera + `<div class="movimientos hist-lista">${lista}</div>`;
}

// =============================================================
// Perfil
// =============================================================
function abrirModalPerfil() {
    const u = state.user;
    if (!u) return;

    $('#modal-titulo').textContent = 'Mi perfil';
    $('#modal-body').innerHTML = `
        <div class="perfil-cabecera">
            <span class="avatar perfil-avatar">${esc(iniciales(u.nombre))}</span>
            <div>
                <strong class="perfil-nombre">${esc(u.nombre)}</strong>
                <span class="role-badge">${esc(u.rol)}</span>
            </div>
        </div>

        <fieldset class="perfil-grupo">
            <legend>Datos personales</legend>
            <label>Nombre completo
                <input id="perfil-nombre" type="text" value="${esc(u.nombre)}" required maxlength="120" autocomplete="name">
            </label>
            <label>Email
                <input id="perfil-email" type="email" value="${esc(u.email)}" required autocomplete="email">
            </label>
        </fieldset>

        <fieldset class="perfil-grupo">
            <legend>Cambiar contraseña <small class="muted">(opcional)</small></legend>
            <label>Contraseña actual
                <input id="perfil-pass-actual" type="password" autocomplete="current-password" placeholder="Sólo si vas a cambiarla">
            </label>
            <label class="row-2">
                <span>Nueva contraseña<input id="perfil-pass-nueva" type="password" minlength="6" autocomplete="new-password" placeholder="Mín. 6 caracteres"></span>
                <span>Confirmar<input id="perfil-pass-conf" type="password" minlength="6" autocomplete="new-password"></span>
            </label>
        </fieldset>
    `;
    $('#modal-foot').innerHTML = `
        <button class="btn btn-ghost" id="perfil-cancel">Cancelar</button>
        <button class="btn btn-primary" id="perfil-ok">Guardar cambios</button>
    `;
    $('#perfil-cancel').onclick = cerrarModal;
    $('#perfil-ok').onclick = guardarPerfil;
    abrirModal();
    setTimeout(() => $('#perfil-nombre')?.focus(), 60);
}

async function guardarPerfil() {
    const u = state.user;
    const nombreNuevo = $('#perfil-nombre').value.trim();
    const emailNuevo = $('#perfil-email').value.trim().toLowerCase();
    const passActual = $('#perfil-pass-actual').value;
    const passNueva = $('#perfil-pass-nueva').value;
    const passConf = $('#perfil-pass-conf').value;

    if (!nombreNuevo) return toast('El nombre no puede estar vacío', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNuevo)) return toast('Email no válido', 'error');

    const body = {};
    if (nombreNuevo !== u.nombre) body.nombre = nombreNuevo;
    if (emailNuevo !== u.email.toLowerCase()) body.email = emailNuevo;

    if (passNueva || passConf || passActual) {
        if (!passActual) return toast('Indica tu contraseña actual', 'error');
        if (passNueva.length < 6) return toast('La nueva contraseña debe tener al menos 6 caracteres', 'error');
        if (passNueva !== passConf) return toast('Las contraseñas no coinciden', 'error');
        body.password_actual = passActual;
        body.password_nuevo = passNueva;
    }

    if (Object.keys(body).length === 0) {
        toast('No hay cambios que guardar', 'info');
        cerrarModal();
        return;
    }

    const btn = $('#perfil-ok');
    btn.disabled = true;
    try {
        const r = await api('/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
        state.token = r.token;
        state.user = r.user;
        localStorage.setItem('token', r.token);
        localStorage.setItem('user', JSON.stringify(r.user));
        pintarUsuario();
        cerrarModal();
        toast('Perfil actualizado', 'ok');
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// =============================================================
// Modal helpers
// =============================================================
function abrirModal() {
    $('#modal').classList.remove('hidden');
}
function cerrarModal() {
    $('#modal').classList.add('hidden');
}

/**
 * Modal de confirmación con look industrial. Devuelve Promise<boolean>.
 * @param {object} opts
 * @param {string} opts.titulo
 * @param {string} opts.mensaje  — texto plano, se escapa al renderizar
 * @param {string} [opts.ok='Confirmar']
 * @param {string} [opts.cancel='Cancelar']
 * @param {boolean} [opts.peligroso=false] — si true, el botón principal es btn-danger
 * @param {string} [opts.icono='⚠']
 */
function confirmar(opts) {
    return new Promise(resolve => {
        const {
            titulo = 'Confirmar',
            mensaje = '',
            ok = 'Confirmar',
            cancel = 'Cancelar',
            peligroso = false,
            icono = '⚠',
        } = opts || {};

        // Guarda handlers globales del modal para restaurarlos al cerrar
        const prevCloseHandler = $('#modal-cerrar').onclick;
        const prevModalHandler = $('#modal').onclick;

        $('#modal-titulo').textContent = titulo;
        $('#modal-body').innerHTML = `
            <div class="confirm-body">
                <div class="confirm-icon ${peligroso ? 'danger' : ''}">${esc(icono)}</div>
                <p class="confirm-msg">${esc(mensaje)}</p>
            </div>
        `;
        $('#modal-foot').innerHTML = `
            <button class="btn btn-ghost"   id="confirm-cancel">${esc(cancel)}</button>
            <button class="btn ${peligroso ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">${esc(ok)}</button>
        `;

        const onKey = e => {
            if (e.key === 'Escape') cerrar(false);
        };

        const cerrar = valor => {
            document.removeEventListener('keydown', onKey);
            $('#modal-cerrar').onclick = prevCloseHandler;
            $('#modal').onclick = prevModalHandler;
            cerrarModal();
            // Permite que la animación de cierre acabe antes de resolver
            setTimeout(() => resolve(valor), 50);
        };

        $('#confirm-ok').onclick = () => cerrar(true);
        $('#confirm-cancel').onclick = () => cerrar(false);
        $('#modal-cerrar').onclick = () => cerrar(false);
        $('#modal').onclick = e => {
            if (e.target.id === 'modal') cerrar(false);
        };
        document.addEventListener('keydown', onKey);

        abrirModal();
        // Auto-foco en el botón principal para Enter directo
        setTimeout(() => $('#confirm-ok')?.focus(), 60);
    });
}

// =============================================================
// Tema
// =============================================================
function aplicarTema(t) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('theme', t);
    $('#btn-theme').textContent = t === 'dark' ? '☀️' : '🌙';
}

// =============================================================
// Atajos de teclado
// =============================================================
const VISTAS_ORDEN = ['productos', 'reservas', 'dashboard', 'inventario', 'usuarios'];
const VISTAS_STAFF = new Set(['dashboard', 'inventario']);
const VISTAS_ADMIN = new Set(['usuarios']);

function puedeVerVista(view) {
    if (!state.user) return false;
    const rol = state.user.rol;
    if (VISTAS_ADMIN.has(view)) return rol === 'admin';
    if (VISTAS_STAFF.has(view)) return rol === 'admin' || rol === 'operario';
    return true;
}

function focoEnBuscador() {
    const sel = state.view === 'inventario' ? '#inv-buscar' : state.view === 'productos' ? '#buscar' : null;
    if (sel) {
        const n = $(sel);
        if (n) {
            n.focus();
            n.select?.();
            return;
        }
    }
    cambiarVista('productos');
    setTimeout(() => {
        const b = $('#buscar');
        if (b) {
            b.focus();
            b.select?.();
        }
    }, 60);
}

function mostrarAtajos() {
    const esAdmin = state.user && (state.user.rol === 'admin' || state.user.rol === 'operario');
    const esAdminPuro = state.user && state.user.rol === 'admin';
    const rows = [
        ['Ctrl + K', 'Buscar (o tecla /)'],
        ['Esc', 'Cerrar modal / quitar foco'],
        ['1', 'Ir a Productos'],
        ['2', 'Ir a Reservas'],
        esAdmin ? ['3', 'Ir a Dashboard'] : null,
        esAdmin ? ['4', 'Ir a Inventario'] : null,
        esAdminPuro ? ['5', 'Ir a Usuarios'] : null,
        esAdmin ? ['Ctrl + N', 'Nuevo producto'] : null,
        ['?', 'Mostrar esta ayuda'],
    ].filter(Boolean);

    $('#modal-titulo').textContent = 'Atajos de teclado';
    $('#modal-body').innerHTML = `
        <div class="atajos-lista">
            ${rows
                .map(
                    ([k, d]) => `
                <div class="atajo-row">
                    <kbd class="kbd">${esc(k)}</kbd>
                    <span>${esc(d)}</span>
                </div>`
                )
                .join('')}
        </div>
    `;
    $('#modal-foot').innerHTML = `<button class="btn btn-primary" id="atajos-ok">Entendido</button>`;
    $('#atajos-ok').onclick = cerrarModal;
    abrirModal();
}

function bindAtajos() {
    const isTyping = el =>
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    const modalAbierto = () => !$('#modal').classList.contains('hidden');
    const dropdownAbierto = () => !$('#user-dropdown').classList.contains('hidden');
    const appActiva = () => !$('#app').classList.contains('hidden');

    document.addEventListener('keydown', e => {
        // Esc — universal
        if (e.key === 'Escape') {
            if (modalAbierto()) {
                cerrarModal();
                return;
            }
            if (dropdownAbierto()) {
                $('#user-dropdown').classList.add('hidden');
                return;
            }
            if (isTyping(document.activeElement)) document.activeElement.blur();
            return;
        }

        if (isTyping(e.target)) return; // escribiendo: no consumir teclas
        if (modalAbierto()) return; // modal abierto: solo Esc
        if (!appActiva()) return; // pantalla de login

        const k = e.key;
        const ctrl = e.ctrlKey || e.metaKey;

        // Ctrl+K o '/': foco en buscador
        if ((ctrl && (k === 'k' || k === 'K')) || k === '/') {
            e.preventDefault();
            focoEnBuscador();
            return;
        }

        // Ctrl+N: nuevo producto (admin/operario)
        if (ctrl && (k === 'n' || k === 'N')) {
            if (state.user && (state.user.rol === 'admin' || state.user.rol === 'operario')) {
                e.preventDefault();
                abrirModalProducto();
            }
            return;
        }

        // 1-5: cambiar vista
        if (!ctrl && !e.altKey && /^[1-5]$/.test(k)) {
            const target = VISTAS_ORDEN[parseInt(k, 10) - 1];
            if (puedeVerVista(target)) cambiarVista(target);
            return;
        }

        // ?: ayuda
        if (k === '?') {
            e.preventDefault();
            mostrarAtajos();
        }
    });
}

// =============================================================
// Eventos
// =============================================================
function bindEventos() {
    // Login / registro
    $$('.auth-tab').forEach(
        b =>
            (b.onclick = () => {
                $$('.auth-tab').forEach(x => x.classList.toggle('active', x === b));
                $$('.auth-form').forEach(f => f.classList.remove('active'));
                $('#form-' + b.dataset.auth).classList.add('active');
            })
    );
    $('#form-login').onsubmit = async e => {
        e.preventDefault();
        try {
            await login($('#login-email').value, $('#login-password').value);
        } catch (err) {
            toast(err.message, 'error');
        }
    };
    $('#form-register').onsubmit = async e => {
        e.preventDefault();
        try {
            await registro($('#reg-nombre').value, $('#reg-email').value, $('#reg-password').value);
        } catch (err) {
            toast(err.message, 'error');
        }
    };

    // Tabs
    $$('[data-view]').forEach(b => (b.onclick = () => cambiarVista(b.dataset.view)));

    // Buscar productos (debounce reutilizable)
    $('#buscar').oninput = debounce(e => {
        state.search = e.target.value;
        state.page = 1;
        cargarProductos();
    });
    $('#filtro-categoria').onchange = e => {
        state.categoria = e.target.value;
        state.page = 1;
        cargarProductos();
    };
    $('#orden').onchange = e => {
        const [s, d] = e.target.value.split('-');
        state.sort = s;
        state.dir = d;
        state.page = 1;
        cargarProductos();
    };
    $('#prev').onclick = () => {
        if (state.page > 1) {
            state.page--;
            cargarProductos();
        }
    };
    $('#next').onclick = () => {
        state.page++;
        cargarProductos();
    };

    // Reservas - filtros
    $$('.chip-filters .chip').forEach(
        c =>
            (c.onclick = () => {
                $$('.chip-filters .chip').forEach(x => x.classList.toggle('active', x === c));
                state.reservaFiltro = c.dataset.estado;
                cargarReservas();
            })
    );

    // Inventario
    $('#inv-buscar')?.addEventListener(
        'input',
        debounce(e => {
            state.invFiltro.search = e.target.value;
            cargarInventario();
        })
    );
    $('#inv-categoria')?.addEventListener('change', e => {
        state.invFiltro.categoria = e.target.value;
        cargarInventario();
    });
    $('#inv-stockbajo')?.addEventListener('change', e => {
        state.invFiltro.stockBajo = e.target.checked;
        cargarInventario();
    });
    $('#btn-nuevo-producto')?.addEventListener('click', () => abrirModalProducto());
    $('#btn-categorias')?.addEventListener('click', abrirEditorCategorias);
    $('#btn-import-csv')?.addEventListener('click', abrirImportCSV);
    $('#btn-export-csv')?.addEventListener('click', exportarInventarioCSV);
    $('#fab-nuevo')?.addEventListener('click', () => abrirModalProducto());

    // Usuarios
    $('#btn-nuevo-usuario')?.addEventListener('click', () => abrirModalUsuario());

    // Modal
    $('#modal-cerrar').onclick = cerrarModal;
    $('#modal').onclick = e => {
        if (e.target.id === 'modal') cerrarModal();
    };

    // User dropdown
    $('#btn-user').onclick = e => {
        e.stopPropagation();
        $('#user-dropdown').classList.toggle('hidden');
    };
    document.addEventListener('click', () => $('#user-dropdown').classList.add('hidden'));
    $('#btn-perfil').onclick = () => {
        $('#user-dropdown').classList.add('hidden');
        abrirModalPerfil();
    };
    $('#btn-logout').onclick = cerrarSesion;

    // Tema
    $('#btn-theme').onclick = () => aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

    // Atajos (botón ⌨ en topbar)
    $('#btn-atajos')?.addEventListener('click', mostrarAtajos);
}

// =============================================================
// Init
// =============================================================
(async () => {
    bindEventos();
    bindAtajos();
    aplicarTema(
        localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );

    if (state.token) {
        try {
            await api('/auth/me');
            entrarApp();
        } catch {
            cerrarSesion();
        }
    }

    // Kill switch: desregistra cualquier service worker antiguo y limpia caches.
    // El sw.js antiguo cacheaba app.js con localhost hardcodeado y rompía el login
    // desde otros PCs. Mantenemos esta limpieza permanente para no volver a caer.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
            .getRegistrations()
            .then(regs => Promise.all(regs.map(r => r.unregister())))
            .catch(() => {});
    }
    if ('caches' in window) {
        caches
            .keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .catch(() => {});
    }
})();
