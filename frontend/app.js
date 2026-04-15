// =============================================================
// TFG - Frontend (vanilla JS)
// =============================================================
const API = (location.port === '3001' || location.port === '')
    ? '/api'
    : 'http://localhost:3001/api';

const state = {
    page: 1,
    limit: 20,
    total: 0,
    search: '',
    categoria: '',
    usuarioId: null,
    productoSel: null
};

// ------------------- Utilidades -------------------------------
const $ = sel => document.querySelector(sel);
const el = (tag, attrs = {}, ...hijos) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') n.className = v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
    });
    hijos.forEach(h => n.append(h?.nodeType ? h : document.createTextNode(h ?? '')));
    return n;
};
const toast = (msg, tipo = '') => {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + tipo;
    setTimeout(() => t.classList.add('oculto'), 2600);
};

// ------------------- Carga inicial ----------------------------
async function cargarUsuarios() {
    const r = await fetch(`${API}/usuarios`);
    const data = await r.json();
    const sel = $('#usuario');
    sel.innerHTML = data.map(u =>
        `<option value="${u.id}">${u.nombre} (${u.rol})</option>`).join('');
    state.usuarioId = parseInt(sel.value, 10);
    sel.addEventListener('change', () => {
        state.usuarioId = parseInt(sel.value, 10);
        if ($('#view-reservas').classList.contains('active')) cargarReservas();
    });
}

async function cargarCategorias() {
    const r = await fetch(`${API}/categorias`);
    const data = await r.json();
    $('#filtro-categoria').append(
        ...data.map(c => el('option', { value: c.id }, c.nombre))
    );
}

// ------------------- Productos --------------------------------
async function cargarProductos() {
    const params = new URLSearchParams({
        page: state.page, limit: state.limit,
        search: state.search, categoria: state.categoria
    });
    const r = await fetch(`${API}/productos?${params}`);
    const { data, total } = await r.json();
    state.total = total;
    renderProductos(data);
    renderPaginacion();
}

function renderProductos(productos) {
    const grid = $('#productos-grid');
    grid.innerHTML = '';
    if (!productos.length) {
        grid.append(el('p', {}, 'No se encontraron productos.'));
        return;
    }
    productos.forEach(p => {
        const disp = p.stock - p.stock_reservado;
        const card = el('div', { class: 'card' },
            el('span', { class: 'sku' }, p.sku),
            el('h3', {}, p.nombre),
            el('span', { class: 'cat' }, p.categoria || 'Sin categoría'),
            el('div', { class: 'meta' }, `Ubicación: ${p.ubicacion}`),
            el('div', { class: 'meta' + (disp < 10 ? ' stock-bajo' : '') },
                `Disponible: ${disp} / ${p.stock}`),
            el('div', { class: 'precio' }, `${p.precio} €`),
            el('button', {
                onclick: () => abrirModal(p),
                ...(disp <= 0 ? { disabled: 'true' } : {})
            }, disp <= 0 ? 'Sin stock' : 'Reservar')
        );
        grid.append(card);
    });
}

function renderPaginacion() {
    const paginas = Math.max(1, Math.ceil(state.total / state.limit));
    $('#pagina-info').textContent = `Página ${state.page} de ${paginas} · ${state.total} productos`;
    $('#prev').disabled = state.page <= 1;
    $('#next').disabled = state.page >= paginas;
}

// ------------------- Modal reserva ----------------------------
function abrirModal(producto) {
    state.productoSel = producto;
    $('#modal-titulo').textContent = `Reservar · ${producto.sku}`;
    $('#modal-info').textContent = `${producto.nombre} (disponible: ${producto.stock - producto.stock_reservado})`;
    $('#modal-cantidad').value = 1;
    $('#modal-cantidad').max = producto.stock - producto.stock_reservado;
    $('#modal-fecha').value = '';
    $('#modal-notas').value = '';
    $('#modal').classList.remove('oculto');
}

function cerrarModal() { $('#modal').classList.add('oculto'); }

async function confirmarReserva() {
    const body = {
        usuario_id:     state.usuarioId,
        producto_id:    state.productoSel.id,
        cantidad:       parseInt($('#modal-cantidad').value, 10),
        fecha_recogida: $('#modal-fecha').value || null,
        notas:          $('#modal-notas').value || null
    };
    const r = await fetch(`${API}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) return toast(data.error || 'Error al reservar', 'error');
    toast(`Reserva #${data.id} creada`, 'ok');
    cerrarModal();
    cargarProductos();
}

// ------------------- Reservas ---------------------------------
async function cargarReservas() {
    const r = await fetch(`${API}/reservas?usuario_id=${state.usuarioId}`);
    const data = await r.json();
    const cont = $('#reservas-lista');
    cont.innerHTML = '';
    if (!data.length) {
        cont.append(el('p', {}, 'Sin reservas para este usuario.'));
        return;
    }
    data.forEach(r => {
        const fila = el('div', { class: 'reserva' },
            el('div', {},
                el('strong', {}, `${r.sku} · ${r.producto}`),
                el('div', { class: 'meta' },
                    `Cantidad: ${r.cantidad} · Ubicación: ${r.ubicacion}`),
                el('div', { class: 'meta' },
                    `Reservada: ${new Date(r.fecha_reserva).toLocaleString('es-ES')}` +
                    (r.fecha_recogida ? ` · Recoger: ${r.fecha_recogida}` : ''))
            ),
            el('span', { class: 'estado ' + r.estado }, r.estado)
        );
        if (r.estado === 'pendiente' || r.estado === 'confirmada') {
            fila.append(el('button', {
                class: 'cancelar',
                onclick: () => cancelarReserva(r.id)
            }, 'Cancelar'));
        }
        cont.append(fila);
    });
}

async function cancelarReserva(id) {
    if (!confirm('¿Cancelar esta reserva?')) return;
    const r = await fetch(`${API}/reservas/${id}`, { method: 'DELETE' });
    const data = await r.json();
    if (!r.ok) return toast(data.error || 'Error', 'error');
    toast('Reserva cancelada', 'ok');
    cargarReservas();
}

// ------------------- Navegación / eventos ---------------------
document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        $(`#view-${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'reservas') cargarReservas();
    });
});

let debounce;
$('#buscar').addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
        state.search = e.target.value;
        state.page = 1;
        cargarProductos();
    }, 250);
});
$('#filtro-categoria').addEventListener('change', e => {
    state.categoria = e.target.value;
    state.page = 1;
    cargarProductos();
});
$('#prev').addEventListener('click', () => { if (state.page > 1) { state.page--; cargarProductos(); } });
$('#next').addEventListener('click', () => { state.page++; cargarProductos(); });

$('#modal-cancelar').addEventListener('click', cerrarModal);
$('#modal-confirmar').addEventListener('click', confirmarReserva);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') cerrarModal(); });

// ------------------- Init -------------------------------------
(async () => {
    try {
        await cargarUsuarios();
        await cargarCategorias();
        await cargarProductos();
    } catch (e) {
        toast('No se pudo conectar con la API. ¿Está el backend arrancado?', 'error');
        console.error(e);
    }
})();
