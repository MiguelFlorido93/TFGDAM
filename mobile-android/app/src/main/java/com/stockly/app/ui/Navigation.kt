package com.stockly.app.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.stockly.app.data.ReservasRepository
import com.stockly.app.data.TokenStore
import com.stockly.app.ui.detalle.DetalleReservaScreen
import com.stockly.app.ui.incidencia.IncidenciaFormScreen
import com.stockly.app.ui.lista.ListaReservasScreen
import com.stockly.app.ui.login.LoginScreen

object Routes {
    const val LOGIN = "login"
    const val LISTA = "lista"
    const val DETALLE = "detalle/{id}"
    const val INCIDENCIA = "incidencia/{id}"
    fun detalle(id: Int) = "detalle/$id"
    fun incidencia(id: Int) = "incidencia/$id"
}

@Composable
fun Navigation(repo: ReservasRepository, tokenStore: TokenStore) {
    val nav = rememberNavController()
    val start = if (tokenStore.isLoggedIn) Routes.LISTA else Routes.LOGIN

    NavHost(navController = nav, startDestination = start) {
        composable(Routes.LOGIN) {
            LoginScreen(repo = repo, onLogged = {
                nav.navigate(Routes.LISTA) {
                    popUpTo(Routes.LOGIN) { inclusive = true }
                }
            })
        }
        composable(Routes.LISTA) {
            ListaReservasScreen(
                repo = repo,
                tokenStore = tokenStore,
                onAbrirDetalle = { id -> nav.navigate(Routes.detalle(id)) },
                onLogout = {
                    nav.navigate(Routes.LOGIN) {
                        popUpTo(Routes.LISTA) { inclusive = true }
                    }
                },
            )
        }
        composable(
            Routes.DETALLE,
            arguments = listOf(navArgument("id") { type = NavType.IntType }),
        ) { entry ->
            val id = entry.arguments?.getInt("id") ?: return@composable
            DetalleReservaScreen(
                id = id,
                repo = repo,
                onBack = { nav.popBackStack() },
                onAbrirIncidencia = { nav.navigate(Routes.incidencia(id)) },
            )
        }
        composable(
            Routes.INCIDENCIA,
            arguments = listOf(navArgument("id") { type = NavType.IntType }),
        ) { entry ->
            val id = entry.arguments?.getInt("id") ?: return@composable
            IncidenciaFormScreen(
                reservaId = id,
                repo = repo,
                onBack = { nav.popBackStack() },
            )
        }
    }
}
