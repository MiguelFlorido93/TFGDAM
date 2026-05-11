package com.stockly.cli.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stockly.cli.config.Config;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Wrapper HTTP sobre el API REST de Stockly.
 * Usa HttpURLConnection (estable en Windows con cualquier AV/firewall) y
 * Jackson para JSON. Evita los problemas de loopback que tiene
 * java.net.http.HttpClient en algunos setups corporativos.
 */
public class StocklyClient {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final int CONN_TIMEOUT_MS = 10_000;
    private static final int READ_TIMEOUT_MS = 30_000;

    private final Config cfg;

    public StocklyClient(Config cfg) { this.cfg = cfg; }

    // ---------- Endpoints ----------

    public JsonNode login(String email, String password) {
        return request("POST", "/api/auth/login", Map.of("email", email, "password", password), false);
    }

    public JsonNode me() {
        return request("GET", "/api/auth/me", null, true);
    }

    public JsonNode productos(String search, int page, int limit) {
        StringBuilder q = new StringBuilder("?page=").append(page).append("&limit=").append(limit);
        if (search != null && !search.isBlank()) q.append("&search=").append(enc(search));
        return request("GET", "/api/productos" + q, null, true);
    }

    public JsonNode stockBajo() {
        return request("GET", "/api/productos?limit=200&stock_bajo=1", null, true);
    }

    public JsonNode categorias() {
        return request("GET", "/api/categorias", null, true);
    }

    public JsonNode crearReserva(int productoId, int cantidad, String notas) {
        Map<String, Object> body = new HashMap<>();
        body.put("producto_id", productoId);
        body.put("cantidad", cantidad);
        if (notas != null) body.put("notas", notas);
        return request("POST", "/api/reservas", body, true);
    }

    public JsonNode crearProducto(Map<String, Object> producto) {
        return request("POST", "/api/productos", producto, true);
    }

    public JsonNode skuSugerido() {
        return request("GET", "/api/productos/sku-sugerido", null, true);
    }

    // ---------- HTTP core ----------

    private JsonNode request(String method, String path, Object body, boolean auth) {
        HttpURLConnection con = null;
        try {
            URL url = new URL(cfg.url() + path);
            con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod(method);
            con.setConnectTimeout(CONN_TIMEOUT_MS);
            con.setReadTimeout(READ_TIMEOUT_MS);
            con.setRequestProperty("Accept", "application/json");
            if (auth && cfg.hasToken()) {
                con.setRequestProperty("Authorization", "Bearer " + cfg.token());
            }

            if (body != null) {
                con.setDoOutput(true);
                con.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] payload = JSON.writeValueAsBytes(body);
                con.setFixedLengthStreamingMode(payload.length);
                try (OutputStream os = con.getOutputStream()) { os.write(payload); }
            }

            int code = con.getResponseCode();
            InputStream is = (code >= 200 && code < 300) ? con.getInputStream() : con.getErrorStream();
            String text = readAll(is);
            JsonNode json = text == null || text.isBlank() ? JSON.nullNode() : JSON.readTree(text);

            if (code >= 200 && code < 300) return json;
            String err = json.path("error").asText("HTTP " + code);
            throw new ApiException(code, err);

        } catch (IOException e) {
            throw new ApiException("Error de red contactando " + cfg.url() + path + ": " + e.getMessage());
        } finally {
            if (con != null) con.disconnect();
        }
    }

    private static String readAll(InputStream is) throws IOException {
        if (is == null) return "";
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append('\n');
            return sb.toString();
        }
    }

    private static String enc(String s) {
        return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
