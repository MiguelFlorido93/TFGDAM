package com.stockly.cli;

import com.stockly.cli.commands.*;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Dispatcher principal. Lee el primer argumento como subcomando y delega.
 *
 * Ejemplos:
 *   java -jar stockly.jar login --email a@b.com --password xxx
 *   java -jar stockly.jar productos --search taladro
 *   java -jar stockly.jar stock-bajo
 *   java -jar stockly.jar reservar --sku SKU-00001 --cantidad 2
 *   java -jar stockly.jar import productos.csv
 */
public final class Main {

    private static final Map<String, Command> COMMANDS = new LinkedHashMap<>();
    static {
        register(new LoginCommand());
        register(new ProductsCommand());
        register(new LowStockCommand());
        register(new ReserveCommand());
        register(new ImportCommand());
        register(new ConfigCommand());
        register(new GuiCommand());
    }
    private static void register(Command c) { COMMANDS.put(c.name(), c); }

    public static void main(String[] args) {
        if (args.length == 0 || args[0].equals("--help") || args[0].equals("-h")) {
            printHelp();
            System.exit(args.length == 0 ? 1 : 0);
        }

        Command cmd = COMMANDS.get(args[0]);
        if (cmd == null) {
            System.err.println("Comando desconocido: " + args[0]);
            System.err.println();
            printHelp();
            System.exit(2);
        }

        String[] rest = Arrays.copyOfRange(args, 1, args.length);
        try {
            int code = cmd.run(rest);
            System.exit(code);
        } catch (Exception e) {
            System.err.println("✗ " + e.getMessage());
            if (System.getenv("STOCKLY_DEBUG") != null) e.printStackTrace();
            System.exit(1);
        }
    }

    private static void printHelp() {
        System.out.println("Stockly CLI v1.0.0");
        System.out.println();
        System.out.println("Uso: java -jar stockly.jar <comando> [opciones]");
        System.out.println();
        System.out.println("Comandos disponibles:");
        for (Command c : COMMANDS.values()) {
            System.out.printf("  %-14s %s%n", c.name(), c.description());
        }
        System.out.println();
        System.out.println("Variable de entorno:");
        System.out.println("  STOCKLY_DEBUG=1   Imprime stacktrace completo en errores");
        System.out.println();
        System.out.println("La URL base y el token se guardan en ~/.stockly/config.properties");
    }

    private Main() {}
}
