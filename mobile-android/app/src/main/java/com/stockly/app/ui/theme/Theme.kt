package com.stockly.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ──────────────────────────────────────────────────────────
// Paleta Stockly — acero + ocre quemado · minimalismo industrial
// ──────────────────────────────────────────────────────────
val Ocre        = Color(0xFF8A4D0A)
val OcreDark    = Color(0xFF6B3504)
val OcreLight   = Color(0xFFA8601A)
val OcreSoft    = Color(0xFFF5E9D9)
val AceroOscuro = Color(0xFF1C1F26)
val AceroMedio  = Color(0xFF3B414C)
val AceroClaro  = Color(0xFF6B7280)
val Fondo       = Color(0xFFF6F4F0)        // crema muy claro
val Superficie  = Color(0xFFFFFFFF)
val SuperficieV = Color(0xFFEDE9E1)        // surface variant
val TextoOsc    = Color(0xFF15181D)
val TextoMed    = Color(0xFF4B4F58)
val Borde       = Color(0xFFE2DED5)
val Peligro     = Color(0xFFC0392B)
val Ok          = Color(0xFF15803D)
val Advert      = Color(0xFFB45309)
val Info        = Color(0xFF5B4FE0)

// Colores semánticos por estado de reserva
data class EstadoColors(val bg: Color, val fg: Color, val accent: Color)
val EstadoPendiente  = EstadoColors(Color(0xFFFEF3C7), Color(0xFF92400E), Color(0xFFB45309))
val EstadoConfirmada = EstadoColors(Color(0xFFE8E2FF), Color(0xFF3D348B), Color(0xFF5B4FE0))
val EstadoEntregada  = EstadoColors(Color(0xFFD1FAE5), Color(0xFF065F46), Color(0xFF15803D))
val EstadoCancelada  = EstadoColors(Color(0xFFFEE2E2), Color(0xFF991B1B), Color(0xFFDC2626))
val EstadoDesconocido = EstadoColors(Color(0xFFE5E7EB), Color(0xFF374151), Color(0xFF6B7280))

fun colorsParaEstado(estado: String): EstadoColors = when (estado) {
    "pendiente"  -> EstadoPendiente
    "confirmada" -> EstadoConfirmada
    "entregada"  -> EstadoEntregada
    "cancelada"  -> EstadoCancelada
    else         -> EstadoDesconocido
}

private val LightColors = lightColorScheme(
    primary = Ocre,
    onPrimary = Color.White,
    primaryContainer = OcreSoft,
    onPrimaryContainer = OcreDark,
    secondary = AceroOscuro,
    onSecondary = Color.White,
    secondaryContainer = AceroMedio,
    onSecondaryContainer = Color.White,
    tertiary = OcreLight,
    onTertiary = Color.White,
    background = Fondo,
    onBackground = TextoOsc,
    surface = Superficie,
    onSurface = TextoOsc,
    surfaceVariant = SuperficieV,
    onSurfaceVariant = TextoMed,
    outline = Borde,
    outlineVariant = Color(0xFFD5D0C5),
    error = Peligro,
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = OcreLight,
    onPrimary = Color.White,
    primaryContainer = OcreDark,
    onPrimaryContainer = Color(0xFFFFE4C7),
    secondary = AceroClaro,
    onSecondary = Color.White,
    tertiary = Ocre,
    onTertiary = Color.White,
    background = Color(0xFF0D0F13),
    onBackground = Color(0xFFECECEE),
    surface = Color(0xFF1A1D24),
    onSurface = Color(0xFFECECEE),
    surfaceVariant = Color(0xFF252830),
    onSurfaceVariant = Color(0xFFB8BCC4),
    outline = Color(0xFF3A3F49),
    error = Color(0xFFEF6B5A),
    onError = Color.White,
)

private val StocklyShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small      = RoundedCornerShape(6.dp),
    medium     = RoundedCornerShape(8.dp),
    large      = RoundedCornerShape(12.dp),
    extraLarge = RoundedCornerShape(16.dp),
)

private val StocklyTypography = Typography(
    displaySmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Black, fontSize = 32.sp, letterSpacing = 1.5.sp),
    headlineSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 22.sp),
    titleLarge  = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 20.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, letterSpacing = 0.15.sp),
    titleSmall  = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, letterSpacing = 0.1.sp),
    bodyLarge   = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium  = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall   = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge  = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, letterSpacing = 0.5.sp),
    labelMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.5.sp),
    labelSmall  = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 10.sp, letterSpacing = 1.2.sp),
)

@Composable
fun StocklyTheme(darkTheme: Boolean = false, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = StocklyTypography,
        shapes = StocklyShapes,
        content = content,
    )
}
