package com.stockly.app.ui.incidencia

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.stockly.app.data.ReservasRepository
import kotlinx.coroutines.launch

private data class TipoIncidencia(val valor: String, val etiqueta: String)
private val TIPOS = listOf(
    TipoIncidencia("rotura", "Rotura"),
    TipoIncidencia("faltante", "Faltante"),
    TipoIncidencia("mal_estado", "Mal estado"),
    TipoIncidencia("otro", "Otro"),
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
                title = { Text("Incidencia · Reserva #$reservaId", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Atrás") }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.secondary,
                    titleContentColor = MaterialTheme.colorScheme.onSecondary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSecondary,
                ),
            )
        }
    ) { padding ->
        Column(
            Modifier.padding(padding).padding(16.dp).fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Tipo de incidencia", style = MaterialTheme.typography.titleMedium)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                TIPOS.forEach { t ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        RadioButton(selected = tipo == t.valor, onClick = { tipo = t.valor })
                        Text(t.etiqueta, modifier = Modifier.padding(start = 4.dp))
                    }
                }
            }

            HorizontalDivider()

            Text("Descripción", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = descripcion,
                onValueChange = { descripcion = it.take(2000) },
                placeholder = { Text("Describe brevemente el problema…") },
                minLines = 5,
                maxLines = 10,
                modifier = Modifier.fillMaxWidth(),
            )
            Text("${descripcion.length} / 2000", style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = .6f))

            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error)
            }

            Spacer(Modifier.weight(1f))

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
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                if (enviando) CircularProgressIndicator(
                    Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp,
                ) else Text("ENVIAR INCIDENCIA")
            }
        }
    }
}
