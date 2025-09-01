# Sistema de Citas Médicas

Sistema integral de gestión de citas médicas desarrollado con arquitectura de microservicios, implementando Node.js para el backend, interfaz web moderna con HTML/CSS/JavaScript, y documentación completa con Swagger.

## Características Principales

- **API REST**: Backend escalable desarrollado con Node.js y Express
- **Frontend Responsivo**: Interfaz de usuario moderna y accesible
- **Base de Datos**: Integración con MySQL para persistencia de datos
- **Autenticación Segura**: Implementación de JWT con encriptación bcrypt
- **Documentación Interactiva**: API documentada con Swagger UI
- **Seguridad Empresarial**: Implementación de Helmet, CORS y validación de datos
- **Sistema de Notificaciones**: Integración con Nodemailer

## Stack Tecnológico

### Backend
- Node.js (Runtime de JavaScript)
- Express.js 5.1.0 (Framework web)
- MySQL2 (Driver de base de datos)
- JWT (Autenticación y autorización)
- bcrypt/bcryptjs (Encriptación de contraseñas)
- Helmet (Seguridad de headers HTTP)
- CORS (Control de acceso entre orígenes)
- Morgan (Middleware de logging)
- Compression (Compresión de respuestas HTTP)
- Express Validator (Validación de datos de entrada)

### Frontend
- HTML5 (Estructura semántica)
- CSS3 (Estilos y responsive design)
- JavaScript ES6+ (Lógica del cliente)

### Documentación y APIs
- Swagger JSDoc (Generación de documentación)
- Swagger UI Express (Interfaz interactiva)

### Herramientas de Desarrollo
- Nodemon (Reinicio automático en desarrollo)

## Requisitos del Sistema

Asegúrese de tener instaladas las siguientes herramientas antes de proceder con la instalación:

- **Node.js**: Versión 16.x o superior
- **MySQL**: Versión 8.0 o superior (recomendado)
- **Git**: Para control de versiones
- **npm**: Gestor de paquetes de Node.js

## Guía de Instalación

### 1. Clonación del Repositorio

```bash
git clone https://github.com/AlenRamirez/Sistema-de-citas-.git
cd Sistema-de-citas-
```

### 2. Instalación de Dependencias

```bash
npm install
```

### 3. Configuración del Entorno

Cree un archivo `.env` en el directorio raíz del proyecto:

```env
# Configuración de Base de Datos
DB_HOST=localhost
DB_PORT=3306
DB_NAME=sistema_citas
DB_USER=root
DB_PASSWORD=tu_password_mysql

# Configuración JWT
JWT_SECRET=clave_secreta_jwt_de_al_menos_32_caracteres
JWT_EXPIRES_IN=24h

# Configuración del Servidor
PORT=3000
NODE_ENV=development

# Configuración SMTP (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_correo@ejemplo.com
EMAIL_PASS=tu_password_aplicacion
EMAIL_FROM=noreply@sistemacitas.com

# Configuración CORS
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 4. Configuración de Base de Datos

#### Creación de la Base de Datos

Ejecute los siguientes comandos SQL en su cliente MySQL:

```sql
-- Crear base de datos
CREATE DATABASE sistema_citas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sistema_citas;

-- Tabla de usuarios
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    fecha_nacimiento DATE,
    direccion TEXT,
    rol ENUM('paciente', 'medico', 'admin') DEFAULT 'paciente',
    activo BOOLEAN DEFAULT TRUE,
    email_verificado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_rol (rol)
);

-- Tabla de especialidades médicas
CREATE TABLE especialidades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de médicos
CREATE TABLE medicos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    especialidad_id INT NOT NULL,
    cedula_profesional VARCHAR(50) UNIQUE NOT NULL,
    consultorio VARCHAR(100),
    horario_inicio TIME DEFAULT '08:00:00',
    horario_fin TIME DEFAULT '17:00:00',
    dias_atencion JSON,
    tarifa_consulta DECIMAL(10,2),
    biografia TEXT,
    verificado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (especialidad_id) REFERENCES especialidades(id),
    INDEX idx_cedula (cedula_profesional)
);

-- Tabla de citas
CREATE TABLE citas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT NOT NULL,
    medico_id INT NOT NULL,
    fecha_cita DATETIME NOT NULL,
    duracion INT DEFAULT 30,
    estado ENUM('programada', 'confirmada', 'en_progreso', 'completada', 'cancelada', 'no_asistio') DEFAULT 'programada',
    motivo_consulta TEXT,
    notas_medico TEXT,
    costo DECIMAL(10,2),
    metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia'),
    codigo_confirmacion VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (medico_id) REFERENCES medicos(id) ON DELETE CASCADE,
    INDEX idx_fecha_cita (fecha_cita),
    INDEX idx_estado (estado),
    UNIQUE KEY unique_cita (medico_id, fecha_cita)
);

-- Tabla de historial médico
CREATE TABLE historial_medico (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT NOT NULL,
    cita_id INT,
    diagnostico TEXT,
    tratamiento TEXT,
    medicamentos JSON,
    examenes_solicitados JSON,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL
);

-- Insertar especialidades por defecto
INSERT INTO especialidades (nombre, descripcion) VALUES
('Medicina General', 'Atención médica integral para adultos'),
('Pediatría', 'Especialidad médica dedicada al cuidado de niños'),
('Cardiología', 'Especialidad médica que se ocupa del corazón'),
('Dermatología', 'Especialidad médica que se ocupa de la piel'),
('Ginecología', 'Especialidad médica que trata el sistema reproductivo femenino'),
('Traumatología', 'Especialidad médica que trata lesiones del sistema musculoesquelético'),
('Oftalmología', 'Especialidad médica que trata enfermedades de los ojos'),
('Neurología', 'Especialidad médica que trata trastornos del sistema nervioso');
```

## Comandos de Ejecución

### Modo Desarrollo

```bash
npm run dev
```

Inicia el servidor en modo desarrollo con reinicio automático mediante nodemon.

### Modo Producción

```bash
npm start
```

Ejecuta el servidor en modo producción optimizado.

## Acceso a la Aplicación

Una vez iniciado el servidor:

- **Aplicación Web**: `http://localhost:3000`
- **API REST**: `http://localhost:3000/api`
- **Documentación Swagger**: `http://localhost:3000/api-docs`

## Documentación de la API

### Endpoints de Autenticación

```
POST /api/auth/register       - Registro de nuevos usuarios
POST /api/auth/login          - Inicio de sesión
POST /api/auth/logout         - Cerrar sesión
GET  /api/auth/profile        - Obtener perfil del usuario autenticado
PUT  /api/auth/profile        - Actualizar perfil del usuario
POST /api/auth/forgot-password - Solicitar restablecimiento de contraseña
POST /api/auth/reset-password  - Restablecer contraseña
```

### Endpoints de Gestión de Citas

```
GET    /api/citas             - Listar citas (con filtros)
POST   /api/citas             - Crear nueva cita
GET    /api/citas/:id         - Obtener detalles de una cita
PUT    /api/citas/:id         - Actualizar información de cita
DELETE /api/citas/:id         - Cancelar cita
POST   /api/citas/:id/confirm - Confirmar cita
```

### Endpoints de Médicos y Especialidades

```
GET /api/medicos              - Listar médicos disponibles
GET /api/medicos/:id          - Obtener información detallada de un médico
GET /api/medicos/:id/horarios - Obtener horarios disponibles
GET /api/especialidades       - Listar especialidades médicas
```

### Endpoints Administrativos

```
GET /api/admin/usuarios       - Gestionar usuarios (solo admin)
GET /api/admin/reportes       - Generar reportes estadísticos
GET /api/admin/configuracion  - Configuración del sistema
```

## Autenticación y Seguridad

### Uso de JWT

La API utiliza JSON Web Tokens para autenticación. Incluya el token en las cabeceras de las peticiones:

```javascript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### Niveles de Acceso

- **Paciente**: Gestión de citas propias y perfil
- **Médico**: Gestión de citas asignadas, horarios y pacientes
- **Administrador**: Acceso completo al sistema

## Arquitectura del Proyecto

```
sistema-citas/
├── src/
│   ├── config/             # Configuraciones de la aplicación
│   │   ├── database.js     # Configuración de MySQL
│   │   ├── jwt.js          # Configuración JWT
│   │   └── email.js        # Configuración Nodemailer
│   ├── controllers/        # Lógica de negocio
│   │   ├── authController.js
│   │   ├── citasController.js
│   │   └── usuariosController.js
│   ├── middleware/         # Middlewares personalizados
│   │   ├── auth.js         # Verificación de autenticación
│   │   ├── validation.js   # Validación de datos
│   │   └── errorHandler.js # Manejo de errores
│   ├── models/            # Modelos de datos
│   │   ├── Usuario.js
│   │   ├── Cita.js
│   │   └── Medico.js
│   ├── routes/            # Definición de rutas
│   │   ├── auth.js
│   │   ├── citas.js
│   │   └── medicos.js
│   ├── services/          # Servicios externos
│   │   ├── emailService.js
│   │   └── reporteService.js
│   ├── utils/             # Utilidades auxiliares
│   │   ├── validators.js
│   │   ├── helpers.js
│   │   └── constants.js
│   └── index.js           # Punto de entrada
├── public/                # Recursos estáticos
│   ├── css/
│   ├── js/
│   ├── images/
│   └── index.html
├── tests/                 # Pruebas unitarias e integración
├── docs/                  # Documentación adicional
├── .env.example          # Plantilla de variables de entorno
├── package.json
└── README.md
```

## Scripts Disponibles

```json
{
  "start": "node src/index.js",
  "dev": "nodemon src/index.js",
  "test": "jest",
  "test:watch": "jest --watch",
  "lint": "eslint src/",
  "lint:fix": "eslint src/ --fix"
}
```

## Medidas de Seguridad Implementadas

- **Helmet**: Configuración automática de headers de seguridad HTTP
- **CORS**: Control granular de acceso entre orígenes
- **Rate Limiting**: Prevención de ataques de fuerza bruta
- **Input Validation**: Validación exhaustiva con Express Validator
- **SQL Injection Prevention**: Uso de prepared statements
- **Password Hashing**: Encriptación segura con bcrypt
- **JWT Security**: Tokens con expiración y renovación automática

## Monitoreo y Logging

El sistema incluye:

- Logging detallado con Morgan
- Métricas de rendimiento de la aplicación
- Alertas automáticas por email para eventos críticos

## Solución de Problemas Comunes

### Error de Conexión a MySQL

**Síntoma**: `Error: ER_ACCESS_DENIED_ERROR`

**Solución**:
1. Verificar credenciales en `.env`
2. Confirmar que MySQL esté ejecutándose
3. Validar permisos del usuario de base de datos

```bash
mysql -u root -p
GRANT ALL PRIVILEGES ON sistema_citas.* TO 'tu_usuario'@'localhost';
FLUSH PRIVILEGES;
```

### Puerto en Uso

**Síntoma**: `Error: listen EADDRINUSE :::3000`

**Solución**:
```bash
# Encontrar el proceso usando el puerto
lsof -ti:3000
# Terminar el proceso
kill -9 PID_DEL_PROCESO
```

### Problemas con Dependencias

**Síntoma**: Errores durante `npm install`

**Solución**:
```bash
# Limpiar caché de npm
npm cache clean --force
# Eliminar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Error de JWT

**Síntoma**: `JsonWebTokenError: invalid signature`

**Solución**:
1. Verificar que `JWT_SECRET` sea consistente
2. Confirmar que el token no haya expirado
3. Validar formato del header Authorization

## Contribución al Proyecto

### Proceso de Contribución

1. Fork del repositorio principal
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Implementar cambios con pruebas correspondientes
4. Commit siguiendo convenciones: `git commit -m 'feat: agregar nueva funcionalidad'`
5. Push a la rama: `git push origin feature/nueva-funcionalidad`
6. Crear Pull Request con descripción detallada

### Estándares de Código

- Seguir convenciones de JavaScript ES6+
- Documentar funciones con JSDoc
- Mantener cobertura de pruebas superior al 80%
- Usar ESLint para consistencia de código

## Licencia y Derechos

Este proyecto está licenciado bajo la Licencia ISC. Consulte el archivo `LICENSE` para más detalles.

## Información del Proyecto

**Desarrollador**: AlenRamirez  
**Repositorio**: [Sistema-de-citas](https://github.com/AlenRamirez/Sistema-de-citas-)  
**Versión**: 1.0.0  
**Estado**: En desarrollo activo

## Soporte Técnico

Para soporte técnico y consultas:

- **Issues de GitHub**: Para reportar bugs o solicitar features
- **Documentación Swagger**: Para detalles de la API
- **Wiki del Proyecto**: Para guías avanzadas y tutoriales