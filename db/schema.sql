-- =============================================================
-- Stockly · Esquema MariaDB / MySQL + datos semilla
-- TFG DAM · Autores: Adrián Bravo Santos y Miguel Ángel Florido
-- =============================================================

-- Forzar UTF-8 en la conexión para que tildes/ñ se guarden bien
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

DROP DATABASE IF EXISTS stockly;
CREATE DATABASE stockly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stockly;

-- -------------------------------------------------------------
-- Usuarios
-- -------------------------------------------------------------
CREATE TABLE usuarios (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             ENUM('admin','operario','cliente') NOT NULL DEFAULT 'cliente',
    activo          TINYINT(1) NOT NULL DEFAULT 1,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rol (rol)
);

-- -------------------------------------------------------------
-- Categorías
-- -------------------------------------------------------------
CREATE TABLE categorias (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(80) NOT NULL UNIQUE,
    icono           VARCHAR(40) DEFAULT NULL,
    color           VARCHAR(20) DEFAULT NULL
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
    ubicacion       VARCHAR(20) NOT NULL,
    stock           INT NOT NULL DEFAULT 0,
    stock_reservado INT NOT NULL DEFAULT 0,
    stock_minimo    INT NOT NULL DEFAULT 5,
    precio          DECIMAL(10,2) NOT NULL DEFAULT 0,
    imagen_url      VARCHAR(255) DEFAULT NULL,
    activo          TINYINT(1) NOT NULL DEFAULT 1,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    INDEX idx_nombre (nombre),
    INDEX idx_categoria (categoria_id),
    INDEX idx_activo (activo)
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
    fecha_entrega   DATETIME DEFAULT NULL,
    notas           VARCHAR(255),
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    INDEX idx_estado (estado),
    INDEX idx_usuario (usuario_id),
    INDEX idx_fecha (fecha_reserva)
);

-- -------------------------------------------------------------
-- Movimientos de stock (auditoría)
-- -------------------------------------------------------------
CREATE TABLE movimientos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    producto_id     INT NOT NULL,
    usuario_id      INT,
    tipo            ENUM('entrada','salida','ajuste','reserva','liberacion') NOT NULL,
    cantidad        INT NOT NULL,
    stock_anterior  INT NOT NULL,
    stock_posterior INT NOT NULL,
    motivo          VARCHAR(255),
    fecha           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (usuario_id)  REFERENCES usuarios(id),
    INDEX idx_producto (producto_id),
    INDEX idx_fecha_mov (fecha)
);

-- =============================================================
-- Datos semilla
-- =============================================================
-- Hash bcrypt para password "password123" (cost=10)
SET @PWD := '$2b$10$wH8QpZ1xGQK3Yk0QpZ1xGuXk6YkQpZ1xGQK3Yk0QpZ1xGQK3Yk0Qp';

INSERT INTO categorias (nombre, icono, color) VALUES
    ('Electrónica',   'cpu',       '#3b82f6'),
    ('Herramientas',  'wrench',    '#f59e0b'),
    ('Ferretería',    'hammer',    '#6b7280'),
    ('Jardín',        'leaf',      '#10b981'),
    ('Fontanería',    'droplet',   '#0ea5e9'),
    ('Electricidad',  'zap',       '#eab308'),
    ('Oficina',       'file-text', '#8b5cf6'),
    ('Embalaje',      'package',   '#a16207'),
    ('Limpieza',      'spray',     '#06b6d4'),
    ('Seguridad',     'shield',    '#ef4444');

-- Usuarios iniciales (todos con password "password123" - cambiar en producción)
-- El backend recreará hashes válidos al arrancar si detecta el hash placeholder.
INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES
    ('Adrián Bravo Santos',     'adrian@tfg.local',  @PWD, 'admin'),
    ('Miguel Ángel Florido',    'miguel@tfg.local',  @PWD, 'admin'),
    ('Laura Operaria',   'laura@tfg.local',   @PWD, 'operario'),
    ('Marcos Cliente',   'marcos@tfg.local',  @PWD, 'cliente'),
    ('Ana Cliente',      'ana@tfg.local',     @PWD, 'cliente');

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
            CHAR(65 + ((i - 1) MOD 8)),
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

-- Reservas de ejemplo
INSERT INTO reservas (usuario_id, producto_id, cantidad, estado, fecha_recogida, notas) VALUES
    (4,  5, 2, 'pendiente',   CURDATE() + INTERVAL 2 DAY, 'Recoger por la tarde'),
    (4, 42, 1, 'confirmada',  CURDATE() + INTERVAL 1 DAY, NULL),
    (5, 88, 5, 'pendiente',   CURDATE() + INTERVAL 3 DAY, 'Urgente'),
    (5, 12, 3, 'entregada',   CURDATE() - INTERVAL 1 DAY, 'OK');

UPDATE productos SET stock_reservado = 2 WHERE id = 5;
UPDATE productos SET stock_reservado = 1 WHERE id = 42;
UPDATE productos SET stock_reservado = 5 WHERE id = 88;

SELECT CONCAT('Semilla completada: ', COUNT(*), ' productos') AS resultado FROM productos;
