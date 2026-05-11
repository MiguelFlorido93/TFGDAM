package com.stockly.cli.commands;

import com.fasterxml.jackson.databind.JsonNode;
import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import com.opencsv.exceptions.CsvValidationException;
import com.stockly.cli.api.ApiException;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/**
 * Importa productos masivamente desde un CSV.
 *
 * CSV esperado (cabecera obligatoria, separador coma):
 *   sku,nombre,descripcion,categoria,ubicacion,stock,stock_minimo,precio
 *
 * Reglas:
 *   - 'categoria' es el NOMBRE de la categoría (no el id). Se resuelve a id
 *     consultando /api/categorias. Si no existe, la fila se marca como error.
 *   - 'sku' vacío → se solicita uno sugerido al servidor (/api/productos/sku-sugerido).
 *   - Numéricos vacíos → 0.
 *   - Por defecto modo dry-run (preview). Con --apply realmente envía POSTs.
 */
public class ImportCommand implements Command {

    @Override public String name()        { return "import"; }
    @Override public String description() { return "Importa productos desde un CSV (dry-run por defecto)"; }

    @Override
    public int run(String[] argv) throws Exception {
        Args a = new Args(argv);
        if (a.flag("help") || a.positional(0) == null) {
            System.out.println("Uso: stockly import <fichero.csv> [--apply]");
            System.out.println();
            System.out.println("Cabecera esperada (separador coma):");
            System.out.println("  sku,nombre,descripcion,categoria,ubicacion,stock,stock_minimo,precio");
            System.out.println();
            System.out.println("Por defecto sólo muestra preview. Añade --apply para enviar realmente.");
            return a.has("help") ? 0 : 2;
        }

        Path file = Path.of(a.positional(0));
        if (!Files.exists(file)) { System.err.println("No existe: " + file); return 1; }

        Config cfg = new Config();
        if (!cfg.hasToken()) { System.err.println("Necesitas hacer 'stockly login' primero."); return 2; }

        StocklyClient api = new StocklyClient(cfg);

        // 1) Cargar mapa categoría → id
        Map<String, Integer> catByName = new HashMap<>();
        JsonNode cats = api.categorias();
        for (JsonNode c : cats) catByName.put(c.path("nombre").asText().toLowerCase(), c.path("id").asInt());

        // 2) Leer CSV
        List<Row> rows = new ArrayList<>();
        try (Reader r = Files.newBufferedReader(file, StandardCharsets.UTF_8);
             CSVReader csv = new CSVReaderBuilder(r).build()) {
            String[] header = csv.readNext();
            if (header == null) { System.err.println("CSV vacío."); return 1; }
            Map<String,Integer> col = indexHeader(header);
            String[] line;
            int n = 1;
            while ((line = csv.readNext()) != null) {
                n++;
                rows.add(parseRow(line, col, n, catByName));
            }
        } catch (CsvValidationException e) {
            System.err.println("CSV inválido: " + e.getMessage());
            return 1;
        }

        // 3) Mostrar preview
        long valid   = rows.stream().filter(x -> x.error == null).count();
        long invalid = rows.size() - valid;
        System.out.printf("Filas leídas: %d  (válidas: %d, con error: %d)%n", rows.size(), valid, invalid);

        rows.stream().filter(x -> x.error != null).limit(20).forEach(x ->
            System.out.printf("  línea %d ✗ %s%n", x.lineNumber, x.error));
        if (invalid > 20) System.out.printf("  ... y %d más%n", invalid - 20);

        if (!a.flag("apply")) {
            System.out.println();
            System.out.println("(dry-run) Añade --apply para enviar las filas válidas al servidor.");
            return invalid == 0 ? 0 : 4;
        }

        // 4) Aplicar — POST por fila válida
        int ok = 0, fail = 0;
        for (Row x : rows) {
            if (x.error != null) { fail++; continue; }
            try {
                if (x.body.get("sku") == null || x.body.get("sku").toString().isBlank()) {
                    x.body.put("sku", api.skuSugerido().path("sku").asText());
                }
                api.crearProducto(x.body);
                ok++;
            } catch (ApiException e) {
                System.err.printf("✗ línea %d: %s%n", x.lineNumber, e.getMessage());
                fail++;
            }
        }
        System.out.printf("%n→ %d creados · %d fallidos%n", ok, fail);
        return fail == 0 ? 0 : 5;
    }

    // ---------- helpers ----------

    private static Map<String,Integer> indexHeader(String[] header) {
        Map<String,Integer> idx = new HashMap<>();
        for (int i = 0; i < header.length; i++) idx.put(header[i].trim().toLowerCase(), i);
        for (String req : List.of("nombre", "ubicacion")) {
            if (!idx.containsKey(req)) throw new RuntimeException("Cabecera requiere columna '" + req + "'");
        }
        return idx;
    }

    private static Row parseRow(String[] line, Map<String,Integer> col, int n, Map<String,Integer> cats) {
        Row r = new Row();
        r.lineNumber = n;
        try {
            String nombre    = cell(line, col, "nombre");
            String ubicacion = cell(line, col, "ubicacion");
            if (nombre.isBlank())    { r.error = "'nombre' vacío"; return r; }
            if (ubicacion.isBlank()) { r.error = "'ubicacion' vacía"; return r; }

            Map<String,Object> body = new LinkedHashMap<>();
            body.put("sku",          cell(line, col, "sku"));
            body.put("nombre",       nombre);
            body.put("descripcion",  cell(line, col, "descripcion"));
            body.put("ubicacion",    ubicacion.toUpperCase());
            body.put("stock",        toInt(cell(line, col, "stock"), 0));
            body.put("stock_minimo", toInt(cell(line, col, "stock_minimo"), 5));
            body.put("precio",       toDouble(cell(line, col, "precio"), 0));

            String catName = cell(line, col, "categoria");
            if (!catName.isBlank()) {
                Integer id = cats.get(catName.toLowerCase());
                if (id == null) { r.error = "categoría desconocida: '" + catName + "'"; return r; }
                body.put("categoria_id", id);
            }
            r.body = body;
        } catch (Exception e) {
            r.error = e.getMessage();
        }
        return r;
    }

    private static String cell(String[] line, Map<String,Integer> col, String name) {
        Integer i = col.get(name);
        if (i == null || i >= line.length || line[i] == null) return "";
        return line[i].trim();
    }
    private static int    toInt(String s, int def)    { try { return s.isBlank() ? def : Integer.parseInt(s); }   catch (NumberFormatException e) { return def; } }
    private static double toDouble(String s, double d){ try { return s.isBlank() ? d : Double.parseDouble(s.replace(',', '.')); } catch (NumberFormatException e) { return d; } }

    private static class Row {
        int lineNumber;
        Map<String,Object> body;
        String error;
    }
}
