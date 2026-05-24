package com.stockly.app.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// ===== Autenticación =====

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: Usuario,
)

@Serializable
data class Usuario(
    val id: Int,
    val nombre: String,
    val email: String,
    val rol: String? = null,
)

// ===== Reservas =====

@Serializable
data class ReservaListItem(
    val id: Int,
    val cantidad: Int,
    val estado: String,
    @SerialName("fecha_reserva") val fechaReserva: String? = null,
    @SerialName("fecha_recogida") val fechaRecogida: String? = null,
    @SerialName("fecha_entrega") val fechaEntrega: String? = null,
    val notas: String? = null,
    @SerialName("usuario_id") val usuarioId: Int? = null,
    val usuario: String? = null,
    @SerialName("usuario_email") val usuarioEmail: String? = null,
    @SerialName("producto_id") val productoId: Int? = null,
    val sku: String? = null,
    val producto: String? = null,
    val ubicacion: String? = null,
    val precio: Double? = null,
)

@Serializable
data class ReservaDetalle(
    val id: Int,
    val cantidad: Int,
    val estado: String,
    @SerialName("fecha_reserva") val fechaReserva: String? = null,
    @SerialName("fecha_recogida") val fechaRecogida: String? = null,
    @SerialName("fecha_entrega") val fechaEntrega: String? = null,
    val notas: String? = null,
    @SerialName("usuario_id") val usuarioId: Int,
    val usuario: String,
    @SerialName("usuario_email") val usuarioEmail: String? = null,
    @SerialName("producto_id") val productoId: Int,
    val sku: String,
    val producto: String,
    @SerialName("producto_descripcion") val productoDescripcion: String? = null,
    val ubicacion: String? = null,
    val precio: Double? = null,
    val unidad: String? = null,
    @SerialName("confirmada_por") val confirmadaPor: Usuario? = null,
    @SerialName("entregada_por") val entregadaPor: Usuario? = null,
    val incidencias: List<Incidencia> = emptyList(),
)

// ===== Incidencias =====

@Serializable
data class Incidencia(
    val id: Int,
    val tipo: String,
    val descripcion: String,
    @SerialName("creado_en") val creadoEn: String? = null,
    @SerialName("operario_id") val operarioId: Int? = null,
    val operario: String? = null,
    @SerialName("operario_email") val operarioEmail: String? = null,
)

@Serializable
data class CrearIncidenciaRequest(
    val tipo: String,
    val descripcion: String,
)

// ===== Cambio de estado =====

@Serializable
data class EstadoRequest(val estado: String)

@Serializable
data class OkResponse(val ok: Boolean? = null)
