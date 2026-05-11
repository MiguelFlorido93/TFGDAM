package com.stockly.cli.commands;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

/** Parser mínimo de argumentos --flag valor o --flag=valor. Flags booleanos: --flag. */
public final class Args {

    private final Map<String, String> flags = new LinkedHashMap<>();
    private final java.util.List<String> positional = new java.util.ArrayList<>();

    public Args(String[] argv) {
        for (int i = 0; i < argv.length; i++) {
            String a = argv[i];
            if (a.startsWith("--")) {
                String name, value;
                int eq = a.indexOf('=');
                if (eq > 0) {
                    name = a.substring(2, eq);
                    value = a.substring(eq + 1);
                } else {
                    name = a.substring(2);
                    if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
                        value = argv[++i];
                    } else {
                        value = "true";
                    }
                }
                flags.put(name, value);
            } else {
                positional.add(a);
            }
        }
    }

    public String get(String name)                    { return flags.get(name); }
    public String get(String name, String def)        { return flags.getOrDefault(name, def); }
    public int    getInt(String name, int def)        { return flags.containsKey(name) ? Integer.parseInt(flags.get(name)) : def; }
    public boolean has(String name)                   { return flags.containsKey(name); }
    public boolean flag(String name)                  { return "true".equals(flags.get(name)); }
    public String positional(int i)                   { return i < positional.size() ? positional.get(i) : null; }
    public java.util.List<String> positionals()       { return positional; }
}
