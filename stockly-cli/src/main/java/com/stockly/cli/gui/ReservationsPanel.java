package com.stockly.cli.gui;

import com.fasterxml.jackson.databind.JsonNode;
import com.stockly.cli.api.ApiException;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

import javax.swing.*;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.DefaultTableCellRenderer;
import java.awt.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ReservationsPanel extends JPanel {

    private final StocklyClient api;
    private final ReservasTableModel modelo = new ReservasTableModel();
    private final JTable tabla;
    private final boolean staff;

    public ReservationsPanel(Config cfg, boolean staff) {
        this.api = new StocklyClient(cfg);
        this.staff = staff;

        setLayout(new BorderLayout(8, 8));
        setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        JPanel top = new JPanel(new BorderLayout(8, 0));
        top.add(new JLabel(staff ? "Todas las reservas del sistema" : "Mis reservas"), BorderLayout.WEST);
        JButton refrescar = new JButton("↻ Refrescar");
        refrescar.addActionListener(e -> recargar());
        top.add(refrescar, BorderLayout.EAST);
        add(top, BorderLayout.NORTH);

        tabla = new JTable(modelo);
        tabla.setAutoCreateRowSorter(true);
        tabla.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        tabla.setRowHeight(28);
        tabla.setShowGrid(false);
        tabla.setFillsViewportHeight(true);

        // Colorea el estado
        DefaultTableCellRenderer estadoRender = new DefaultTableCellRenderer() {
            @Override
            public Component getTableCellRendererComponent(JTable t, Object v, boolean sel, boolean foc, int row, int col) {
                Component c = super.getTableCellRendererComponent(t, v, sel, foc, row, col);
                if (!sel && v != null) {
                    switch (v.toString()) {
                        case "pendiente"  -> c.setForeground(new Color(0xc79a16));
                        case "confirmada" -> c.setForeground(new Color(0x60a5fa));
                        case "entregada"  -> c.setForeground(new Color(0x34d399));
                        case "cancelada"  -> c.setForeground(new Color(0xf87171));
                        default           -> c.setForeground(Theme.TEXTO);
                    }
                }
                setHorizontalAlignment(SwingConstants.CENTER);
                return c;
            }
        };
        tabla.getColumnModel().getColumn(3).setCellRenderer(estadoRender);

        add(new JScrollPane(tabla), BorderLayout.CENTER);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 6));
        if (staff) {
            JButton confirmar = new JButton("✓ Confirmar");
            JButton entregar  = new JButton("📦 Entregar");
            entregar.putClientProperty("JButton.buttonType", "default");
            confirmar.addActionListener(e -> aplicar("confirmar"));
            entregar.addActionListener(e -> aplicar("entregar"));
            actions.add(confirmar);
            actions.add(entregar);
        }
        JButton cancelar = new JButton("✕ Cancelar");
        cancelar.addActionListener(e -> aplicar("cancelar"));
        actions.add(cancelar);
        add(actions, BorderLayout.SOUTH);

        recargar();
    }

    public void recargar() {
        new SwingWorker<List<Reserva>, Void>() {
            @Override protected List<Reserva> doInBackground() {
                JsonNode r = api.reservas();
                List<Reserva> out = new ArrayList<>();
                for (JsonNode x : r) out.add(Reserva.from(x));
                return out;
            }
            @Override protected void done() {
                try {
                    modelo.setRows(get());
                } catch (Exception ex) {
                    Throwable c = ex.getCause() != null ? ex.getCause() : ex;
                    JOptionPane.showMessageDialog(ReservationsPanel.this,
                        "Error: " + c.getMessage(), "Reservas", JOptionPane.ERROR_MESSAGE);
                }
            }
        }.execute();
    }

    private void aplicar(String accion) {
        int row = tabla.getSelectedRow();
        if (row < 0) {
            JOptionPane.showMessageDialog(this, "Selecciona una reserva primero.", "Acción", JOptionPane.WARNING_MESSAGE);
            return;
        }
        Reserva r = modelo.get(tabla.convertRowIndexToModel(row));
        int opt = JOptionPane.showConfirmDialog(this,
            String.format("¿%s la reserva #%d (%s × %d)?", capitalize(accion), r.id, r.sku, r.cantidad),
            "Confirmar acción", JOptionPane.YES_NO_OPTION);
        if (opt != JOptionPane.YES_OPTION) return;

        new SwingWorker<JsonNode, Void>() {
            @Override protected JsonNode doInBackground() {
                return api.bulkReservas(List.of(r.id), accion);
            }
            @Override protected void done() {
                try {
                    JsonNode resp = get();
                    int ok = resp.path("aplicadas").asInt();
                    int fail = resp.path("fallidas").asInt();
                    String msg = ok == 1 ? "Aplicado correctamente." :
                                 "No se pudo aplicar: " + resp.path("resultados").path(0).path("error").asText();
                    JOptionPane.showMessageDialog(ReservationsPanel.this, msg,
                        fail > 0 ? "Error" : "OK",
                        fail > 0 ? JOptionPane.WARNING_MESSAGE : JOptionPane.INFORMATION_MESSAGE);
                    recargar();
                } catch (Exception ex) {
                    Throwable c = ex.getCause() != null ? ex.getCause() : ex;
                    String msg = c instanceof ApiException ? c.getMessage() : c.toString();
                    JOptionPane.showMessageDialog(ReservationsPanel.this, msg, "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        }.execute();
    }

    private static String capitalize(String s) { return Character.toUpperCase(s.charAt(0)) + s.substring(1); }

    // ---------- Modelo ----------
    record Reserva(int id, String sku, String producto, int cantidad, String estado,
                   String usuario, String fechaReserva) {
        static Reserva from(JsonNode r) {
            return new Reserva(
                r.path("id").asInt(),
                r.path("sku").asText(""),
                r.path("producto").asText(""),
                r.path("cantidad").asInt(),
                r.path("estado").asText(""),
                r.path("usuario").asText(""),
                r.path("fecha_reserva").asText("").replace("T", " ").substring(0, Math.min(19, r.path("fecha_reserva").asText("").length()))
            );
        }
    }
    static class ReservasTableModel extends AbstractTableModel {
        private final String[] cols = { "#", "SKU", "Producto", "Estado", "Cantidad", "Usuario", "Fecha" };
        private List<Reserva> rows = new ArrayList<>();
        public void setRows(List<Reserva> rows) { this.rows = rows; fireTableDataChanged(); }
        public Reserva get(int i) { return rows.get(i); }
        @Override public int getRowCount()    { return rows.size(); }
        @Override public int getColumnCount() { return cols.length; }
        @Override public String getColumnName(int c) { return cols[c]; }
        @Override public Class<?> getColumnClass(int c) { return c == 0 || c == 4 ? Integer.class : String.class; }
        @Override public Object getValueAt(int r, int c) {
            Reserva x = rows.get(r);
            return switch (c) {
                case 0 -> x.id;
                case 1 -> x.sku;
                case 2 -> x.producto;
                case 3 -> x.estado;
                case 4 -> x.cantidad;
                case 5 -> x.usuario;
                case 6 -> x.fechaReserva;
                default -> "";
            };
        }
    }
}
