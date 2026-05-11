// =============================================================
// Stockly - Frontend (vanilla JS)
// Autores: Adrián Bravo Santos y Miguel Ángel Florido
// =============================================================

// API siempre relativa: el backend sirve también el frontend, así que la API
// está en el mismo origin que la página. Esto evita romper desde otros PCs.
const API = '/api';

// ----------- Estado global -----------
const state = {
    token:        localStorage.getItem('token') || null,
    user:         JSON.parse(localStorage.getItem('user') || 'null'),
    view:         'productos',
    page: 1, limit: 20, total: 0,
    search: '', categoria: '', sort: 'id', dir: 'asc',
    productoSel: null,
    reservaFiltro: '',
    invFiltro: { search: '', categoria: '', stockBajo: false }
};

// ----------- Utilidades -----------
const $  = sel => document.querySelector(sel);
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
    const data = r.headers.get('content-type')?.includes('application/json')
        ? await r.json() : await r.text();
    if (!r.ok) throw new Error(data.error || data || `HTTP ${r.status}`);
    return data;
}

function fmt(n) { return new Intl.NumberFormat('es-ES').format(n); }
function fmtMoney(n) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(+n || 0); }
function fmtDate(d) { return d ? new Date(d).toLocaleString('es-ES') : '—'; }
function iniciales(n) { return (n || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase(); }

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
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// =============================================================
// Skeleton loaders
// =============================================================
function skLine(extra = '')   { return el('span', { class: 'skeleton sk-line ' + extra }); }
function skBlock(style = '')  { return el('span', { class: 'skeleton sk-block', style }); }
function skPill()             { return el('span', { class: 'skeleton sk-pill' }); }

function skeletonProductos(count = 8) {
    const grid = $('#productos-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < count; i++) {
        grid.append(el('div', { class: 'card skeleton-card' },
            skLine('short'),
            skLine('long'),
            skLine('medium'),
            skLine('short'),
            skLine('medium'),
            skLine('short')
        ));
    }
    $('#prod-count').textContent = '';
}

function skeletonReservas(count = 5) {
    const cont = $('#reservas-lista');
    if (!cont) return;
    cont.innerHTML = '';
    for (let i = 0; i < count; i++) {
        cont.append(el('div', { class: 'reserva skeleton-card' },
            el('div', { class: 'info' },
                skLine('long'),
                skLine('medium'),
                skLine('short')
            ),
            skPill(),
            el('div', {})
        ));
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
    ['st-productos','st-stock-bajo','st-usuarios','st-pendientes','st-entregadas','st-valor'].forEach(id => {
        const n = $('#'+id); if (!n) return;
        n.innerHTML = '';
        n.append(el('span', { class: 'skeleton sk-line', style: 'display:inline-block;width:84px;height:1.6rem' }));
    });
    ['chart-reservas','chart-categorias'].forEach(id => {
        const c = $('#'+id); if (!c) return;
        c.innerHTML = '';
        c.append(el('span', { class: 'skeleton sk-block', style: 'height:200px' }));
    });
    const top = $('#top-productos'); if (top) {
        top.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            top.append(el('div', { class: 'rank-row skeleton-card' },
                el('span', { class: 'skeleton sk-line short', style: 'width:36px' }),
                el('div', { style: 'flex:1' }, skLine('long'), skLine('short')),
                skPill()
            ));
        }
    }
    const mov = $('#movimientos'); if (mov) {
        mov.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            mov.append(el('div', { class: 'mov-row skeleton-card' },
                el('span', { class: 'skeleton sk-line short' }),
                el('span', { class: 'skeleton sk-line long' }),
                el('span', { class: 'skeleton sk-line short' }),
                el('span', { class: 'skeleton sk-line short' })
            ));
        }
    }
}

// =============================================================
// Autenticación
// =============================================================
async function login(email, password) {
    const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = r.token; state.user = r.user;
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    entrarApp();
}

async function registro(nombre, email, password) {
    const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ nombre, email, password }) });
    state.token = r.token; state.user = r.user;
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    entrarApp();
}

function cerrarSesion() {
    state.token = null; state.user = null;
    localStorage.removeItem('token'); localStorage.removeItem('user');
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
    $$('.admin-only').forEach(n => n.style.display = esAdmin ? '' : 'none');
}

// =============================================================
// Navegación de vistas
// =============================================================
function cambiarVista(view) {
    state.view = view;
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#view-${view}`)?.classList.add('active');
    $$('.tab, .bn').forEach(t => t.classList.toggle('active', t.dataset.view === view));

    if (view === 'productos')   cargarProductos();
    if (view === 'reservas')    cargarReservas();
    if (view === 'dashboard')   cargarDashboard();
    if (view === 'inventario')  { cargarInventario(); cargarCategorias(); }
    if (view === 'usuarios')    cargarUsuarios();
}

// =============================================================
// Productos (catálogo cliente)
// =============================================================
async function cargarCategorias() {
    try {
        const cats = await api('/categorias');
        const opts = ['<option value="">Todas las categorías</option>',
            ...cats.map(c => `<option value="${c.id}">${c.nombre}</option>`)].join('');
        const fc = $('#filtro-categoria'); if (fc) fc.innerHTML = opts;
        const ic = $('#inv-categoria');    if (ic) ic.innerHTML = opts;
        cargarCategorias._cache = cats;
    } catch (e) { console.warn(e); }
}

async function cargarProductos() {
    skeletonProductos();
    const params = new URLSearchParams({
        page: state.page, limit: state.limit,
        search: state.search, categoria: state.categoria,
        sort: state.sort, dir: state.dir
    });
    try {
        const r = await api('/productos?' + params);
        state.total = r.total;
        renderProductos(r.data);
        renderPaginacion(r.pages || Math.ceil(r.total / state.limit));
        $('#prod-count').textContent = `${fmt(r.total)} resultado${r.total === 1 ? '' : 's'}`;
    } catch (e) { toast(e.message, 'error'); }
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
        const card = el('div', { class: 'card' },
            el('span', { class: 'sku' }, p.sku),
            el('h3', {}, p.nombre),
            p.categoria && el('span', { class: 'cat-pill' }, p.categoria),
            el('div', { class: 'meta' }, '📍 ', p.ubicacion),
            stockChip(disp, p.stock_minimo),
            el('div', { class: 'precio' }, fmtMoney(p.precio)),
            el('button', {
                class: 'btn btn-primary btn-block',
                onclick: () => abrirModalReserva(p),
                disabled: disp <= 0
            }, disp <= 0 ? 'Sin stock' : 'Reservar')
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
            notas: $('#m-notas').value || null
        };
        const r = await api('/reservas', { method: 'POST', body: JSON.stringify(body) });
        toast(`Reserva #${r.id} creada`, 'ok');
        cerrarModal();
        cargarProductos();
    } catch (e) { toast(e.message, 'error'); }
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
    } catch (e) { toast(e.message, 'error'); }
}

function renderReservas(data) {
    const cont = $('#reservas-lista');
    cont.innerHTML = '';
    if (!data.length) {
        cont.append(el('p', { class: 'muted' }, 'No hay reservas con estos filtros.'));
        return;
    }
    const esStaff = state.user.rol !== 'cliente';
    data.forEach(r => {
        const acciones = el('div', { class: 'small-actions' });
        if (esStaff && r.estado === 'pendiente')
            acciones.append(el('button', { class: 'btn btn-ghost', onclick: () => cambiarEstadoReserva(r.id, 'confirmada') }, 'Confirmar'));
        if (esStaff && (r.estado === 'pendiente' || r.estado === 'confirmada'))
            acciones.append(el('button', { class: 'btn btn-primary', onclick: () => cambiarEstadoReserva(r.id, 'entregada') }, 'Entregar'));
        if ((r.estado === 'pendiente' || r.estado === 'confirmada'))
            acciones.append(el('button', { class: 'btn btn-danger', onclick: () => cancelarReserva(r.id) }, 'Cancelar'));

        const fila = el('div', { class: 'reserva' },
            el('div', { class: 'info' },
                el('strong', {}, `${r.sku} · ${r.producto}`),
                el('div', { class: 'muted' }, `Cantidad: ${r.cantidad} · Ubicación: ${r.ubicacion}`),
                el('div', { class: 'muted' }, `Reservada: ${fmtDate(r.fecha_reserva)}` + (r.fecha_recogida ? ` · Recogida: ${r.fecha_recogida}` : '')),
                esStaff && el('div', { class: 'muted' }, `👤 ${r.usuario}`)
            ),
            el('span', { class: 'estado ' + r.estado }, r.estado),
            acciones
        );
        cont.append(fila);
    });
}

async function cambiarEstadoReserva(id, estado) {
    try {
        await api(`/reservas/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) });
        toast(`Reserva ${estado}`, 'ok');
        cargarReservas();
    } catch (e) { toast(e.message, 'error'); }
}

async function cancelarReserva(id) {
    const ok = await confirmar({
        titulo: 'Cancelar reserva',
        mensaje: `¿Seguro que quieres cancelar la reserva #${id}? El stock volverá a estar disponible.`,
        ok: 'Sí, cancelar',
        cancel: 'Volver',
        peligroso: true,
        icono: '✕'
    });
    if (!ok) return;
    try {
        await api(`/reservas/${id}`, { method: 'DELETE' });
        toast('Reserva cancelada', 'ok');
        cargarReservas();
    } catch (e) { toast(e.message, 'error'); }
}

// =============================================================
// Dashboard
// =============================================================
async function cargarDashboard() {
    skeletonDashboard();
    try {
        const s = await api('/admin/stats');
        $('#st-productos').textContent  = fmt(s.totales.productos);
        $('#st-stock-bajo').textContent = fmt(s.totales.stock_bajo);
        $('#st-usuarios').textContent   = fmt(s.totales.usuarios);
        $('#st-pendientes').textContent = fmt(s.totales.pendientes);
        $('#st-entregadas').textContent = fmt(s.totales.entregadas);
        $('#st-valor').textContent      = fmtMoney(s.totales.valor_inventario);

        renderBarChart('#chart-reservas', s.reservasPorDia.map(d => ({ label: d.dia.slice(5), value: d.total })));
        renderBarChart('#chart-categorias', s.porCategoria.map(c => ({ label: c.nombre.slice(0, 6), value: c.stock_total })));

        const top = $('#top-productos'); top.innerHTML = '';
        s.topProductos.forEach((p, i) => top.append(
            el('div', { class: 'rank-row' },
                el('span', { class: 'rank-pos' }, `#${i + 1}`),
                el('div', { style: 'flex:1' },
                    el('strong', {}, p.nombre),
                    el('div', { class: 'muted' }, p.sku)),
                el('span', { class: 'role-badge' }, `${p.reservas} reservas`)
            )));

        const movs = await api('/admin/movimientos?limit=20');
        const cont = $('#movimientos'); cont.innerHTML = '';
        movs.forEach(m => cont.append(
            el('div', { class: 'mov-row' },
                el('span', { class: 'mov-tipo ' + m.tipo }, m.tipo),
                el('span', {}, `${m.sku} · ${m.producto}`),
                el('span', { class: 'muted' }, `${m.cantidad > 0 ? '+' : ''}${m.cantidad}`),
                el('span', { class: 'muted' }, fmtDate(m.fecha))
            )));

        $('#link-csv').onclick = async (e) => {
            e.preventDefault();
            const r = await fetch(`${API}/admin/export/reservas.csv`, { headers: { Authorization: `Bearer ${state.token}` } });
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'reservas.csv'; a.click();
            URL.revokeObjectURL(url);
        };
    } catch (e) { toast(e.message, 'error'); }
}

function renderBarChart(sel, data) {
    const cont = $(sel); cont.innerHTML = '';
    if (!data.length) { cont.append(el('p', { class: 'muted' }, 'Sin datos')); return; }
    const max = Math.max(...data.map(d => d.value), 1);
    data.forEach(d => {
        const h = (d.value / max) * 100;
        const bar = el('div', { class: 'bar', style: `height:${h}%`, title: `${d.label}: ${d.value}` },
            el('span', { class: 'val' }, d.value),
            el('small', {}, d.label));
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
        limit: 100, search: f.search, categoria: f.categoria,
        stock_bajo: f.stockBajo ? 1 : 0
    });
    try {
        const r = await api('/productos?' + params);
        const tbody = $('#inv-body'); tbody.innerHTML = '';
        r.data.forEach(p => {
            const disp = p.stock - p.stock_reservado;
            const fila = el('tr', {},
                el('td', {}, p.sku),
                el('td', {}, p.nombre),
                el('td', {}, p.categoria || '—'),
                el('td', {}, p.ubicacion),
                el('td', {}, String(p.stock)),
                el('td', {}, String(p.stock_reservado)),
                el('td', {}, String(p.stock_minimo)),
                el('td', {}, fmtMoney(p.precio)),
                el('td', {},
                    el('div', { class: 'small-actions' },
                        el('button', { class: 'btn btn-ghost', onclick: () => abrirModalProducto(p) }, '✏️'),
                        state.user.rol === 'admin' && el('button', { class: 'btn btn-danger', onclick: () => eliminarProducto(p.id) }, '🗑')
                    ))
            );
            if (disp <= p.stock_minimo) fila.style.background = 'rgba(217,119,6,.08)';
            tbody.append(fila);
        });
    } catch (e) { toast(e.message, 'error'); }
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
        try { skuSugerido = (await api('/productos/sku-sugerido')).sku; } catch {}
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
            sku:          $('#p-sku').value.trim().toUpperCase(),
            nombre:       $('#p-nombre').value.trim(),
            descripcion:  $('#p-desc').value.trim() || null,
            categoria_id: $('#p-cat').value ? +$('#p-cat').value : null,
            ubicacion:    $('#p-ubic').value.trim().toUpperCase(),
            stock:        +$('#p-stock').value || 0,
            stock_minimo: +$('#p-min').value || 0,
            precio:       +$('#p-precio').value || 0
        };
        const okBtn = $('#p-ok'); okBtn.disabled = true;
        try {
            if (editar) await api('/productos/' + p.id, { method: 'PUT',  body: JSON.stringify(body) });
            else        await api('/productos',          { method: 'POST', body: JSON.stringify(body) });
            toast(editar ? 'Producto actualizado' : `Producto creado · ${body.sku}`, 'ok');
            cerrarModal();
            if (state.view === 'inventario') cargarInventario();
            if (state.view === 'productos')  cargarProductos();
        } catch (e) { toast(e.message, 'error'); }
        finally { okBtn.disabled = false; }
    };
    abrirModal();
    setTimeout(() => $('#p-nombre')?.focus(), 50);
}

async function eliminarProducto(id) {
    const ok = await confirmar({
        titulo: 'Dar de baja producto',
        mensaje: 'El producto dejará de aparecer en el catálogo y no podrá reservarse. Los movimientos históricos se conservan.',
        ok: 'Dar de baja',
        cancel: 'Cancelar',
        peligroso: true,
        icono: '🗑'
    });
    if (!ok) return;
    try { await api('/productos/' + id, { method: 'DELETE' }); toast('Producto dado de baja', 'ok'); cargarInventario(); }
    catch (e) { toast(e.message, 'error'); }
}

// =============================================================
// Usuarios (admin)
// =============================================================
async function cargarUsuarios() {
    if (state.user.rol !== 'admin') return;
    skeletonTabla('#usr-body', 6);
    try {
        const data = await api('/admin/usuarios');
        const tbody = $('#usr-body'); tbody.innerHTML = '';
        data.forEach(u => tbody.append(
            el('tr', {},
                el('td', {}, u.nombre),
                el('td', {}, u.email),
                el('td', {}, el('span', { class: 'role-badge' }, u.rol)),
                el('td', {}, u.activo ? 'Activo' : 'Inactivo'),
                el('td', {}, fmtDate(u.creado_en)),
                el('td', {},
                    el('div', { class: 'small-actions' },
                        el('button', { class: 'btn btn-ghost', onclick: () => abrirModalUsuario(u) }, '✏️')))
            )));
    } catch (e) { toast(e.message, 'error'); }
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
                email:  $('#u-email').value.trim(),
                rol:    $('#u-rol').value,
                activo: +$('#u-activo').value
            };
            const pass = $('#u-pass').value;
            if (pass) body.password = pass;
            if (editar) await api('/admin/usuarios/' + u.id, { method: 'PUT', body: JSON.stringify(body) });
            else {
                if (!pass) return toast('La contraseña es obligatoria', 'error');
                await api('/admin/usuarios', { method: 'POST', body: JSON.stringify(body) });
            }
            toast(editar ? 'Usuario actualizado' : 'Usuario creado', 'ok');
            cerrarModal(); cargarUsuarios();
        } catch (e) { toast(e.message, 'error'); }
    };
    abrirModal();
}

// =============================================================
// Modal helpers
// =============================================================
function abrirModal()  { $('#modal').classList.remove('hidden'); }
function cerrarModal() { $('#modal').classList.add('hidden'); }

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
            icono = '⚠'
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

        const onKey = e => { if (e.key === 'Escape') cerrar(false); };

        const cerrar = (valor) => {
            document.removeEventListener('keydown', onKey);
            $('#modal-cerrar').onclick = prevCloseHandler;
            $('#modal').onclick        = prevModalHandler;
            cerrarModal();
            // Permite que la animación de cierre acabe antes de resolver
            setTimeout(() => resolve(valor), 50);
        };

        $('#confirm-ok').onclick     = () => cerrar(true);
        $('#confirm-cancel').onclick = () => cerrar(false);
        $('#modal-cerrar').onclick   = () => cerrar(false);
        $('#modal').onclick          = e => { if (e.target.id === 'modal') cerrar(false); };
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
// Eventos
// =============================================================
function bindEventos() {

    // Login / registro
    $$('.auth-tab').forEach(b => b.onclick = () => {
        $$('.auth-tab').forEach(x => x.classList.toggle('active', x === b));
        $$('.auth-form').forEach(f => f.classList.remove('active'));
        $('#form-' + b.dataset.auth).classList.add('active');
    });
    $('#form-login').onsubmit = async e => {
        e.preventDefault();
        try { await login($('#login-email').value, $('#login-password').value); }
        catch (err) { toast(err.message, 'error'); }
    };
    $('#form-register').onsubmit = async e => {
        e.preventDefault();
        try { await registro($('#reg-nombre').value, $('#reg-email').value, $('#reg-password').value); }
        catch (err) { toast(err.message, 'error'); }
    };

    // Tabs
    $$('[data-view]').forEach(b => b.onclick = () => cambiarVista(b.dataset.view));

    // Buscar productos (debounce reutilizable)
    $('#buscar').oninput = debounce(e => {
        state.search = e.target.value; state.page = 1; cargarProductos();
    });
    $('#filtro-categoria').onchange = e => { state.categoria = e.target.value; state.page = 1; cargarProductos(); };
    $('#orden').onchange = e => {
        const [s, d] = e.target.value.split('-');
        state.sort = s; state.dir = d; state.page = 1; cargarProductos();
    };
    $('#prev').onclick = () => { if (state.page > 1) { state.page--; cargarProductos(); } };
    $('#next').onclick = () => { state.page++; cargarProductos(); };

    // Reservas - filtros
    $$('.chip-filters .chip').forEach(c => c.onclick = () => {
        $$('.chip-filters .chip').forEach(x => x.classList.toggle('active', x === c));
        state.reservaFiltro = c.dataset.estado;
        cargarReservas();
    });

    // Inventario
    $('#inv-buscar')?.addEventListener('input', debounce(e => {
        state.invFiltro.search = e.target.value; cargarInventario();
    }));
    $('#inv-categoria')?.addEventListener('change', e => { state.invFiltro.categoria = e.target.value; cargarInventario(); });
    $('#inv-stockbajo')?.addEventListener('change', e => { state.invFiltro.stockBajo = e.target.checked; cargarInventario(); });
    $('#btn-nuevo-producto')?.addEventListener('click', () => abrirModalProducto());
    $('#fab-nuevo')?.addEventListener('click', () => abrirModalProducto());

    // Usuarios
    $('#btn-nuevo-usuario')?.addEventListener('click', () => abrirModalUsuario());

    // Modal
    $('#modal-cerrar').onclick = cerrarModal;
    $('#modal').onclick = e => { if (e.target.id === 'modal') cerrarModal(); };

    // User dropdown
    $('#btn-user').onclick = e => { e.stopPropagation(); $('#user-dropdown').classList.toggle('hidden'); };
    document.addEventListener('click', () => $('#user-dropdown').classList.add('hidden'));
    $('#btn-logout').onclick = cerrarSesion;

    // Tema
    $('#btn-theme').onclick = () => aplicarTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

// =============================================================
// Init
// =============================================================
(async () => {
    bindEventos();
    aplicarTema(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

    if (state.token) {
        try { await api('/auth/me'); entrarApp(); }
        catch { cerrarSesion(); }
    }

    // Kill switch: desregistra cualquier service worker antiguo y limpia caches.
    // El sw.js antiguo cacheaba app.js con localhost hardcodeado y rompía el login
    // desde otros PCs. Mantenemos esta limpieza permanente para no volver a caer.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
            .then(regs => Promise.all(regs.map(r => r.unregister())))
            .catch(() => {});
    }
    if ('caches' in window) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
    }
})();
