package com.stockly.app.ui.detalle

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Note
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ReportProblem
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.stockly.app.data.ReservasRepository
import com.stockly.app.model.Incidencia
import com.stockly.app.model.ReservaDetalle
import com.stockly.app.model.Usuario
import com.stockly.app.ui.lista.EstadoChip
import com.stockly.app.ui.theme.colorsParaEstado
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
    LaunchedEffect(snack) { snack?.let { snackHost.showSnackbar(it); snack = null } }

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
        bottomBar = {
            detalle?.let { d ->
                BarraInferiorAcciones(
                    estado = d.estado,
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
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when {
                cargando -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                error != null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text(error!!, color = MaterialTheme.colorScheme.error)
                }
                detalle != null -> Detalle(d = detalle!!)
            }
        }
    }
}

@Composable
private fun Detalle(d: ReservaDetalle) {
    val ec = colorsParaEstado(d.estado)
    Column(
        Modifier
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
            .fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // Cabecera: estado + fecha
        Row(verticalAlignment = Alignment.CenterVertically) {
            EstadoChip(d.estado)
            Spacer(Modifier.weight(1f))
            d.fechaReserva?.let {
                Text(
                    "Creada: ${it.take(16).replace('T', ' ')}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = .6f),
                )
            }
        }

        // Hero del producto
        Card(
            shape = MaterialTheme.shapes.large,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(56.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(ec.bg),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Default.Inventory2,
                            contentDescription = null,
                            tint = ec.accent,
                            modifier = Modifier.size(28.dp),
                        )
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            d.producto,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            "SKU ${d.sku}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Spacer(Modifier.height(12.dp))
                Row {
                    MetaCelda(
                        rotulo = "CANTIDAD",
                        valor = "${d.cantidad}${d.unidad?.let { " $it" } ?: ""}",
                        modifier = Modifier.weight(1f),
                    )
                    d.ubicacion?.let {
                        MetaCelda(
                            rotulo = "UBICACIÓN",
                            valor = it,
                            icono = Icons.Default.LocationOn,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    d.precio?.let {
                        MetaCelda(
                            rotulo = "PRECIO",
                            valor = "%.2f €".format(it),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                d.productoDescripcion?.takeIf { it.isNotBlank() }?.let {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        // Cliente
        SeccionCard(titulo = "CLIENTE", icono = Icons.Default.Person) {
            Text(d.usuario, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface)
            d.usuarioEmail?.let {
                Text(it, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            d.notas?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.Top) {
                    Icon(Icons.Default.Note, null, modifier = Modifier.size(16.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(6.dp))
                    Text(it, style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface)
                }
            }
        }

        // Trazabilidad
        if (d.confirmadaPor != null || d.entregadaPor != null) {
            SeccionCard(titulo = "TRAZABILIDAD", icono = Icons.Default.CheckCircle) {
                d.confirmadaPor?.let {
                    LineaTraza(Icons.Default.AssignmentTurnedIn, "Confirmado por", it)
                }
                d.entregadaPor?.let {
                    if (d.confirmadaPor != null) Spacer(Modifier.height(8.dp))
                    LineaTraza(Icons.Default.LocalShipping, "Entregado por", it)
                }
            }
        }

        // Incidencias
        if (d.incidencias.isNotEmpty()) {
            SeccionCard(
                titulo = "INCIDENCIAS (${d.incidencias.size})",
                icono = Icons.Default.Warning,
                acento = MaterialTheme.colorScheme.error,
            ) {
                d.incidencias.forEachIndexed { i, inc ->
                    if (i > 0) {
                        Spacer(Modifier.height(8.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        Spacer(Modifier.height(8.dp))
                    }
                    IncidenciaItem(inc)
                }
            }
        }

        Spacer(Modifier.height(80.dp)) // espacio para que la barra inferior no tape
    }
}

@Composable
private fun MetaCelda(
    rotulo: String,
    valor: String,
    modifier: Modifier = Modifier,
    icono: ImageVector? = null,
) {
    Column(modifier) {
        Text(
            rotulo,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(2.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            icono?.let {
                Icon(it, null, modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(4.dp))
            }
            Text(
                valor,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
private fun SeccionCard(
    titulo: String,
    icono: ImageVector,
    acento: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.primary,
    contenido: @Composable ColumnScope.() -> Unit,
) {
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icono, null, modifier = Modifier.size(16.dp), tint = acento)
                Spacer(Modifier.width(6.dp))
                Text(
                    titulo,
                    style = MaterialTheme.typography.labelMedium,
                    color = acento,
                )
            }
            Spacer(Modifier.height(10.dp))
            contenido()
        }
    }
}

@Composable
private fun LineaTraza(icono: ImageVector, rotulo: String, u: Usuario) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(32.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icono, null, modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.onPrimaryContainer)
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text(rotulo, style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(u.nombre, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

@Composable
private fun IncidenciaItem(i: Incidencia) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Default.ReportProblem,
                null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error,
            )
            Spacer(Modifier.width(6.dp))
            Text(
                i.tipo.replace("_", " ").uppercase(),
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.labelMedium,
            )
            Spacer(Modifier.weight(1f))
            i.creadoEn?.let {
                Text(
                    it.take(16).replace('T', ' '),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(
            i.descripcion,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        i.operario?.let {
            Spacer(Modifier.height(4.dp))
            Text(
                "Reportado por $it",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun BarraInferiorAcciones(
    estado: String,
    procesando: Boolean,
    onConfirmar: () -> Unit,
    onEntregar: () -> Unit,
    onIncidencia: () -> Unit,
) {
    val accionPrincipal: (@Composable () -> Unit)? = when (estado) {
        "pendiente" -> { {
            Button(
                onClick = onConfirmar,
                enabled = !procesando,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = MaterialTheme.shapes.medium,
            ) {
                Icon(Icons.Default.AssignmentTurnedIn, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("CONFIRMAR PEDIDO", letterSpacing = 1.sp, fontWeight = FontWeight.Bold)
            }
        } }
        "confirmada" -> { {
            Button(
                onClick = onEntregar,
                enabled = !procesando,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = MaterialTheme.shapes.medium,
            ) {
                Icon(Icons.Default.LocalShipping, null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("CONFIRMAR ENTREGA", letterSpacing = 1.sp, fontWeight = FontWeight.Bold)
            }
        } }
        else -> null
    }

    val mostrarIncidencia = estado in listOf("pendiente", "confirmada")
    if (accionPrincipal == null && !mostrarIncidencia) return

    Surface(
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 8.dp,
    ) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            accionPrincipal?.invoke()
            if (mostrarIncidencia) {
                OutlinedButton(
                    onClick = onIncidencia,
                    enabled = !procesando,
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Icon(Icons.Default.ReportProblem, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("REPORTAR INCIDENCIA", letterSpacing = 1.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
