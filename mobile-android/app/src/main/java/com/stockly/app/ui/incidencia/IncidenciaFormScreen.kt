package com.stockly.app.ui.incidencia

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.BrokenImage
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Send
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
import kotlinx.coroutines.launch

private data class TipoIncidencia(
    val valor: String,
    val etiqueta: String,
    val icono: ImageVector,
)
private val TIPOS = listOf(
    TipoIncidencia("rotura",     "Rotura",      Icons.Default.BrokenImage),
    TipoIncidencia("faltante",   "Faltante",    Icons.Default.Inventory),
    TipoIncidencia("mal_estado", "Mal estado",  Icons.Default.HelpOutline),
    TipoIncidencia("otro",       "Otro",        Icons.Default.MoreHoriz),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IncidenciaFormScreen(
    reservaId: Int,
    repo: ReservasRepository,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var tipo by remember { mutableStateOf(TIPOS.first().valor) }
    var descripcion by remember { mutableStateOf("") }
    var enviando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Nueva incidencia", fontWeight = FontWeight.Bold)
                        Text("Reserva #$reservaId", fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSecondary.copy(alpha = .75f))
                    }
                },
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
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 8.dp,
            ) {
                Button(
                    onClick = {
                        error = null
                        enviando = true
                        scope.launch {
                            runCatching { repo.reportarIncidencia(reservaId, tipo, descripcion.trim()) }
                                .onSuccess { onBack() }
                                .onFailure { error = it.message ?: "Error al enviar" }
                            enviando = false
                        }
                    },
                    enabled = !enviando && descripcion.trim().isNotEmpty(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .height(52.dp),
                    shape = MaterialTheme.shapes.medium,
                ) {
                    if (enviando) CircularProgressIndicator(
                        Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp,
                    ) else {
                        Icon(Icons.Default.Send, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("ENVIAR INCIDENCIA", letterSpacing = 1.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        },
    ) { padding ->
        Column(
            Modifier.padding(padding).padding(16.dp).fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            // Tipo
            Column {
                Text(
                    "TIPO DE INCIDENCIA",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.height(10.dp))
                // 2 columnas × 2 filas
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    TIPOS.chunked(2).forEach { fila ->
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            fila.forEach { t ->
                                TipoCard(
                                    tipo = t,
                                    seleccionado = tipo == t.valor,
                                    onClick = { tipo = t.valor },
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            // Si la fila tiene un solo elemento, dejamos hueco
                            if (fila.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }

            // Descripción
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "DESCRIPCIÓN",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        "${descripcion.length} / 2000",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = descripcion,
                    onValueChange = { descripcion = it.take(2000) },
                    placeholder = { Text("Describe brevemente el problema…") },
                    minLines = 5,
                    maxLines = 10,
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.medium,
                )
            }

            if (error != null) {
                Surface(
                    color = MaterialTheme.colorScheme.error.copy(alpha = .12f),
                    shape = MaterialTheme.shapes.small,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        error!!,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun TipoCard(
    tipo: TipoIncidencia,
    seleccionado: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val borderColor = if (seleccionado) MaterialTheme.colorScheme.primary
        else MaterialTheme.colorScheme.outline
    val bg = if (seleccionado) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surface
    val fg = if (seleccionado) MaterialTheme.colorScheme.onPrimaryContainer
        else MaterialTheme.colorScheme.onSurface

    OutlinedCard(
        onClick = onClick,
        modifier = modifier.height(76.dp),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.outlinedCardColors(containerColor = bg),
        border = BorderStroke(if (seleccionado) 2.dp else 1.dp, borderColor),
    ) {
        Row(
            Modifier.fillMaxSize().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        if (seleccionado) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.surfaceVariant
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    tipo.icono,
                    contentDescription = null,
                    tint = if (seleccionado) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.width(10.dp))
            Text(
                tipo.etiqueta,
                style = MaterialTheme.typography.titleSmall,
                color = fg,
            )
        }
    }
}
