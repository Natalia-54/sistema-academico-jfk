const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Crear directorio de uploads si no existe
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'jfk-secret-key-2025-academico-system',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB límite
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos de imagen'), false);
        }
    }
});

// Configuración de la base de datos
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'Sebitasg2003',
    database: 'ie_john_f_kennedy'
};

// Conexión a la base de datos
async function getConnection() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado a la base de datos MySQL');
        return connection;
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error.message);
        throw error;
    }
}

// Middleware de autenticación
function requireAuth(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/');
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.tipo_usuario === 'administrador') {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
    }
}

// Rutas de autenticación
app.post('/api/login', async (req, res) => {
    const { username, password, userType } = req.body;
    
    try {
        const connection = await getConnection();
        
        // Buscar usuario según el tipo
        let query = '';
        let params = [];
        
        if (userType === 'student') {
            query = `SELECT u.*, e.id as estudiante_id, e.nombres, e.apellidos, e.foto_url 
                     FROM usuarios u 
                     JOIN estudiantes e ON u.id = e.usuario_id 
                     WHERE u.codigo_usuario = ? AND u.tipo_usuario = 'estudiante' AND u.estado = 'activo'`;
            params = [username];
        } else if (userType === 'teacher') {
            query = `SELECT u.*, p.id as profesor_id, p.nombres, p.apellidos, p.foto_url, p.especialidad 
                     FROM usuarios u 
                     JOIN profesores p ON u.id = p.usuario_id 
                     WHERE (u.codigo_usuario = ? OR u.email = ?) AND u.tipo_usuario = 'profesor' AND u.estado = 'activo'`;
            params = [username, username];
        } else {
            query = `SELECT u.* FROM usuarios u 
                     WHERE (u.codigo_usuario = ? OR u.email = ?) AND u.tipo_usuario = 'administrador' AND u.estado = 'activo'`;
            params = [username, username];
        }
        
        const [users] = await connection.execute(query, params);
        
        if (users.length === 0) {
            await connection.end();
            return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
        }
        
        const user = users[0];
        
        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            await connection.end();
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }
        
        // Actualizar último acceso
        await connection.execute(
            'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?',
            [user.id]
        );
        
        // Guardar en sesión
        req.session.user = {
            id: user.id,
            codigo: user.codigo_usuario,
            tipo: user.tipo_usuario,
            nombres: user.nombres || 'Administrador',
            apellidos: user.apellidos || '',
            email: user.email,
            foto_url: user.foto_url,
            especialidad: user.especialidad,
            estudiante_id: user.estudiante_id,
            profesor_id: user.profesor_id
        };
        
        await connection.end();
        
        // Determinar redirección
        let redirectUrl = '/';
        if (userType === 'student') {
            redirectUrl = '/notas-estudiante.html';
        } else if (userType === 'teacher') {
            redirectUrl = '/panel-profesor.html';
        } else {
            redirectUrl = '/admin.html';
        }
        
        res.json({ 
            success: true, 
            redirect: redirectUrl,
            user: req.session.user
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Error al cerrar sesión' });
        }
        res.json({ success: true });
    });
});

// Ruta para verificar autenticación
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'No autenticado' });
    }
});

// Rutas para estudiantes
app.get('/api/estudiantes', requireAuth, async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT e.*, u.codigo_usuario, u.email, u.estado as usuario_estado,
                   es.seccion_id, s.nombre as seccion_nombre, g.nombre as grado_nombre
            FROM estudiantes e
            JOIN usuarios u ON e.usuario_id = u.id
            LEFT JOIN estudiante_secciones es ON e.id = es.estudiante_id AND es.ano_escolar = YEAR(CURDATE()) AND es.estado = 'activo'
            LEFT JOIN secciones s ON es.seccion_id = s.id
            LEFT JOIN grados g ON s.grado_id = g.id
            ORDER BY e.apellidos, e.nombres
        `);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estudiantes' });
    }
});

app.post('/api/estudiantes', requireAdmin, upload.single('foto'), async (req, res) => {
    const {
        codigo_usuario, email, password, nombres, apellidos,
        fecha_nacimiento, genero, direccion, telefono,
        nombre_contacto_emergencia, telefono_contacto_emergencia,
        seccion_id
    } = req.body;

    try {
        const connection = await getConnection();
        await connection.beginTransaction();

        // Verificar si el código de usuario ya existe
        const [existingUsers] = await connection.execute(
            'SELECT id FROM usuarios WHERE codigo_usuario = ?',
            [codigo_usuario]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();
            await connection.end();
            return res.status(400).json({ error: 'El código de usuario ya existe' });
        }

        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario
        const [userResult] = await connection.execute(
            `INSERT INTO usuarios (codigo_usuario, email, password_hash, tipo_usuario) 
             VALUES (?, ?, ?, 'estudiante')`,
            [codigo_usuario, email, hashedPassword]
        );

        const usuarioId = userResult.insertId;

        // Crear estudiante
        const fotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const [studentResult] = await connection.execute(
            `INSERT INTO estudiantes 
             (usuario_id, nombres, apellidos, fecha_nacimiento, genero, direccion, telefono, 
              nombre_contacto_emergencia, telefono_contacto_emergencia, foto_url, fecha_inscripcion) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
            [usuarioId, nombres, apellidos, fecha_nacimiento, genero, direccion, telefono,
             nombre_contacto_emergencia, telefono_contacto_emergencia, fotoUrl]
        );

        // Asignar a sección si se proporcionó
        if (seccion_id && seccion_id !== '') {
            await connection.execute(
                `INSERT INTO estudiante_secciones (estudiante_id, seccion_id, ano_escolar, fecha_asignacion)
                 VALUES (?, ?, YEAR(CURDATE()), CURDATE())`,
                [studentResult.insertId, seccion_id]
            );
        }

        await connection.commit();
        await connection.end();

        res.json({ success: true, message: 'Estudiante creado exitosamente' });

    } catch (error) {
        console.error('Error al crear estudiante:', error);
        const connection = await getConnection();
        await connection.rollback();
        await connection.end();
        res.status(500).json({ error: 'Error al crear estudiante: ' + error.message });
    }
});

// Rutas para profesores
app.get('/api/profesores', requireAuth, async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT p.*, u.codigo_usuario, u.email, u.estado as usuario_estado
            FROM profesores p
            JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.apellidos, p.nombres
        `);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener profesores' });
    }
});

app.post('/api/profesores', requireAdmin, upload.single('foto'), async (req, res) => {
    const {
        codigo_usuario, email, password, nombres, apellidos,
        especialidad, titulo_academico, fecha_contratacion, telefono, email_institucional
    } = req.body;

    try {
        const connection = await getConnection();
        await connection.beginTransaction();

        // Verificar si el código de usuario ya existe
        const [existingUsers] = await connection.execute(
            'SELECT id FROM usuarios WHERE codigo_usuario = ?',
            [codigo_usuario]
        );

        if (existingUsers.length > 0) {
            await connection.rollback();
            await connection.end();
            return res.status(400).json({ error: 'El código de usuario ya existe' });
        }

        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario
        const [userResult] = await connection.execute(
            `INSERT INTO usuarios (codigo_usuario, email, password_hash, tipo_usuario) 
             VALUES (?, ?, ?, 'profesor')`,
            [codigo_usuario, email, hashedPassword]
        );

        const usuarioId = userResult.insertId;

        // Crear profesor
        const fotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
        await connection.execute(
            `INSERT INTO profesores 
             (usuario_id, nombres, apellidos, especialidad, titulo_academico, 
              fecha_contratacion, telefono, email_institucional, foto_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [usuarioId, nombres, apellidos, especialidad, titulo_academico,
             fecha_contratacion, telefono, email_institucional, fotoUrl]
        );

        await connection.commit();
        await connection.end();

        res.json({ success: true, message: 'Profesor creado exitosamente' });

    } catch (error) {
        console.error('Error al crear profesor:', error);
        const connection = await getConnection();
        await connection.rollback();
        await connection.end();
        res.status(500).json({ error: 'Error al crear profesor: ' + error.message });
    }
});

// Rutas para secciones y grados
app.get('/api/grados', async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute('SELECT * FROM grados WHERE estado = "activo" ORDER BY orden');
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener grados' });
    }
});

app.get('/api/secciones', async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT s.*, g.nombre as grado_nombre, p.nombres as tutor_nombres, p.apellidos as tutor_apellidos,
                   (SELECT COUNT(*) FROM estudiante_secciones es WHERE es.seccion_id = s.id AND es.estado = 'activo') as total_estudiantes
            FROM secciones s
            JOIN grados g ON s.grado_id = g.id
            LEFT JOIN profesores p ON s.tutor_id = p.id
            WHERE s.estado = 'activo' AND s.ano_escolar = YEAR(CURDATE())
            ORDER BY g.orden, s.nombre
        `);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener secciones' });
    }
});

// Ruta para obtener notas del estudiante
app.get('/api/mis-notas', requireAuth, async (req, res) => {
    if (req.session.user.tipo !== 'estudiante') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    try {
        const connection = await getConnection();
        const [rows] = await connection.execute(`
            SELECT m.nombre as materia, c.calificacion, p.nombre as periodo, 
                   te.nombre as tipo_evaluacion, te.peso,
                   pr.nombres as profesor_nombres, pr.apellidos as profesor_apellidos,
                   c.fecha_registro
            FROM calificaciones c
            JOIN materias m ON c.materia_id = m.id
            JOIN periodos_academicos p ON c.periodo_id = p.id
            JOIN tipos_evaluacion te ON c.tipo_evaluacion_id = te.id
            JOIN profesores pr ON c.profesor_id = pr.id
            WHERE c.estudiante_id = ?
            ORDER BY p.orden, m.nombre
        `, [req.session.user.estudiante_id]);
        
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener notas' });
    }
});

// Ruta para obtener estadísticas del admin
app.get('/api/estadisticas', requireAdmin, async (req, res) => {
    try {
        const connection = await getConnection();
        
        const [estudiantesCount] = await connection.execute(
            "SELECT COUNT(*) as total FROM estudiantes e JOIN usuarios u ON e.usuario_id = u.id WHERE u.estado = 'activo'"
        );
        
        const [profesoresCount] = await connection.execute(
            "SELECT COUNT(*) as total FROM profesores p JOIN usuarios u ON p.usuario_id = u.id WHERE u.estado = 'activo'"
        );
        
        const [seccionesCount] = await connection.execute(
            "SELECT COUNT(*) as total FROM secciones WHERE estado = 'activo' AND ano_escolar = YEAR(CURDATE())"
        );
        
        await connection.end();
        
        res.json({
            totalEstudiantes: estudiantesCount[0].total,
            totalProfesores: profesoresCount[0].total,
            totalSecciones: seccionesCount[0].total,
            anoEscolar: new Date().getFullYear()
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

// Servir archivos estáticos
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/panel-profesor.html', requireAuth, (req, res) => {
    if (req.session.user.tipo !== 'profesor') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'panel-profesor.html'));
});

app.get('/notas-estudiante.html', requireAuth, (req, res) => {
    if (req.session.user.tipo !== 'estudiante') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'notas-estudiante.html'));
});

app.get('/admin.html', requireAuth, (req, res) => {
    if (req.session.user.tipo !== 'administrador') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo salió mal en el servidor!' });
});

// Ruta 404
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📚 Sistema Académico IE John F. Kennedy`);
    console.log(`⭐ ¡Sistema listo para usar!`);
});
