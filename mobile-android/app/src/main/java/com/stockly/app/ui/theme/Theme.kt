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

// Paleta Stockly — acero + ocre quemado, esquinas rectas
private val Ocre        = Color(0xFF8A4D0A)
private val OcreDark    = Color(0xFF6B3504)
private val OcreLight   = Color(0xFFA8601A)
private val AceroOscuro = Color(0xFF1C1F26)
private val AceroMedio  = Color(0xFF3B414C)
private val Fondo       = Color(0xFFF4F5F7)
private val Superficie  = Color(0xFFFFFFFF)
private val TextoOsc    = Color(0xFF15181D)
private val Peligro     = Color(0xFFC0392B)

private val LightColors = lightColorScheme(
    primary = Ocre,
    onPrimary = Color.White,
    primaryContainer = OcreLight,
    onPrimaryContainer = Color.White,
    secondary = AceroOscuro,
    onSecondary = Color.White,
    background = Fondo,
    onBackground = TextoOsc,
    surface = Superficie,
    onSurface = TextoOsc,
    error = Peligro,
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = OcreLight,
    onPrimary = Color.White,
    primaryContainer = OcreDark,
    onPrimaryContainer = Color.White,
    secondary = AceroMedio,
    onSecondary = Color.White,
    background = Color(0xFF0D0F13),
    onBackground = Color(0xFFECECEE),
    surface = Color(0xFF15181F),
    onSurface = Color(0xFFECECEE),
    error = Color(0xFFEF6B5A),
    onError = Color.White,
)

private val StocklyShapes = Shapes(
    extraSmall = RoundedCornerShape(2.dp),
    small      = RoundedCornerShape(2.dp),
    medium     = RoundedCornerShape(3.dp),
    large      = RoundedCornerShape(4.dp),
    extraLarge = RoundedCornerShape(4.dp),
)

private val StocklyTypography = Typography(
    titleLarge  = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 20.sp),
    titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    bodyLarge   = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 16.sp),
    bodyMedium  = TextStyle(fontFamily = FontFamily.SansSerif, fontSize = 14.sp),
    labelLarge  = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, letterSpacing = 0.5.sp),
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
