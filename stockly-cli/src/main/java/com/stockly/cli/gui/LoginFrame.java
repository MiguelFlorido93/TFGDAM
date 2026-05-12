package com.stockly.cli.gui;

import com.fasterxml.jackson.databind.JsonNode;
import com.stockly.cli.api.ApiException;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;

public class LoginFrame extends JFrame {

    private final Config cfg;
    private final JTextField  txtUrl;
    private final JTextField  txtEmail;
    private final JPasswordField txtPass;
    private final JLabel      lblStatus;
    private final JButton     btnEntrar;

    public LoginFrame(Config cfg) {
        super("Stockly · Iniciar sesión");
        this.cfg = cfg;
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        setSize(440, 460);
        setLocationRelativeTo(null);
        setResizable(false);

        JPanel root = new JPanel(new BorderLayout());
        root.add(Theme.banner("📦  STOCKLY", "Gestión de almacén · Cliente Java"), BorderLayout.NORTH);

        JPanel form = new JPanel(new GridBagLayout());
        form.setBorder(BorderFactory.createEmptyBorder(24, 28, 16, 28));
        GridBagConstraints g = new GridBagConstraints();
        g.fill = GridBagConstraints.HORIZONTAL;
        g.insets = new Insets(6, 0, 6, 0);
        g.weightx = 1.0; g.gridx = 0;

        g.gridy = 0; form.add(label("URL del servidor"), g);
        txtUrl = new JTextField(cfg.url());
        g.gridy = 1; form.add(txtUrl, g);

        g.gridy = 2; form.add(label("Email"), g);
        txtEmail = new JTextField();
        g.gridy = 3; form.add(txtEmail, g);

        g.gridy = 4; form.add(label("Contraseña"), g);
        txtPass = new JPasswordField();
        g.gridy = 5; form.add(txtPass, g);

        lblStatus = new JLabel(" ");
        lblStatus.setForeground(Theme.DANGER);
        lblStatus.setFont(lblStatus.getFont().deriveFont(12f));
        g.gridy = 6; form.add(lblStatus, g);

        btnEntrar = new JButton("Iniciar sesión");
        btnEntrar.putClientProperty("JButton.buttonType", "default");
        btnEntrar.addActionListener(this::onLogin);
        g.gridy = 7; g.insets = new Insets(12, 0, 6, 0);
        form.add(btnEntrar, g);

        JLabel ayuda = new JLabel("<html><body style='color:#8a8f9a;font-size:11px;text-align:center'>"
            + "Demo: <b>adrian@tfg.local</b> / <b>password123</b></body></html>",
            SwingConstants.CENTER);
        g.gridy = 8; g.insets = new Insets(8, 0, 0, 0);
        form.add(ayuda, g);

        root.add(form, BorderLayout.CENTER);
        setContentPane(root);

        // Enter envía
        getRootPane().setDefaultButton(btnEntrar);
        // Esc cierra
        getRootPane().registerKeyboardAction(
            e -> dispose(),
            KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0),
            JComponent.WHEN_IN_FOCUSED_WINDOW);

        // Foco inicial en email
        SwingUtilities.invokeLater(txtEmail::requestFocus);
    }

    private JLabel label(String s) {
        JLabel l = new JLabel(s);
        l.setForeground(Theme.TEXTO_MUTED);
        l.setFont(l.getFont().deriveFont(11f));
        return l;
    }

    private void onLogin(ActionEvent ev) {
        final String url = txtUrl.getText().trim().replaceAll("/+$", "");
        final String email = txtEmail.getText().trim();
        final String pass = new String(txtPass.getPassword());
        if (email.isEmpty() || pass.isEmpty()) {
            lblStatus.setText("Email y contraseña obligatorios");
            return;
        }
        cfg.setUrl(url);
        btnEntrar.setEnabled(false);
        lblStatus.setForeground(Theme.TEXTO_MUTED);
        lblStatus.setText("Conectando…");

        // Hacer la petición fuera del EDT
        new SwingWorker<JsonNode, Void>() {
            @Override protected JsonNode doInBackground() {
                return new StocklyClient(cfg).login(email, pass);
            }
            @Override protected void done() {
                try {
                    JsonNode r = get();
                    cfg.setToken(r.path("token").asText());
                    cfg.save();
                    dispose();
                    new MainFrame(cfg).setVisible(true);
                } catch (Exception e) {
                    Throwable cause = e.getCause() != null ? e.getCause() : e;
                    lblStatus.setForeground(Theme.DANGER);
                    lblStatus.setText("✗ " + (cause instanceof ApiException ? cause.getMessage()
                                                                              : "Error: " + cause.getMessage()));
                    btnEntrar.setEnabled(true);
                }
            }
        }.execute();
    }
}
