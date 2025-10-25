-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS ie_john_f_kennedy;
USE ie_john_f_kennedy;

-- Tabla de usuarios (para login)
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_usuario VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    tipo_usuario ENUM('estudiante', 'profesor', 'administrador') NOT NULL,
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso TIMESTAMP NULL,
    INDEX idx_codigo (codigo_usuario),
    INDEX idx_tipo (tipo_usuario)
);

-- Tabla de estudiantes
CREATE TABLE estudiantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE,
    genero ENUM('M', 'F', 'Otro'),
    direccion TEXT,
    telefono VARCHAR(15),
    nombre_contacto_emergencia VARCHAR(100),
    telefono_contacto_emergencia VARCHAR(15),
    foto_url VARCHAR(255),
    fecha_inscripcion DATE,
    estado ENUM('activo', 'graduado', 'retirado', 'suspendido') DEFAULT 'activo',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_nombre_apellido (nombres, apellidos)
);

-- Tabla de profesores
CREATE TABLE profesores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    especialidad VARCHAR(100),
    titulo_academico VARCHAR(100),
    fecha_contratacion DATE,
    telefono VARCHAR(15),
    email_institucional VARCHAR(100),
    foto_url VARCHAR(255),
    estado ENUM('activo', 'inactivo', 'licencia') DEFAULT 'activo',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_nombre_apellido (nombres, apellidos)
);

-- Tabla de grados/cursos
CREATE TABLE grados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    nivel ENUM('primaria', 'secundaria') NOT NULL,
    orden INT,
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    UNIQUE KEY unique_nombre_nivel (nombre, nivel)
);

-- Tabla de secciones
CREATE TABLE secciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grado_id INT NOT NULL,
    nombre VARCHAR(10) NOT NULL, -- Ej: 'A', 'B', 'C'
    capacidad_maxima INT,
    tutor_id INT, -- Profesor tutor de la sección
    ano_escolar YEAR,
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    FOREIGN KEY (grado_id) REFERENCES grados(id),
    FOREIGN KEY (tutor_id) REFERENCES profesores(id),
    UNIQUE KEY unique_grado_seccion_ano (grado_id, nombre, ano_escolar)
);

-- Tabla de materias/asignaturas
CREATE TABLE materias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(20) UNIQUE,
    descripcion TEXT,
    area VARCHAR(50),
    creditos INT,
    estado ENUM('activa', 'inactiva') DEFAULT 'activa',
    INDEX idx_nombre (nombre)
);

-- Tabla de asignación de estudiantes a secciones
CREATE TABLE estudiante_secciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id INT NOT NULL,
    seccion_id INT NOT NULL,
    ano_escolar YEAR NOT NULL,
    fecha_asignacion DATE,
    estado ENUM('activo', 'retirado') DEFAULT 'activo',
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
    FOREIGN KEY (seccion_id) REFERENCES secciones(id),
    UNIQUE KEY unique_estudiante_seccion_ano (estudiante_id, seccion_id, ano_escolar),
    INDEX idx_ano_escolar (ano_escolar)
);

-- Tabla de asignación de profesores a materias en secciones
CREATE TABLE profesor_materia_seccion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profesor_id INT NOT NULL,
    materia_id INT NOT NULL,
    seccion_id INT NOT NULL,
    ano_escolar YEAR NOT NULL,
    horario TEXT, -- JSON con información del horario
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    FOREIGN KEY (profesor_id) REFERENCES profesores(id),
    FOREIGN KEY (materia_id) REFERENCES materias(id),
    FOREIGN KEY (seccion_id) REFERENCES secciones(id),
    UNIQUE KEY unique_profesor_materia_seccion_ano (profesor_id, materia_id, seccion_id, ano_escolar)
);

-- Tabla de períodos académicos
CREATE TABLE periodos_academicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL, -- Ej: 'Primer Período', 'Segundo Período'
    ano_escolar YEAR NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    orden INT,
    estado ENUM('activo', 'cerrado') DEFAULT 'activo',
    UNIQUE KEY unique_nombre_ano (nombre, ano_escolar),
    INDEX idx_ano_escolar (ano_escolar)
);

-- Tabla de tipos de evaluación
CREATE TABLE tipos_evaluacion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL, -- Ej: 'Examen', 'Trabajo', 'Participación'
    descripcion TEXT,
    peso DECIMAL(5,2) DEFAULT 0.00, -- Porcentaje que representa en la nota final
    estado ENUM('activo', 'inactivo') DEFAULT 'activo'
);

-- Tabla de calificaciones
CREATE TABLE calificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id INT NOT NULL,
    materia_id INT NOT NULL,
    periodo_id INT NOT NULL,
    tipo_evaluacion_id INT NOT NULL,
    profesor_id INT NOT NULL,
    calificacion DECIMAL(4,2) NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
    FOREIGN KEY (materia_id) REFERENCES materias(id),
    FOREIGN KEY (periodo_id) REFERENCES periodos_academicos(id),
    FOREIGN KEY (tipo_evaluacion_id) REFERENCES tipos_evaluacion(id),
    FOREIGN KEY (profesor_id) REFERENCES profesores(id),
    UNIQUE KEY unique_calificacion (estudiante_id, materia_id, periodo_id, tipo_evaluacion_id),
    INDEX idx_periodo (periodo_id),
    INDEX idx_estudiante_materia (estudiante_id, materia_id)
);

-- Tabla de asistencia
CREATE TABLE asistencia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    estudiante_id INT NOT NULL,
    seccion_id INT NOT NULL,
    fecha DATE NOT NULL,
    estado ENUM('presente', 'ausente', 'justificado', 'tardanza') DEFAULT 'presente',
    observaciones TEXT,
    profesor_registro_id INT NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (estudiante_id) REFERENCES estudiantes(id),
    FOREIGN KEY (seccion_id) REFERENCES secciones(id),
    FOREIGN KEY (profesor_registro_id) REFERENCES profesores(id),
    UNIQUE KEY unique_asistencia (estudiante_id, seccion_id, fecha),
    INDEX idx_fecha (fecha)
);

-- Tabla de comunicados
CREATE TABLE comunicados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    tipo ENUM('general', 'estudiantes', 'profesores', 'seccion') DEFAULT 'general',
    destinatario_seccion_id INT NULL,
    autor_id INT NOT NULL, -- ID del profesor o administrador
    fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion DATE,
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    FOREIGN KEY (destinatario_seccion_id) REFERENCES secciones(id),
    FOREIGN KEY (autor_id) REFERENCES usuarios(id),
    INDEX idx_fecha_publicacion (fecha_publicacion),
    INDEX idx_tipo (tipo)
);

-- Tabla de planificación académica
CREATE TABLE planificacion_academica (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profesor_id INT NOT NULL,
    materia_id INT NOT NULL,
    seccion_id INT NOT NULL,
    periodo_id INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_planificada DATE,
    tipo_actividad ENUM('clase', 'tarea', 'examen', 'proyecto') DEFAULT 'clase',
    estado ENUM('pendiente', 'completada', 'cancelada') DEFAULT 'pendiente',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profesor_id) REFERENCES profesores(id),
    FOREIGN KEY (materia_id) REFERENCES materias(id),
    FOREIGN KEY (seccion_id) REFERENCES secciones(id),
    FOREIGN KEY (periodo_id) REFERENCES periodos_academicos(id),
    INDEX idx_fecha_planificada (fecha_planificada)
);

-- Insertar datos iniciales

-- Insertar grados
INSERT INTO grados (nombre, nivel, orden) VALUES
('1° Grado', 'primaria', 1),
('2° Grado', 'primaria', 2),
('3° Grado', 'primaria', 3),
('4° Grado', 'primaria', 4),
('5° Grado', 'primaria', 5),
('6° Grado', 'primaria', 6),
('1° Secundaria', 'secundaria', 7),
('2° Secundaria', 'secundaria', 8),
('3° Secundaria', 'secundaria', 9),
('4° Secundaria', 'secundaria', 10),
('5° Secundaria', 'secundaria', 11);

-- Insertar secciones para el año actual
INSERT INTO secciones (grado_id, nombre, capacidad_maxima, ano_escolar) VALUES
(7, 'A', 30, YEAR(CURDATE())),
(7, 'B', 30, YEAR(CURDATE())),
(8, 'A', 30, YEAR(CURDATE())),
(8, 'B', 30, YEAR(CURDATE())),
(9, 'A', 30, YEAR(CURDATE())),
(9, 'B', 30, YEAR(CURDATE())),
(10, 'A', 30, YEAR(CURDATE())),
(10, 'B', 30, YEAR(CURDATE())),
(11, 'A', 30, YEAR(CURDATE())),
(11, 'B', 30, YEAR(CURDATE()));

-- Insertar materias
INSERT INTO materias (nombre, codigo, area, creditos) VALUES
('Matemáticas', 'MAT-001', 'Ciencias', 4),
('Lenguaje y Comunicación', 'LEN-001', 'Humanidades', 4),
('Ciencias Naturales', 'CIE-001', 'Ciencias', 4),
('Historia y Geografía', 'HIS-001', 'Humanidades', 3),
('Inglés', 'ING-001', 'Idiomas', 3),
('Educación Física', 'EFI-001', 'Educación Física', 2),
('Arte y Cultura', 'ART-001', 'Artes', 2),
('Tecnología e Informática', 'TEC-001', 'Tecnología', 3);

-- Insertar períodos académicos
INSERT INTO periodos_academicos (nombre, ano_escolar, orden) VALUES
('Primer Período', YEAR(CURDATE()), 1),
('Segundo Período', YEAR(CURDATE()), 2),
('Tercer Período', YEAR(CURDATE()), 3),
('Cuarto Período', YEAR(CURDATE()), 4);

-- Insertar tipos de evaluación
INSERT INTO tipos_evaluacion (nombre, descripcion, peso) VALUES
('Examen Parcial', 'Evaluación parcial del período', 30.00),
('Examen Final', 'Evaluación final del período', 40.00),
('Trabajos Prácticos', 'Trabajos y proyectos realizados', 20.00),
('Participación', 'Participación en clase y actividades', 10.00);

-- Crear usuario administrador (contraseña: admin123)
INSERT INTO usuarios (codigo_usuario, email, password_hash, tipo_usuario) 
VALUES ('admin', 'admin@jfk.edu', '$2a$10$8K1p/a0dRT.URTjL4rKzouY7U6VZB6XQJYk3t8B9ZzQd9SJN9pWW', 'administrador');

-- Insertar profesor de ejemplo (contraseña: profesor123)
INSERT INTO usuarios (codigo_usuario, email, password_hash, tipo_usuario) 
VALUES ('PROF-2025-001', 'profesor@jfk.edu', '$2a$10$8K1p/a0dRT.URTjL4rKzouY7U6VZB6XQJYk3t8B9ZzQd9SJN9pWW', 'profesor');

INSERT INTO profesores (usuario_id, nombres, apellidos, especialidad, titulo_academico, fecha_contratacion, email_institucional) 
VALUES (2, 'María', 'Rodríguez', 'Matemáticas', 'Lic. en Matemáticas', CURDATE(), 'm.rodriguez@jfk.edu');

-- Insertar estudiante de ejemplo (contraseña: estudiante123)
INSERT INTO usuarios (codigo_usuario, email, password_hash, tipo_usuario) 
VALUES ('EST-2025-001', 'estudiante@jfk.edu', '$2a$10$8K1p/a0dRT.URTjL4rKzouY7U6VZB6XQJYk3t8B9ZzQd9SJN9pWW', 'estudiante');

INSERT INTO estudiantes (usuario_id, nombres, apellidos, fecha_nacimiento, genero, telefono, fecha_inscripcion) 
VALUES (3, 'Juan', 'Pérez García', '2008-05-15', 'M', '+51 987 654 321', CURDATE());

-- Asignar estudiante a una sección
INSERT INTO estudiante_secciones (estudiante_id, seccion_id, ano_escolar, fecha_asignacion) 
VALUES (1, 1, YEAR(CURDATE()), CURDATE());

-- Asignar profesor a materias
INSERT INTO profesor_materia_seccion (profesor_id, materia_id, seccion_id, ano_escolar, horario) 
VALUES (1, 1, 1, YEAR(CURDATE()), '{"dias": ["Lunes", "Miércoles"], "hora": "08:00-09:30"}');

-- Insertar algunas calificaciones de ejemplo
INSERT INTO calificaciones (estudiante_id, materia_id, periodo_id, tipo_evaluacion_id, profesor_id, calificacion) 
VALUES 
(1, 1, 1, 1, 1, 16.5),
(1, 1, 1, 2, 1, 17.0),
(1, 1, 1, 3, 1, 18.0),
(1, 2, 1, 1, 1, 15.5),
(1, 2, 1, 2, 1, 16.0);

-- Mensaje de éxito
SELECT '✅ Base de datos creada exitosamente!' as mensaje;
SELECT '👤 Usuario administrador: admin / admin123' as credenciales;
SELECT '👨‍🏫 Usuario profesor: PROF-2025-001 / profesor123' as credenciales;
SELECT '👨‍🎓 Usuario estudiante: EST-2025-001 / estudiante123' as credenciales;
