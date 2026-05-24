package com.stockly.app.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.stockly.app.data.ReservasRepository
import com.stockly.app.ui.theme.AceroOscuro
import com.stockly.app.ui.theme.Ocre
import com.stockly.app.ui.theme.OcreSoft
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    repo: ReservasRepository,
    onLogged: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var cargando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        // Banda superior con color acero (decoración)
        Box(
            Modifier
                .fillMaxWidth()
                .height(260.dp)
                .background(AceroOscuro),
        )

        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(60.dp))

            // Logo: S en cuadrado ocre
            Box(
                Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Ocre),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "S",
                    fontSize = 44.sp,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            }

            Spacer(Modifier.height(16.dp))

            Text(
                "STOCKLY",
                style = MaterialTheme.typography.displaySmall,
                color = MaterialTheme.colorScheme.onSecondary,
            )
            Text(
                "Almacén · operario",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSecondary.copy(alpha = .7f),
            )

            Spacer(Modifier.height(36.dp))

            // Card del formulario
            Card(
                Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(24.dp)) {
                    Text(
                        "Acceso",
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Spacer(Modifier.height(20.dp))

                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it.trim() },
                        label = { Text("Email") },
                        leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    )
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Contraseña") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(),
                        shape = MaterialTheme.shapes.medium,
                    )

                    if (error != null) {
                        Spacer(Modifier.height(12.dp))
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

                    Spacer(Modifier.height(20.dp))
                    Button(
                        onClick = {
                            error = null
                            cargando = true
                            scope.launch {
                                runCatching { repo.login(email, password) }
                                    .onSuccess { onLogged() }
                                    .onFailure { e ->
                                        error = e.message?.takeIf { it.isNotBlank() } ?: "Error de acceso"
                                    }
                                cargando = false
                            }
                        },
                        enabled = !cargando && email.isNotBlank() && password.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(52.dp),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        if (cargando) CircularProgressIndicator(
                            Modifier.size(20.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            strokeWidth = 2.dp,
                        ) else Text(
                            "ENTRAR",
                            letterSpacing = 2.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Hint de credenciales demo
            Surface(
                color = OcreSoft,
                shape = MaterialTheme.shapes.small,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(
                        "DEMO",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "laura@tfg.local · password123",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
        }
    }
}
