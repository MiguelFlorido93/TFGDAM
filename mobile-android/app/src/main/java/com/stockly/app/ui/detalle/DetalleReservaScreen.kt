package com.stockly.app.ui.detalle

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.stockly.app.data.ReservasRepository
import com.stockly.app.model.Incidencia
import com.stockly.app.model.ReservaDetalle
import com.stockly.app.model.Usuario
import com.stockly.app.ui.lista.EstadoChip
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetalleReservaScreen(
    id: Int,
    repo: ReservasRepository,
    onBack: () -> Unit,
    onAbrirIncidencia: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var cargando by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var detalle by remember { mutableStateOf<ReservaDetalle?>(null) }
    var procesando by remember { mutableStateOf(false) }
    var snack by remember { mutableStateOf<String?>(null) }
    val snackHost = remember { SnackbarHostState() }

    suspend fun cargar() {
        cargando = true
        error = null
        runCatching { repo.detalle(id) }
            .onSuccess { detalle = it }
            .onFailure { error = it.message }
        cargando = false
    }

    LaunchedEffect(id) { cargar() }
    LaunchedEffect(snack) {
        snack?.let { snackHost.showSnackbar(it); snack = null }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Reserva #$id", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Atrás") }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.secondary,
                    titleContentColor = MaterialTheme.colorScheme.onSecondary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSecondary,
                ),
            )
        },
        snackbarHost = { SnackbarHost(snackHost) },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when {
                cargando -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                error != null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text(error!!, color = MaterialTheme.colorScheme.error)
                }
                detalle != null -> Detalle(
                    d = detalle!!,
                    procesando = procesando,
                    onConfirmar = {
                        procesando = true
                        scope.launch {
                            runCatching { repo.confirmar(id) }
                                .onSuccess { snack = "Pedido confirmado"; cargar() }
                                .onFailure { snack = "Error: ${it.message}" }
                            procesando = false
                        }
                    },
                    onEntregar = {
                        procesando = true
                        scope.launch {
                            runCatching { repo.entregar(id) }
                                .onSuccess { snack = "Entrega confirmada"; cargar() }
                                .onFailure { snack = "Error: ${it.message}" }
                            procesando = false
                        }
                    },
                    onIncidencia = onAbrirIncidencia,
                )
            }
        }
    }
}

@Composable
private fun Detalle(
    d: ReservaDetalle,
    procesando: Boolean,
    onConfirmar: () -> Unit,
    onEntregar: () -> Unit,
    onIncidencia: () -> Unit,
) {
    Column(
        Modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
            .fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Cabecera estado
        Row(verticalAlignment = Alignment.CenterVertically) {
            EstadoChip(d.estado)
            Spacer(Modifier.weight(1f))
            d.fechaReserva?.let {
                Text(it.take(16), style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = .6f))
            }
        }

        // Producto
        Card {
            Column(Modifier.padding(12.dp)) {
                Text("PRODUCTO", style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(6.dp))
                Text(d.producto, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text("SKU ${d.sku}", style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = .7f))
                Spacer(Modifier.height(6.dp))
                Row {
                    Text("Cantidad: ${d.cantidad}${d.unidad?.let { " $it" } ?: ""}",
                        fontWeight = FontWeight.SemiBold)
                    d.ubicacion?.let {
                        Spacer(Modifier.weight(1f))
                        Text("📍 $it", color = MaterialTheme.colorScheme.primary)
                    }
                }
                d.productoDescripcion?.takeIf { it.isNotBlank() }?.let {
                    Spacer(Modifier.height(6.dp))
                    Text(it, style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = .8f))
                }
            }
        }

        // Cliente
        Card {
            Column(Modifier.padding(12.dp)) {
                Text("CLIENTE", style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(6.dp))
                Text(d.usuario, fontWeight = FontWeight.SemiBold)
                d.usuarioEmail?.let { Text(it, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = .7f)) }
                d.notas?.takeIf { it.isNotBlank() }?.let {
                    Spacer(Modifier.height(6.dp))
                    Text("Notas: $it", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        // Trazabilidad
        if (d.confirmadaPor != null || d.entregadaPor != null) {
            Card {
                Column(Modifier.padding(12.dp)) {
                    Text("TRAZABILIDAD", style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(6.dp))
                    d.confirmadaPor?.let { LineaUsuario("Confirmado por", it) }
                    d.entregadaPor?.let { LineaUsuario("Entregado por", it) }
                }
            }
        }

        // Incidencias
        if (d.incidencias.isNotEmpty()) {
            Card {
                Column(Modifier.padding(12.dp)) {
                    Text("INCIDENCIAS (${d.incidencias.size})",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(6.dp))
                    d.incidencias.forEach { IncidenciaItem(it) }
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // Botones de acción
        when (d.estado) {
            "pendiente" -> Button(
                onClick = onConfirmar,
                enabled = !procesando,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text("CONFIRMAR PEDIDO") }

            "confirmada" -> Button(
                onClick = onEntregar,
                enabled = !procesando,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text("CONFIRMAR ENTREGA") }
        }

        if (d.estado in listOf("pendiente", "confirmada")) {
            OutlinedButton(
                onClick = onIncidencia,
                enabled = !procesando,
                modifier = Modifier.fillMaxWidth().height(48.dp),
            ) { Text("REPORTAR INCIDENCIA") }
        }
    }
}

@Composable
private fun LineaUsuario(rotulo: String, u: Usuario) {
    Row(Modifier.padding(vertical = 2.dp)) {
        Text("$rotulo: ", color = MaterialTheme.colorScheme.onSurface.copy(alpha = .7f))
        Text(u.nombre, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun IncidenciaItem(i: Incidencia) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Row {
            Text(i.tipo.replace("_", " ").uppercase(),
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.error)
            Spacer(Modifier.weight(1f))
            i.creadoEn?.let { Text(it.take(16), style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = .6f)) }
        }
        Text(i.descripcion, style = MaterialTheme.typography.bodyMedium)
        i.operario?.let {
            Text("Reportado por $it", style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = .6f))
        }
        HorizontalDivider(Modifier.padding(top = 6.dp))
    }
}
