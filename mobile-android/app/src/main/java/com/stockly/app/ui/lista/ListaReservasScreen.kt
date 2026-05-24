package com.stockly.app.ui.lista

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.stockly.app.data.ReservasRepository
import com.stockly.app.data.TokenStore
import com.stockly.app.model.ReservaListItem
import kotlinx.coroutines.launch

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
    var soloPendientes by remember { mutableStateOf(false) }
    var soloConfirmadas by remember { mutableStateOf(false) }

    suspend fun cargar() {
        cargando = true
        error = null
        runCatching {
            when {
                soloPendientes -> repo.listarPorEstado("pendiente")
                soloConfirmadas -> repo.listarPorEstado("confirmada")
                else -> repo.listarActivas()
            }
        }
            .onSuccess { reservas = it }
            .onFailure { error = it.message }
        cargando = false
    }

    LaunchedEffect(soloPendientes, soloConfirmadas) { cargar() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Reservas", fontWeight = FontWeight.Bold)
                        tokenStore.usuario?.nombre?.let {
                            Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSecondary.copy(alpha = .8f))
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { scope.launch { cargar() } }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refrescar")
                    }
                    IconButton(onClick = {
                        repo.logout()
                        onLogout()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Salir")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.secondary,
                    titleContentColor = MaterialTheme.colorScheme.onSecondary,
                    actionIconContentColor = MaterialTheme.colorScheme.onSecondary,
                ),
            )
        }
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            // Chips de filtro
            Row(
                Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(
                    selected = !soloPendientes && !soloConfirmadas,
                    onClick = { soloPendientes = false; soloConfirmadas = false },
                    label = { Text("Activas") },
                )
                FilterChip(
                    selected = soloPendientes,
                    onClick = { soloPendientes = !soloPendientes; if (soloPendientes) soloConfirmadas = false },
                    label = { Text("Pendientes") },
                )
                FilterChip(
                    selected = soloConfirmadas,
                    onClick = { soloConfirmadas = !soloConfirmadas; if (soloConfirmadas) soloPendientes = false },
                    label = { Text("Confirmadas") },
                )
            }

            HorizontalDivider()

            when {
                cargando -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }

                error != null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text(error!!, color = MaterialTheme.colorScheme.error)
                }

                reservas.isEmpty() -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Text("No hay reservas que mostrar", color = MaterialTheme.colorScheme.onBackground.copy(alpha = .6f))
                }

                else -> LazyColumn(
                    contentPadding = PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(reservas, key = { it.id }) { r ->
                        ReservaCard(r, onClick = { onAbrirDetalle(r.id) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ReservaCard(r: ReservaListItem, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "#${r.id}",
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    r.producto ?: "Producto #${r.productoId ?: '?'}",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                EstadoChip(r.estado)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "${r.cantidad} ud · SKU ${r.sku ?: "—"}${r.ubicacion?.let { " · $it" } ?: ""}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = .8f),
            )
            Spacer(Modifier.height(2.dp))
            Text(
                "Cliente: ${r.usuario ?: "—"}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = .65f),
            )
        }
    }
}

@Composable
fun EstadoChip(estado: String) {
    val (bg, fg) = when (estado) {
        "pendiente"  -> 0xFFFEF3C7 to 0xFFB45309
        "confirmada" -> 0xFFE8E2FF to 0xFF5B4FE0
        "entregada"  -> 0xFFD1FAE5 to 0xFF047857
        "cancelada"  -> 0xFFFEE2E2 to 0xFFB91C1C
        else          -> 0xFFE5E7EB to 0xFF374151
    }
    Box(
        Modifier.clip(RoundedCornerShape(2.dp))
            .background(androidx.compose.ui.graphics.Color(bg))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(
            estado.uppercase(),
            color = androidx.compose.ui.graphics.Color(fg),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
    }
}
