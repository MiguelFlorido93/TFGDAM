package com.stockly.cli.commands;

import com.stockly.cli.gui.LoginFrame;
import com.stockly.cli.gui.Theme;
import com.stockly.cli.config.Config;

import javax.swing.*;

public class GuiCommand implements Command {

    @Override public String name()        { return "gui"; }
    @Override public String description() { return "Abre el cliente gráfico (Swing + FlatLaf)"; }

    @Override
    public int run(String[] args) {
        Theme.install();
        SwingUtilities.invokeLater(() -> {
            Config cfg = new Config();
            if (cfg.hasToken()) {
                new com.stockly.cli.gui.MainFrame(cfg).setVisible(true);
            } else {
                new LoginFrame(cfg).setVisible(true);
            }
        });
        // Bloqueamos el hilo principal hasta que se cierre la última ventana.
        // Como no devolvemos código antes, el JVM sigue vivo gracias al EDT.
        try { Thread.currentThread().join(); } catch (InterruptedException ignored) {}
        return 0;
    }
}
