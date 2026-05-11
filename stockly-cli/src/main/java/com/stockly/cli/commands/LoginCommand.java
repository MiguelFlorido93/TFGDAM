package com.stockly.cli.commands;

import com.fasterxml.jackson.databind.JsonNode;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

import java.io.BufferedReader;
import java.io.Console;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class LoginCommand implements Command {

    @Override public String name()        { return "login"; }
    @Override public String description() { return "Autentica contra la API y guarda el token"; }

    @Override
    public int run(String[] argv) throws Exception {
        Args a = new Args(argv);

        if (a.flag("help")) {
            System.out.println("Uso: stockly login [--url URL] --email EMAIL [--password PASS]");
            System.out.println("Si no pasas --password, lo pedirá por consola (sin eco).");
            return 0;
        }

        Config cfg = new Config();
        String url = a.get("url");
        if (url != null) {
            cfg.setUrl(url.replaceAll("/+$", ""));
        }

        String email = a.get("email");
        if (email == null) {
            email = prompt("Email: ");
        }
        String password = a.get("password");
        if (password == null) {
            password = readPassword("Contraseña: ");
        }
        if (email == null || password == null || email.isBlank() || password.isBlank()) {
            System.err.println("Email y contraseña son obligatorios.");
            return 2;
        }

        StocklyClient api = new StocklyClient(cfg);
        JsonNode r = api.login(email, password);
        String token = r.path("token").asText("");
        if (token.isBlank()) {
            System.err.println("Respuesta sin token: " + r);
            return 1;
        }
        cfg.setToken(token);
        cfg.save();

        JsonNode u = r.path("user");
        System.out.printf("✓ Conectado como %s (%s) — rol: %s%n",
                u.path("nombre").asText(), u.path("email").asText(), u.path("rol").asText());
        System.out.println("Token guardado en " + cfg.path());
        return 0;
    }

    private static String prompt(String msg) {
        System.out.print(msg);
        try { return new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8)).readLine(); }
        catch (Exception e) { return null; }
    }

    private static String readPassword(String msg) {
        Console c = System.console();
        if (c != null) {
            char[] p = c.readPassword(msg);
            return p == null ? null : new String(p);
        }
        // Fallback (IDE): muestra el texto
        return prompt(msg);
    }
}
