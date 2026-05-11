package com.stockly.cli.commands;

import com.fasterxml.jackson.databind.JsonNode;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

public class LowStockCommand implements Command {

    @Override public String name()        { return "stock-bajo"; }
    @Override public String description() { return "Muestra productos con stock por debajo del mínimo"; }

    @Override
    public int run(String[] argv) {
        Config cfg = new Config();
        if (!cfg.hasToken()) { System.err.println("Necesitas hacer 'stockly login' primero."); return 2; }

        StocklyClient api = new StocklyClient(cfg);
        JsonNode r = api.stockBajo();
        JsonNode data = r.path("data");

        if (!data.isArray() || data.size() == 0) {
            System.out.println("✓ Sin alertas: ningún producto bajo el mínimo.");
            return 0;
        }

        System.out.printf("⚠ %d producto(s) con stock bajo:%n%n", data.size());
        System.out.printf("%-10s  %-40s  %6s  %6s  %s%n", "SKU", "NOMBRE", "DISP", "MIN", "UBICACIÓN");
        System.out.println("─".repeat(80));
        for (JsonNode p : data) {
            int disp = p.path("stock").asInt() - p.path("stock_reservado").asInt();
            int min  = p.path("stock_minimo").asInt();
            String nombre = p.path("nombre").asText("");
            if (nombre.length() > 40) nombre = nombre.substring(0, 37) + "...";
            System.out.printf("%-10s  %-40s  %6d  %6d  %s%n",
                    p.path("sku").asText(), nombre, disp, min,
                    p.path("ubicacion").asText(""));
        }
        return data.size() > 0 ? 3 : 0;  // exit-code 3 = hay alertas (útil para cron/CI)
    }
}
