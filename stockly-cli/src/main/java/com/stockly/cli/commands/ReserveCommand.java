package com.stockly.cli.commands;

import com.fasterxml.jackson.databind.JsonNode;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

public class ReserveCommand implements Command {

    @Override public String name()        { return "reservar"; }
    @Override public String description() { return "Crea una reserva: --sku SKU --cantidad N [--notas '...']"; }

    @Override
    public int run(String[] argv) {
        Args a = new Args(argv);
        if (a.flag("help") || !a.has("sku") || !a.has("cantidad")) {
            System.out.println("Uso: stockly reservar --sku SKU-00001 --cantidad 3 [--notas 'urgente']");
            return a.has("help") ? 0 : 2;
        }

        Config cfg = new Config();
        if (!cfg.hasToken()) { System.err.println("Necesitas hacer 'stockly login' primero."); return 2; }

        StocklyClient api = new StocklyClient(cfg);
        String sku = a.get("sku");
        int cantidad = Integer.parseInt(a.get("cantidad"));

        // Buscar el producto por SKU
        JsonNode busqueda = api.productos(sku, 1, 5);
        JsonNode match = null;
        for (JsonNode p : busqueda.path("data")) {
            if (sku.equalsIgnoreCase(p.path("sku").asText())) { match = p; break; }
        }
        if (match == null) { System.err.println("No encontré ningún producto con SKU '" + sku + "'"); return 1; }

        int id = match.path("id").asInt();
        JsonNode r = api.crearReserva(id, cantidad, a.get("notas"));
        System.out.printf("✓ Reserva #%d creada — %s × %d (%s)%n",
                r.path("id").asInt(),
                match.path("sku").asText(),
                cantidad,
                match.path("nombre").asText());
        return 0;
    }
}
