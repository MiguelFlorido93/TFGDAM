-- =============================================================
-- TFG - Gestión de reservas de almacén
-- Esquema MariaDB + semilla de 500 productos
-- =============================================================

DROP DATABASE IF EXISTS almacen_tfg;
CREATE DATABASE almacen_tfg CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE almacen_tfg;

-- -------------------------------------------------------------
-- Usuarios (operarios y clientes que realizan reservas)
-- -------------------------------------------------------------
CREATE TABLE usuarios (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    rol             ENUM('admin','operario','cliente') NOT NULL DEFAULT 'cliente',
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- Categorías
-- -------------------------------------------------------------
CREATE TABLE categorias (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(80) NOT NULL UNIQUE
);

-- -------------------------------------------------------------
-- Productos
-- -------------------------------------------------------------
CREATE TABLE productos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    sku             VARCHAR(20) NOT NULL UNIQUE,
    nombre          VARCHAR(150) NOT NULL,
    descripcion     TEXT,
    categoria_id    INT,
    ubicacion       VARCHAR(20) NOT NULL,   -- ej. A-12-3 (pasillo-estante-balda)
    stock           INT NOT NULL DEFAULT 0,
    stock_reservado INT NOT NULL DEFAULT 0,
    precio          DECIMAL(10,2) NOT NULL DEFAULT 0,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    INDEX idx_nombre (nombre),
    INDEX idx_categoria (categoria_id)
);

-- -------------------------------------------------------------
-- Reservas
-- -------------------------------------------------------------
CREATE TABLE reservas (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id      INT NOT NULL,
    producto_id     INT NOT NULL,
    cantidad        INT NOT NULL CHECK (cantidad > 0),
    estado          ENUM('pendiente','confirmada','cancelada','entregada')
                    NOT NULL DEFAULT 'pendiente',
    fecha_reserva   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_recogida  DATE,
    notas           VARCHAR(255),
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    INDEX idx_estado (estado),
    INDEX idx_usuario (usuario_id)
);

-- =============================================================
-- Datos semilla
-- =============================================================

INSERT INTO categorias (nombre) VALUES
    ('Electrónica'),('Herramientas'),('Ferretería'),('Jardín'),
    ('Fontanería'),('Electricidad'),('Oficina'),('Embalaje'),
    ('Limpieza'),('Seguridad');

INSERT INTO usuarios (nombre, email, rol) VALUES
    ('Admin TFG',      'admin@tfg.local',    'admin'),
    ('Laura Operaria', 'laura@tfg.local',    'operario'),
    ('Marcos Cliente', 'marcos@tfg.local',   'cliente'),
    ('Ana Cliente',    'ana@tfg.local',      'cliente');

-- -------------------------------------------------------------
-- Procedimiento para generar 500 productos de prueba
-- -------------------------------------------------------------
DELIMITER $$

DROP PROCEDURE IF EXISTS seed_productos $$
CREATE PROCEDURE seed_productos()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE v_cat INT;
    DECLARE v_nombre VARCHAR(150);
    DECLARE v_sku VARCHAR(20);
    DECLARE v_ubic VARCHAR(20);
    DECLARE v_stock INT;
    DECLARE v_precio DECIMAL(10,2);

    WHILE i <= 500 DO
        SET v_cat = ((i - 1) MOD 10) + 1;
        SET v_sku = CONCAT('SKU-', LPAD(i, 5, '0'));

        SET v_nombre = CASE v_cat
            WHEN 1  THEN CONCAT('Adaptador electrónico modelo ',  i)
            WHEN 2  THEN CONCAT('Taladro percutor serie ',        i)
            WHEN 3  THEN CONCAT('Caja de tornillos tipo ',        i)
            WHEN 4  THEN CONCAT('Manguera de jardín 25m ref ',    i)
            WHEN 5  THEN CONCAT('Tubería PVC 2m ref ',            i)
            WHEN 6  THEN CONCAT('Cable eléctrico 100m ref ',      i)
            WHEN 7  THEN CONCAT('Paquete folios A4 ref ',         i)
            WHEN 8  THEN CONCAT('Caja cartón mediana ref ',       i)
            WHEN 9  THEN CONCAT('Detergente industrial 5L ref ',  i)
            ELSE         CONCAT('Casco de seguridad ref ',        i)
        END;

        SET v_ubic  = CONCAT(
            CHAR(65 + ((i - 1) MOD 8)),           -- pasillo A-H
            '-', LPAD(((i - 1) MOD 20) + 1, 2, '0'),
            '-', ((i - 1) MOD 5) + 1
        );
        SET v_stock  = 10 + (i MOD 90);
        SET v_precio = ROUND(5 + (i MOD 200) + (i MOD 100)/100, 2);

        INSERT INTO productos
            (sku, nombre, descripcion, categoria_id, ubicacion, stock, precio)
        VALUES
            (v_sku, v_nombre,
             CONCAT('Producto de prueba #', i, ' generado automáticamente.'),
             v_cat, v_ubic, v_stock, v_precio);

        SET i = i + 1;
    END WHILE;
END $$

DELIMITER ;

CALL seed_productos();
DROP PROCEDURE seed_productos;

-- Algunas reservas de ejemplo
INSERT INTO reservas (usuario_id, producto_id, cantidad, estado, fecha_recogida, notas) VALUES
    (3,  5, 2, 'pendiente',   CURDATE() + INTERVAL 2 DAY, 'Recoger por la tarde'),
    (3, 42, 1, 'confirmada',  CURDATE() + INTERVAL 1 DAY, NULL),
    (4, 88, 5, 'pendiente',   CURDATE() + INTERVAL 3 DAY, 'Urgente');

SELECT CONCAT('Semilla completada: ', COUNT(*), ' productos') AS resultado FROM productos;
