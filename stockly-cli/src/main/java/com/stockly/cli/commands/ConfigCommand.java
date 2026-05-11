package com.stockly.cli.commands;

import com.stockly.cli.config.Config;

public class ConfigCommand implements Command {

    @Override public String name()        { return "config"; }
    @Override public String description() { return "Muestra/edita la configuración (URL base, token actual)"; }

    @Override
    public int run(String[] argv) {
        Args a = new Args(argv);
        Config cfg = new Config();

        if (a.has("set-url")) { cfg.setUrl(a.get("set-url")); cfg.save(); System.out.println("URL guardada."); return 0; }
        if (a.flag("logout"))  { cfg.clearToken();           cfg.save(); System.out.println("Token borrado."); return 0; }

        System.out.println("Configuración actual:");
        System.out.println("  Archivo: " + cfg.path());
        System.out.println("  URL:     " + cfg.url());
        System.out.println("  Token:   " + (cfg.hasToken() ? "(presente, " + cfg.token().length() + " chars)" : "(vacío)"));
        System.out.println();
        System.out.println("Opciones: --set-url URL | --logout");
        return 0;
    }
}
