package com.stockly.cli.gui;

import com.fasterxml.jackson.databind.JsonNode;
import com.stockly.cli.api.ApiException;
import com.stockly.cli.api.StocklyClient;
import com.stockly.cli.config.Config;

import javax.swing.*;
import javax.swing.table.AbstractTableModel;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.TableCellRenderer;
import javax.swing.table.TableColumnModel;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.List;

public class ProductsPanel extends JPanel {

    private final StocklyClient api;
    private final ProductosTableModel modelo = new ProductosTableModel();
    private final JTextField txtBusqueda = new JTextField();
    private final JLabel lblTotal = new JLabel("");
    private final JTable tabla;
    private final boolean soloStockBajo;

    public ProductsPanel(Config cfg, boolean soloStockBajo) {
        this.api = new StocklyClient(cfg);
        this.soloStockBajo = soloStockBajo;

        setLayout(new BorderLayout(8, 8));
        setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        // -------- Filtros --------
        JPanel top = new JPanel(new BorderLayout(8, 0));
        top.add(new JLabel(soloStockBajo ? "⚠ Stock bajo" : "🔍 Buscar:"), BorderLayout.WEST);
        if (!soloStockBajo) {
            txtBusqueda.putClientProperty("JTextField.placeholderText", "Nombre o SKU…");
            txtBusqueda.addActionListener(this::buscar);
            top.add(txtBusqueda, BorderLayout.CENTER);
            JButton btnBuscar = new JButton("Buscar");
            btnBuscar.addActionListener(this::buscar);
            JButton btnRefrescar = new JButton("↻");
            btnRefrescar.setToolTipText("Refrescar");
            btnRefrescar.addActionListener(this::buscar);
            JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 4, 0));
            right.add(btnBuscar);
            right.add(btnRefrescar);
            top.add(right, BorderLayout.EAST);
        }
        add(top, BorderLayout.NORTH);

        // -------- Tabla --------
        tabla = new JTable(modelo);
        tabla.setAutoCreateRowSorter(true);
        tabla.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        tabla.setShowGrid(false);
        tabla.setFillsViewportHeight(true);
        tabla.setRowHeight(28);
        configurarColumnas(tabla.getColumnModel());

        // Colorea filas con stock bajo
        DefaultTableCellRenderer renderer = new DefaultTableCellRenderer() {
            @Override
            public Component getTableCellRendererComponent(JTable t, Object v, boolean sel, boolean foc, int row, int col) {
                Component c = super.getTableCellRendererComponent(t, v, sel, foc, row, col);
                int modelRow = t.convertRowIndexToModel(row);
                Producto p = modelo.get(modelRow);
                if (!sel) {
                    int disp = p.disponible();
                    if (disp <= 0)                  c.setBackground(new Color(0x442020));
                    else if (disp <= p.minimo)      c.setBackground(new Color(0x3a2f10));
                    else                            c.setBackground(row % 2 == 0 ? new Color(0x282c33) : new Color(0x2a2f3a));
                }
                if (col == 4 || col == 5 || col == 6) setHorizontalAlignment(SwingConstants.RIGHT);
                else setHorizontalAlignment(SwingConstants.LEFT);
                return c;
            }
        };
        for (int i = 0; i < tabla.getColumnCount(); i++) {
            tabla.getColumnModel().getColumn(i).setCellRenderer(renderer);
        }

        JScrollPane sp = new JScrollPane(tabla);
        sp.setBorder(BorderFactory.createLineBorder(Theme.ACERO_2));
        add(sp, BorderLayout.CENTER);

        // -------- Footer --------
        JPanel bottom = new JPanel(new BorderLayout(8, 0));
        lblTotal.setForeground(Theme.TEXTO_MUTED);
        bottom.add(lblTotal, BorderLayout.WEST);

        if (!soloStockBajo) {
            JButton btnReservar = new JButton("📋 Reservar fila seleccionada");
            btnReservar.putClientProperty("JButton.buttonType", "default");
            btnReservar.addActionListener(e -> reservar());
            bottom.add(btnReservar, BorderLayout.EAST);
        }
        add(bottom, BorderLayout.SOUTH);

        recargar();
    }

    private void configurarColumnas(TableColumnModel cm) {
        cm.getColumn(0).setPreferredWidth(95);   // SKU
        cm.getColumn(1).setPreferredWidth(280);  // Nombre
        cm.getColumn(2).setPreferredWidth(140);  // Categoría
        cm.getColumn(3).setPreferredWidth(80);   // Ubic.
        cm.getColumn(4).setPreferredWidth(60);   // Stock
        cm.getColumn(5).setPreferredWidth(60);   // Disp.
        cm.getColumn(6).setPreferredWidth(80);   // Precio
    }

    private void buscar(ActionEvent e) { recargar(); }

    public void recargar() {
        final String search = soloStockBajo ? "" : txtBusqueda.getText().trim();
        new SwingWorker<List<Producto>, Void>() {
            int total = 0;
            @Override protected List<Producto> doInBackground() {
                JsonNode r = soloStockBajo ? api.stockBajo() : api.productos(search, 1, 100);
                List<Producto> out = new ArrayList<>();
                total = r.path("total").asInt(r.path("data").size());
                for (JsonNode p : r.path("data")) out.add(Producto.from(p));
                return out;
            }
            @Override protected void done() {
                try {
                    modelo.setRows(get());
                    lblTotal.setText("Total: " + total + " producto(s)");
                } catch (Exception ex) {
                    Throwable c = ex.getCause() != null ? ex.getCause() : ex;
                    JOptionPane.showMessageDialog(ProductsPanel.this,
                        "Error cargando productos: " + c.getMessage(),
                        "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        }.execute();
    }

    private void reservar() {
        int row = tabla.getSelectedRow();
        if (row < 0) {
            JOptionPane.showMessageDialog(this, "Selecciona una fila primero.", "Reserva", JOptionPane.WARNING_MESSAGE);
            return;
        }
        Producto p = modelo.get(tabla.convertRowIndexToModel(row));
        int disp = p.disponible();
        if (disp <= 0) {
            JOptionPane.showMessageDialog(this, "Producto sin stock disponible.", "Reserva", JOptionPane.WARNING_MESSAGE);
            return;
        }
        String s = (String) JOptionPane.showInputDialog(this,
            String.format("Producto: %s\nDisponible: %d\n\nCantidad a reservar:", p.nombre, disp),
            "Reservar " + p.sku, JOptionPane.QUESTION_MESSAGE, null, null, "1");
        if (s == null) return;
        int cantidad;
        try { cantidad = Integer.parseInt(s.trim()); } catch (NumberFormatException ex) {
            JOptionPane.showMessageDialog(this, "Cantidad no válida.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }
        if (cantidad < 1 || cantidad > disp) {
            JOptionPane.showMessageDialog(this, "Cantidad fuera de rango.", "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }
        new SwingWorker<JsonNode, Void>() {
            @Override protected JsonNode doInBackground() {
                return api.crearReserva(p.id, cantidad, null);
            }
            @Override protected void done() {
                try {
                    JsonNode r = get();
                    JOptionPane.showMessageDialog(ProductsPanel.this,
                        "Reserva #" + r.path("id").asInt() + " creada.",
                        "OK", JOptionPane.INFORMATION_MESSAGE);
                    recargar();
                } catch (Exception ex) {
                    Throwable c = ex.getCause() != null ? ex.getCause() : ex;
                    String msg = c instanceof ApiException ? c.getMessage() : c.toString();
                    JOptionPane.showMessageDialog(ProductsPanel.this,
                        "No se pudo crear la reserva:\n" + msg,
                        "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        }.execute();
    }

    // ---------- Modelo de tabla ----------
    record Producto(int id, String sku, String nombre, String categoria,
                    String ubicacion, int stock, int reservado, int minimo, double precio) {
        public int disponible() { return stock - reservado; }
        static Producto from(JsonNode p) {
            return new Producto(
                p.path("id").asInt(),
                p.path("sku").asText(""),
                p.path("nombre").asText(""),
                p.path("categoria").asText(""),
                p.path("ubicacion").asText(""),
                p.path("stock").asInt(0),
                p.path("stock_reservado").asInt(0),
                p.path("stock_minimo").asInt(5),
                p.path("precio").asDouble(0)
            );
        }
    }

    static class ProductosTableModel extends AbstractTableModel {
        private final String[] cols = { "SKU", "Nombre", "Categoría", "Ubic.", "Stock", "Disp.", "Precio" };
        private List<Producto> rows = new ArrayList<>();

        public void setRows(List<Producto> rows) {
            this.rows = rows;
            fireTableDataChanged();
        }
        public Producto get(int i) { return rows.get(i); }
        @Override public int getRowCount()    { return rows.size(); }
        @Override public int getColumnCount() { return cols.length; }
        @Override public String getColumnName(int c) { return cols[c]; }
        @Override public Class<?> getColumnClass(int c) {
            return (c == 4 || c == 5) ? Integer.class : (c == 6 ? Double.class : String.class);
        }
        @Override public Object getValueAt(int r, int c) {
            Producto p = rows.get(r);
            return switch (c) {
                case 0 -> p.sku;
                case 1 -> p.nombre;
                case 2 -> p.categoria;
                case 3 -> p.ubicacion;
                case 4 -> p.stock;
                case 5 -> p.disponible();
                case 6 -> p.precio;
                default -> "";
            };
        }
    }
}
