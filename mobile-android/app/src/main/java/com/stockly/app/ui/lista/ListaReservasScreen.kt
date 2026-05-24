package com.stockly.app.ui.lista

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.stockly.app.data.ReservasRepository
import com.stockly.app.data.TokenStore
import com.stockly.app.model.ReservaListItem
import com.stockly.app.ui.theme.colorsParaEstado
import kotlinx.coroutines.launch

private enum class Filtro { ACTIVAS, PENDIENTES, CONFIRMADAS }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListaReservasScreen(
    repo: ReservasRepository,
    tokenStore: TokenStore,
    onAbrirDetalle: (Int) -> Unit,
    onLogout: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var cargando by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reservas by remember { mutableStateOf<List<ReservaListItem>>(emptyList()) }
    var filtro by remember { mutableStateOf(Filtro.ACTIVAS) }

    suspend fun cargar() {
        cargando = true
        error = null
        runCatching {
            when (filtro) {
                Filtro.ACTIVAS     -> repo.listarActivas()
                Filtro.PENDIENTES  -> repo.listarPorEstado("pendiente")
                Filtro.CONFIRMADAS -> repo.listarPorEstado("confirmada")
            }
        }
            .onSuccess { reservas = it }
            .onFailure { error = it.message }
        cargando = false
    }

    LaunchedEffect(filtro) { cargar() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Reservas", fontWeight = FontWeight.Bold)
                        tokenStore.usuario?.nombre?.let {
                            Text(it, fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSecondary.copy(alpha = .75f))
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { scope.launch { cargar() } }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refrescar")
                    }
                    IconButton(onClick = { repo.logout(); onLogout() }) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Salir")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.secondary,
                    titleContentColor = MaterialTheme.colorScheme.onSecondary,
                    actionIconContentColor = MaterialTheme.colorScheme.onSecondary,
                ),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {

            // Segmented button — más limpio que chips
            SingleChoiceSegmentedButtonRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Filtro.entries.forEachIndexed { i, f ->
                    SegmentedButton(
                        selected = filtro == f,
                        onClick = { filtro = f },
                        shape = SegmentedButtonDefaults.itemShape(i, Filtro.entries.size),
                        label = {
                            Text(when (f) {
                                Filtro.ACTIVAS     -> "Activas"
                                Filtro.PENDIENTES  -> "Pendientes"
                                Filtro.CONFIRMADAS -> "Confirmadas"
                            })
                        },
                    )
                }
            }

            // Contador
            if (!cargando && error == null) {
                Text(
                    "${reservas.size} reserva${if (reservas.size == 1) "" else "s"}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                )
            }

            when {
                cargando -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }

                error != null -> EstadoVacio(
                    titulo = "Error de conexión",
                    detalle = error!!,
                )

                reservas.isEmpty() -> EstadoVacio(
                    titulo = "Sin reservas",
                    detalle = "No hay reservas en este filtro.",
                )

                else -> LazyColumn(
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(reservas, key = { it.id }) { r ->
                        ReservaCard(r, onClick = { onAbrirDetalle(r.id) })
                    }
                    item { Spacer(Modifier.height(16.dp)) }
                }
            }
        }
    }
}

@Composable
private fun ReservaCard(r: ReservaListItem, onClick: () -> Unit) {
    val ec = colorsParaEstado(r.estado)
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(Modifier.height(IntrinsicSize.Min)) {
            // Barra de color a la izquierda según estado
            Box(
                Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(ec.accent),
            )

            Column(Modifier.padding(14.dp).weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "#${r.id}",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                    )
                    r.sku?.let {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            it,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    EstadoChip(r.estado)
                }

                Spacer(Modifier.height(6.dp))

                Text(
                    r.producto ?: "Producto #${r.productoId ?: '?'}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 2,
                )

                Spacer(Modifier.height(8.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    MetaIconoTexto(Icons.Default.Inventory2, "${r.cantidad} ud")
                    r.ubicacion?.let {
                        Spacer(Modifier.width(12.dp))
                        MetaIconoTexto(Icons.Default.LocationOn, it)
                    }
                }

                Spacer(Modifier.height(4.dp))
                MetaIconoTexto(Icons.Default.Person, r.usuario ?: "—")
            }
        }
    }
}

@Composable
private fun MetaIconoTexto(icono: androidx.compose.ui.graphics.vector.ImageVector, texto: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            icono,
            contentDescription = null,
            modifier = Modifier.size(14.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(4.dp))
        Text(
            texto,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun EstadoChip(estado: String) {
    val ec = colorsParaEstado(estado)
    Box(
        Modifier
            .clip(RoundedCornerShape(3.dp))
            .background(ec.bg)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(
            estado.uppercase(),
            color = ec.fg,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
    }
}

@Composable
private fun EstadoVacio(titulo: String, detalle: String) {
    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                titulo,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = .8f),
            )
            Spacer(Modifier.height(8.dp))
            Text(
                detalle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = .55f),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}
