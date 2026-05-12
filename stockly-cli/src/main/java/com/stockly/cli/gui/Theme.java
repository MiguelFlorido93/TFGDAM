package com.stockly.cli.gui;

import com.formdev.flatlaf.FlatDarkLaf;
import com.formdev.flatlaf.intellijthemes.FlatGruvboxDarkHardIJTheme;

import javax.swing.*;
import java.awt.*;

/** Configuración global del Look & Feel y constantes de color/typography. */
public final class Theme {

    // Paleta industrial (alineada con la web)
    public static final Color ACERO       = new Color(0x1c1f26);
    public static final Color ACERO_2     = new Color(0x2a2f3a);
    public static final Color AMBAR       = new Color(0x8a4d0a);
    public static final Color AMBAR_HOVER = new Color(0xa8601a);
    public static final Color OK          = new Color(0x15803d);
    public static final Color WARN        = new Color(0xa8601a);
    public static final Color DANGER      = new Color(0xb91c1c);
    public static final Color TEXTO       = new Color(0xececee);
    public static final Color TEXTO_MUTED = new Color(0x8a8f9a);

    public static void install() {
        // Look & Feel oscuro estilo Gruvbox (cálido, encaja con paleta industrial)
        try {
            UIManager.setLookAndFeel(new FlatGruvboxDarkHardIJTheme());
        } catch (Exception e) {
            try { UIManager.setLookAndFeel(new FlatDarkLaf()); } catch (Exception ignored) {}
        }

        // Overrides puntuales para usar nuestra marca ámbar
        UIManager.put("Button.default.background",        AMBAR);
        UIManager.put("Button.default.hoverBackground",   AMBAR_HOVER);
        UIManager.put("Button.default.focusedBackground", AMBAR_HOVER);
        UIManager.put("Component.focusColor",             AMBAR_HOVER);
        UIManager.put("Component.focusedBorderColor",     AMBAR);
        UIManager.put("Component.arc",                    8);
        UIManager.put("Button.arc",                       6);
        UIManager.put("TextComponent.arc",                6);
        UIManager.put("ProgressBar.arc",                  6);
        UIManager.put("Table.rowHeight",                  28);
        UIManager.put("Table.alternateRowColor",          new Color(0x2a2f3a));
        UIManager.put("TableHeader.background",           ACERO_2);
        UIManager.put("TitledBorder.titleColor",          AMBAR_HOVER);
    }

    public static Font titulo()    { return new Font("SansSerif", Font.BOLD, 18); }
    public static Font subtitulo() { return new Font("SansSerif", Font.BOLD, 14); }
    public static Font mono()      { return new Font("Monospaced", Font.PLAIN, 12); }

    /** Banner ámbar industrial usado como cabecera de ventanas */
    public static JComponent banner(String texto, String subtexto) {
        JPanel p = new JPanel();
        p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        p.setBackground(AMBAR);
        p.setBorder(BorderFactory.createEmptyBorder(14, 18, 12, 18));
        JLabel l1 = new JLabel(texto);
        l1.setFont(new Font("SansSerif", Font.BOLD, 20));
        l1.setForeground(Color.WHITE);
        p.add(l1);
        if (subtexto != null) {
            JLabel l2 = new JLabel(subtexto);
            l2.setForeground(new Color(0xfff4e0));
            l2.setFont(new Font("SansSerif", Font.PLAIN, 12));
            p.add(Box.createVerticalStrut(2));
            p.add(l2);
        }
        return p;
    }

    private Theme() {}
}
