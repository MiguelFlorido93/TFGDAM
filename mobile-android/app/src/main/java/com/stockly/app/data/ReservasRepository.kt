package com.stockly.app.data

import com.stockly.app.model.CrearIncidenciaRequest
import com.stockly.app.model.EstadoRequest
import com.stockly.app.model.Incidencia
import com.stockly.app.model.LoginRequest
import com.stockly.app.model.LoginResponse
import com.stockly.app.model.ReservaDetalle
import com.stockly.app.model.ReservaListItem

class ReservasRepository(
    private val api: StocklyApi,
    private val tokenStore: TokenStore,
) {
    suspend fun login(email: String, password: String): LoginResponse {
        val resp = api.login(LoginRequest(email = email, password = password))
        tokenStore.token = resp.token
        tokenStore.usuario = resp.user
        return resp
    }

    fun logout() { tokenStore.clear() }

    /** Lista de reservas pendientes + confirmadas (lo que ve el operario). */
    suspend fun listarActivas(): List<ReservaListItem> =
        api.reservas(activas = 1)

    suspend fun listarPorEstado(estado: String): List<ReservaListItem> =
        api.reservas(estado = estado)

    suspend fun detalle(id: Int): ReservaDetalle = api.reserva(id)

    suspend fun confirmar(id: Int) =
        api.cambiarEstado(id, EstadoRequest(estado = "confirmada"))

    suspend fun entregar(id: Int) =
        api.cambiarEstado(id, EstadoRequest(estado = "entregada"))

    suspend fun reportarIncidencia(id: Int, tipo: String, descripcion: String): Incidencia =
        api.crearIncidencia(id, CrearIncidenciaRequest(tipo = tipo, descripcion = descripcion))
}
