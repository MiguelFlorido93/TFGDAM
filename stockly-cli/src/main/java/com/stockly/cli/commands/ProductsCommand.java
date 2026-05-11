package com.stockly.cli.commands;

import com.fasterxml.jackson.databind.JsonNode;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

public class ProductsCommand implements Command {

    @Override public String name()        { return "productos"; }
    @Override public String description() { return "Lista productos (paginados, opcionalmente filtrados)"; }

    @Override
    public int run(String[] argv) {
        Args a = new Args(argv);
        if (a.flag("help")) {
            System.out.println("Uso: stockly productos [--search TEXTO] [--page N] [--limit N]");
            return 0;
        }

        Config cfg = new Config();
        if (!cfg.hasToken()) { System.err.println("Necesitas hacer 'stockly login' primero."); return 2; }

        StocklyClient api = new StocklyClient(cfg);
        JsonNode r = api.productos(a.get("search"), a.getInt("page", 1), a.getInt("limit", 20));

        JsonNode data = r.path("data");
        int total = r.path("total").asInt(0);

        System.out.printf("%-10s  %-44s  %8s  %9s  %s%n", "SKU", "NOMBRE", "STOCK", "PRECIO", "UBICACIÓN");
        System.out.println("─".repeat(98));
        for (JsonNode p : data) {
            int disp = p.path("stock").asInt() - p.path("stock_reservado").asInt();
            String nombre = p.path("nombre").asText("");
            if (nombre.length() > 44) nombre = nombre.substring(0, 41) + "...";
            System.out.printf("%-10s  %-44s  %8d  %9.2f  %s%n",
                    p.path("sku").asText(),
                    nombre,
                    disp,
                    p.path("precio").asDouble(0),
                    p.path("ubicacion").asText(""));
        }
        System.out.printf("%nTotal: %d resultado(s) — página %d/%d%n",
                total, r.path("page").asInt(1), r.path("pages").asInt(1));
        return 0;
    }
}
