package com.stockly.app.network

import com.stockly.app.model.LoginRequest
import com.stockly.app.model.LoginResponse
import com.stockly.app.model.Reserva
import com.stockly.app.model.EstadoRequest
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import kotlinx.serialization.json.Json
import retrofit2.converter.kotlinx.serialization.asConverterFactory

interface StocklyApi {
    @POST("/api/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @GET("/api/reservas")
    suspend fun misReservas(): List<Reserva>

    @PATCH("/api/reservas/{id}/estado")
    suspend fun cambiarEstado(
        @Path("id") id: Int,
        @Body body: EstadoRequest
    ): Reserva
}

object StocklyApiFactory {
    fun build(baseUrl: String, tokenStore: TokenStore): StocklyApi {
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStore))
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(
                Json.asConverterFactory("application/json".toMediaType())
            )
            .build()
            .create(StocklyApi::class.java)
    }
}
