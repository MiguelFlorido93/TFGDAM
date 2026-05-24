package com.stockly.app.data

import okhttp3.Interceptor
import okhttp3.Response

/** Inyecta Authorization: Bearer <token> en cada petición que sale. */
class AuthInterceptor(private val tokenStore: TokenStore) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val token = tokenStore.token
        val req = if (token.isNullOrBlank()) original
        else original.newBuilder().addHeader("Authorization", "Bearer $token").build()
        return chain.proceed(req)
    }
}
