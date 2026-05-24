package com.stockly.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.stockly.app.ui.Navigation
import com.stockly.app.ui.theme.StocklyTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val app = application as StocklyApp
        setContent {
            StocklyTheme {
                Navigation(
                    repo = app.repo,
                    tokenStore = app.tokenStore,
                )
            }
        }
    }
}
