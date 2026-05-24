package com.stockly.app.data

import com.stockly.app.BuildConfig
import com.stockly.app.model.CrearIncidenciaRequest
import com.stockly.app.model.EstadoRequest
import com.stockly.app.model.Incidencia
import com.stockly.app.model.LoginRequest
import com.stockly.app.model.LoginResponse
import com.stockly.app.model.OkResponse
import com.stockly.app.model.ReservaDetalle
import com.stockly.app.model.ReservaListItem
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface StocklyApi {

    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    /**
     * Lista de reservas. Como operario, sin filtro de usuario_id muestra todas.
     * Acepta ?activas=1 (pendiente+confirmada) o ?estado=pendiente,confirmada.
     */
    @GET("api/reservas")
    suspend fun reservas(
        @Query("estado") estado: String? = null,
        @Query("activas") activas: Int? = null,
    ): List<ReservaListItem>

    @GET("api/reservas/{id}")
    suspend fun reserva(@Path("id") id: Int): ReservaDetalle

    @PATCH("api/reservas/{id}/estado")
    suspend fun cambiarEstado(
        @Path("id") id: Int,
        @Body body: EstadoRequest,
    ): OkResponse

    @POST("api/reservas/{id}/incidencias")
    suspend fun crearIncidencia(
        @Path("id") id: Int,
        @Body body: CrearIncidenciaRequest,
    ): Incidencia
}

object ApiClient {
    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    fun build(tokenStore: TokenStore): StocklyApi {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
            else HttpLoggingInterceptor.Level.NONE
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(tokenStore))
            .addInterceptor(logging)
            .build()

        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(StocklyApi::class.java)
    }
}
