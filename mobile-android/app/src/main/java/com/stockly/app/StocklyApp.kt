package com.stockly.app

import android.app.Application
import com.stockly.app.data.ApiClient
import com.stockly.app.data.ReservasRepository
import com.stockly.app.data.TokenStore

/** Application class: contenedor manual de dependencias (sin Hilt). */
class StocklyApp : Application() {
    lateinit var tokenStore: TokenStore
        private set
    lateinit var repo: ReservasRepository
        private set

    override fun onCreate() {
        super.onCreate()
        tokenStore = TokenStore(this)
        val api = ApiClient.build(tokenStore)
        repo = ReservasRepository(api, tokenStore)
    }
}
