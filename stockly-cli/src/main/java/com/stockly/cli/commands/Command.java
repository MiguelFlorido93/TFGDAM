package com.stockly.cli.commands;

/** Contrato para cada subcomando del CLI. */
public interface Command {
    /** Nombre tal y como se invoca: 'login', 'productos', etc. */
    String name();

    /** Descripción corta (una línea) para el --help. */
    String description();

    /** Ejecuta el comando con los argumentos pasados tras el nombre. Devuelve el exit code. */
    int run(String[] args) throws Exception;
}
