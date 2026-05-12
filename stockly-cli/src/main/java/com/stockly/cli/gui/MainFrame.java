package com.stockly.cli.gui;

import com.fasterxml.jackson.databind.JsonNode;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

import javax.swing.*;
import java.awt.*;

public class MainFrame extends JFrame {

    private final Config cfg;
    private String rol = "cliente";
    private String nombre = "";
    private final JLabel lblUsuario = new JLabel();

    public MainFrame(Config cfg) {
        super("Stockly · Cliente Java");
        this.cfg = cfg;
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        setSize(1100, 700);
        setLocationRelativeTo(null);

        // Resuelve el usuario en /api/auth/me para saber el rol
        resolverUsuario();

        construir();
    }

    private void resolverUsuario() {
        try {
            JsonNode r = new StocklyClient(cfg).me();
            // /me devuelve { user: {...} } o el payload directo del JWT
            JsonNode u = r.has("user") ? r.path("user") : r;
            this.rol = u.path("rol").asText("cliente");
            this.nombre = u.path("nombre").asText("");
        } catch (Exception e) {
            // Token caducado → vuelta al login
            cfg.clearToken(); cfg.save();
            JOptionPane.showMessageDialog(this,
                "Tu sesión ha expirado. Vuelve a iniciar.",
                "Sesión", JOptionPane.WARNING_MESSAGE);
            SwingUtilities.invokeLater(() -> {
                dispose();
                new LoginFrame(cfg).setVisible(true);
            });
        }
    }

    private void construir() {
        boolean staff = rol.equals("admin") || rol.equals("operario");

        JPanel root = new JPanel(new BorderLayout());
        root.add(cabecera(), BorderLayout.NORTH);

        JTabbedPane tabs = new JTabbedPane();
        tabs.addTab("🛒  Productos",  new ProductsPanel(cfg, false));
        tabs.addTab("📋  Reservas",   new ReservationsPanel(cfg, staff));
        if (staff) {
            tabs.addTab("⚠  Stock bajo", new ProductsPanel(cfg, true));
        }
        root.add(tabs, BorderLayout.CENTER);

        root.add(barraEstado(), BorderLayout.SOUTH);
        setContentPane(root);
    }

    private JComponent cabecera() {
        JPanel top = new JPanel(new BorderLayout());
        top.setBackground(Theme.AMBAR);
        top.setBorder(BorderFactory.createEmptyBorder(10, 16, 10, 12));

        JLabel marca = new JLabel("📦  STOCKLY  ·  CLIENTE JAVA");
        marca.setForeground(Color.WHITE);
        marca.setFont(new Font("SansSerif", Font.BOLD, 16));
        top.add(marca, BorderLayout.WEST);

        lblUsuario.setText(nombre + " · " + rol);
        lblUsuario.setForeground(new Color(0xfff4e0));
        lblUsuario.setFont(new Font("SansSerif", Font.PLAIN, 12));

        JButton btnLogout = new JButton("Cerrar sesión");
        btnLogout.addActionListener(e -> {
            cfg.clearToken();
            cfg.save();
            dispose();
            new LoginFrame(cfg).setVisible(true);
        });

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 12, 0));
        right.setOpaque(false);
        right.add(lblUsuario);
        right.add(btnLogout);
        top.add(right, BorderLayout.EAST);

        return top;
    }

    private JComponent barraEstado() {
        JPanel st = new JPanel(new BorderLayout());
        st.setBackground(Theme.ACERO);
        st.setBorder(BorderFactory.createEmptyBorder(4, 12, 4, 12));
        JLabel l = new JLabel("Conectado a " + cfg.url() + "  ·  Java " + System.getProperty("java.version"));
        l.setForeground(Theme.TEXTO_MUTED);
        l.setFont(new Font("SansSerif", Font.PLAIN, 11));
        st.add(l, BorderLayout.WEST);
        return st;
    }
}
