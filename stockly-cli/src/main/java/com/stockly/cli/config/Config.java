package com.stockly.cli.config;

import java.io.IOException;
import java.nio.file.*;
import java.util.Properties;

/**
 * Carga/guarda configuración persistente del CLI en ~/.stockly/config.properties.
 * Guarda: stockly.url (base API), stockly.token (JWT).
 */
public final class Config {

    private static final Path DIR  = Paths.get(System.getProperty("user.home"), ".stockly");
    private static final Path FILE = DIR.resolve("config.properties");

    private final Properties props = new Properties();

    public Config() {
        try {
            if (Files.exists(FILE)) {
                try (var in = Files.newBufferedReader(FILE)) {
                    props.load(in);
                }
            }
        } catch (IOException e) {
            System.err.println("⚠ No se pudo leer " + FILE + ": " + e.getMessage());
        }
    }

    public String url()    { return props.getProperty("stockly.url", "http://localhost:3001"); }
    public String token()  { return props.getProperty("stockly.token", ""); }
    public boolean hasToken() { return !token().isBlank(); }

    public void setUrl(String url)     { props.setProperty("stockly.url",   url); }
    public void setToken(String token) { props.setProperty("stockly.token", token); }
    public void clearToken()           { props.remove("stockly.token"); }

    public void save() {
        try {
            Files.createDirectories(DIR);
            try (var out = Files.newBufferedWriter(FILE)) {
                props.store(out, "Stockly CLI config");
            }
            // Permisos restrictivos en POSIX si se puede; en Windows no hace falta
            try {
                Files.setPosixFilePermissions(FILE,
                    java.util.EnumSet.of(
                        java.nio.file.attribute.PosixFilePermission.OWNER_READ,
                        java.nio.file.attribute.PosixFilePermission.OWNER_WRITE));
            } catch (UnsupportedOperationException ignored) {}
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar " + FILE + ": " + e.getMessage(), e);
        }
    }

    public Path path() { return FILE; }
}
