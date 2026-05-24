package com.stockly.app.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.stockly.app.model.Usuario
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Persiste el JWT y los datos del usuario logueado de forma cifrada
 * (EncryptedSharedPreferences sobre AES-256-GCM).
 */
class TokenStore(context: Context) {

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "stockly-auth",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val json = Json { ignoreUnknownKeys = true }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) { prefs.edit().apply {
            if (value == null) remove(KEY_TOKEN) else putString(KEY_TOKEN, value)
            apply()
        } }

    var usuario: Usuario?
        get() = prefs.getString(KEY_USER, null)?.let { runCatching { json.decodeFromString<Usuario>(it) }.getOrNull() }
        set(value) { prefs.edit().apply {
            if (value == null) remove(KEY_USER) else putString(KEY_USER, json.encodeToString(value))
            apply()
        } }

    fun clear() { prefs.edit().clear().apply() }

    val isLoggedIn: Boolean get() = !token.isNullOrBlank()

    companion object {
        private const val KEY_TOKEN = "jwt"
        private const val KEY_USER = "user"
    }
}
