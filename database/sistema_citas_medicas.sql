-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 21-08-2025 a las 00:22:07
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sistema_citas_medicas`
--

DELIMITER $$
--
-- Procedimientos
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_estadisticas_dashboard` ()   BEGIN
    SELECT 
        (SELECT COUNT(*) FROM usuarios WHERE id_rol = 2 AND activo = TRUE) as total_pacientes,
        (SELECT COUNT(*) FROM medicos WHERE estado = 'activo') as total_medicos,
        (SELECT COUNT(*) FROM citas WHERE id_estado IN (1,2)) as citas_activas,
        (SELECT COUNT(*) FROM citas WHERE DATE(fecha_creacion) = CURDATE()) as citas_hoy,
        (SELECT COUNT(*) FROM citas WHERE id_estado = 4) as citas_canceladas,
        (SELECT COUNT(*) FROM horarios WHERE disponible = TRUE AND fecha >= CURDATE()) as horarios_disponibles;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_limpiar_tokens_expirados` ()   BEGIN
    DELETE FROM tokens_recuperacion 
    WHERE expira_en < NOW() OR usado = TRUE;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `auditoria_citas`
--

CREATE TABLE `auditoria_citas` (
  `id_auditoria` bigint(20) NOT NULL,
  `id_cita` bigint(20) NOT NULL,
  `evento` varchar(50) NOT NULL,
  `estado_anterior` smallint(6) DEFAULT NULL,
  `estado_nuevo` smallint(6) DEFAULT NULL,
  `detalle` text DEFAULT NULL,
  `actor_id_usuario` bigint(20) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `fecha_evento` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `auditoria_citas`
--

INSERT INTO `auditoria_citas` (`id_auditoria`, `id_cita`, `evento`, `estado_anterior`, `estado_nuevo`, `detalle`, `actor_id_usuario`, `ip_address`, `fecha_evento`) VALUES
(1, 1, 'creada', NULL, 1, 'Cita creada exitosamente', NULL, NULL, '2025-08-19 21:27:00');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `citas`
--

CREATE TABLE `citas` (
  `id_cita` bigint(20) NOT NULL,
  `id_paciente` bigint(20) NOT NULL,
  `id_horario` bigint(20) NOT NULL,
  `id_estado` smallint(6) NOT NULL DEFAULT 1,
  `motivo` varchar(500) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `costo` decimal(10,2) DEFAULT 0.00,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cancelada_por` enum('paciente','admin') DEFAULT NULL,
  `motivo_cancelacion` varchar(255) DEFAULT NULL,
  `fecha_cancelacion` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `citas`
--

INSERT INTO `citas` (`id_cita`, `id_paciente`, `id_horario`, `id_estado`, `motivo`, `observaciones`, `costo`, `fecha_creacion`, `fecha_actualizacion`, `cancelada_por`, `motivo_cancelacion`, `fecha_cancelacion`) VALUES
(1, 2, 1, 1, 'Control médico general - chequeo anual', NULL, 0.00, '2025-08-19 21:27:00', '2025-08-19 21:27:00', NULL, NULL, NULL);

--
-- Disparadores `citas`
--
DELIMITER $$
CREATE TRIGGER `tr_auditoria_citas_update` AFTER UPDATE ON `citas` FOR EACH ROW BEGIN
    IF OLD.id_estado != NEW.id_estado THEN
        INSERT INTO auditoria_citas (
            id_cita, 
            evento, 
            estado_anterior, 
            estado_nuevo, 
            detalle
        ) VALUES (
            NEW.id_cita,
            CONCAT('cambio_estado_', (SELECT nombre FROM estados_cita WHERE id_estado = NEW.id_estado)),
            OLD.id_estado,
            NEW.id_estado,
            CONCAT('Estado: ', 
                   (SELECT nombre FROM estados_cita WHERE id_estado = OLD.id_estado),
                   ' → ',
                   (SELECT nombre FROM estados_cita WHERE id_estado = NEW.id_estado))
        );
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `tr_liberar_horario_cancelacion` AFTER UPDATE ON `citas` FOR EACH ROW BEGIN
    IF NEW.id_estado = 4 AND OLD.id_estado != 4 THEN
        UPDATE horarios 
        SET disponible = TRUE 
        WHERE id_horario = NEW.id_horario;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `tr_ocupar_horario_creacion` AFTER INSERT ON `citas` FOR EACH ROW BEGIN
    UPDATE horarios 
    SET disponible = FALSE 
    WHERE id_horario = NEW.id_horario;
    
    INSERT INTO auditoria_citas (
        id_cita, 
        evento, 
        estado_nuevo, 
        detalle
    ) VALUES (
        NEW.id_cita,
        'creada',
        NEW.id_estado,
        'Cita creada exitosamente'
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `configuracion_sistema`
--

CREATE TABLE `configuracion_sistema` (
  `id_config` smallint(6) NOT NULL,
  `clave` varchar(50) NOT NULL,
  `valor` text NOT NULL,
  `descripcion` varchar(200) DEFAULT NULL,
  `tipo` enum('string','number','boolean') DEFAULT 'string',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `configuracion_sistema`
--

INSERT INTO `configuracion_sistema` (`id_config`, `clave`, `valor`, `descripcion`, `tipo`, `created_at`) VALUES
(1, 'ventana_cancelacion_horas', '24', 'Horas mínimas antes de la cita para cancelar', 'number', '2025-08-19 21:26:59'),
(2, 'duracion_token_jwt_horas', '24', 'Duración del token JWT en horas', 'number', '2025-08-19 21:26:59'),
(3, 'max_intentos_login', '3', 'Intentos máximos de login', 'number', '2025-08-19 21:26:59'),
(4, 'tiempo_bloqueo_minutos', '15', 'Minutos de bloqueo tras intentos fallidos', 'number', '2025-08-19 21:26:59'),
(5, 'horario_atencion_inicio', '08:00', 'Hora inicio atención', 'string', '2025-08-19 21:26:59'),
(6, 'horario_atencion_fin', '18:00', 'Hora fin atención', 'string', '2025-08-19 21:26:59'),
(7, 'citas_maximas_por_paciente', '5', 'Citas activas máximas por paciente', 'number', '2025-08-19 21:26:59');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `especialidades`
--

CREATE TABLE `especialidades` (
  `id_especialidad` smallint(6) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `activa` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `especialidades`
--

INSERT INTO `especialidades` (`id_especialidad`, `nombre`, `descripcion`, `activa`, `created_at`) VALUES
(1, 'Medicina General', 'Atención médica integral y preventiva', 1, '2025-08-19 21:26:59'),
(2, 'Cardiología', 'Especialidad en enfermedades del corazón', 1, '2025-08-19 21:26:59'),
(3, 'Dermatología', 'Tratamiento de enfermedades de la piel', 1, '2025-08-19 21:26:59'),
(4, 'Pediatría', 'Atención médica en niños y adolescentes', 1, '2025-08-19 21:26:59'),
(5, 'Ginecología', 'Salud reproductiva femenina', 1, '2025-08-19 21:26:59'),
(6, 'Neurología', 'Enfermedades del sistema nervioso', 1, '2025-08-19 21:26:59'),
(7, 'Psiquiatría', 'Trastornos de salud mental', 1, '2025-08-19 21:26:59'),
(8, 'Oftalmología', 'Enfermedades de los ojos', 1, '2025-08-19 21:26:59'),
(9, 'Ortopedia', 'Sistema musculoesquelético', 1, '2025-08-19 21:26:59'),
(10, 'Endocrinología', 'Trastornos hormonales', 1, '2025-08-19 21:26:59');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `estados_cita`
--

CREATE TABLE `estados_cita` (
  `id_estado` smallint(6) NOT NULL,
  `nombre` varchar(40) NOT NULL,
  `descripcion` varchar(100) DEFAULT NULL,
  `color` varchar(7) DEFAULT NULL COMMENT 'Color hexadecimal para UI',
  `permite_cancelacion` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `estados_cita`
--

INSERT INTO `estados_cita` (`id_estado`, `nombre`, `descripcion`, `color`, `permite_cancelacion`, `created_at`) VALUES
(1, 'pendiente', 'Cita programada, pendiente de confirmación', '#FFC107', 1, '2025-08-19 21:26:59'),
(2, 'confirmada', 'Cita confirmada', '#28A745', 1, '2025-08-19 21:26:59'),
(3, 'realizada', 'Cita completada exitosamente', '#6C757D', 0, '2025-08-19 21:26:59'),
(4, 'cancelada', 'Cita cancelada', '#DC3545', 0, '2025-08-19 21:26:59'),
(5, 'no_asistio', 'Paciente no asistió a la cita', '#FD7E14', 0, '2025-08-19 21:26:59');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `horarios`
--

CREATE TABLE `horarios` (
  `id_horario` bigint(20) NOT NULL,
  `id_medico` bigint(20) NOT NULL,
  `fecha` date NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `disponible` tinyint(1) DEFAULT 1,
  `duracion_minutos` tinyint(4) DEFAULT 30,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Volcado de datos para la tabla `horarios`
--

INSERT INTO `horarios` (`id_horario`, `id_medico`, `fecha`, `hora_inicio`, `hora_fin`, `disponible`, `duracion_minutos`, `created_at`) VALUES
(1, 1, '2025-08-20', '09:00:00', '09:30:00', 0, 30, '2025-08-19 21:27:00'),
(2, 1, '2025-08-20', '09:30:00', '10:00:00', 1, 30, '2025-08-19 21:27:00'),
(3, 1, '2025-08-20', '10:00:00', '10:30:00', 1, 30, '2025-08-19 21:27:00'),
(4, 1, '2025-08-20', '14:00:00', '14:30:00', 1, 30, '2025-08-19 21:27:00'),
(5, 1, '2025-08-20', '14:30:00', '15:00:00', 1, 30, '2025-08-19 21:27:00'),
(6, 2, '2025-08-21', '08:00:00', '08:30:00', 1, 30, '2025-08-19 21:27:00'),
(7, 2, '2025-08-21', '08:30:00', '09:00:00', 1, 30, '2025-08-19 21:27:00'),
(8, 2, '2025-08-21', '15:00:00', '15:30:00', 1, 30, '2025-08-19 21:27:00'),
(9, 2, '2025-08-21', '15:30:00', '16:00:00', 1, 30, '2025-08-19 21:27:00'),
(10, 3, '2025-08-22', '10:00:00', '10:30:00', 1, 30, '2025-08-19 21:27:00'),
(11, 3, '2025-08-22', '10:30:00', '11:00:00', 1, 30, '2025-08-19 21:27:00'),
(12, 3, '2025-08-22', '16:00:00', '16:30:00', 1, 30, '2025-08-19 21:27:00'),
(13, 4, '2025-08-23', '09:00:00', '09:30:00', 1, 30, '2025-08-19 21:27:00'),
(14, 4, '2025-08-23', '11:00:00', '11:30:00', 1, 30, '2025-08-19 21:27:00'),
(15, 4, '2025-08-23', '11:30:00', '12:00:00', 1, 30, '2025-08-19 21:27:00');

--
-- Disparadores `horarios`
--
DELIMITER $$
CREATE TRIGGER `before_insert_horarios` BEFORE INSERT ON `horarios` FOR EACH ROW BEGIN
    IF NEW.fecha < CURDATE() THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'La fecha no puede ser en el pasado';
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medicos`
--

CREATE TABLE `medicos` (
  `id_medico` bigint(20) NOT NULL,
  `nombre_completo` varchar(150) NOT NULL,
  `correo` varchar(150) DEFAULT NULL,
  `registro_profesional` varchar(60) NOT NULL,
  `consultorio` varchar(60) DEFAULT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `estado` enum('activo','inactivo') DEFAULT 'activo',
  `biografia` text DEFAULT NULL,
  `experiencia_anos` tinyint(4) DEFAULT NULL,
  `foto_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `medicos`
--

INSERT INTO `medicos` (`id_medico`, `nombre_completo`, `correo`, `registro_profesional`, `consultorio`, `telefono`, `estado`, `biografia`, `experiencia_anos`, `foto_url`, `created_at`) VALUES
(1, 'Dr. Carlos García López', 'dr.garcia@hospital.com', 'MP-12345', 'Consultorio 101', '3201234567', 'activo', 'Especialista en Medicina General y Cardiología con 15 años de experiencia.', 15, NULL, '2025-08-19 21:27:00'),
(2, 'Dra. María Martínez Ruiz', 'dra.martinez@hospital.com', 'MP-67890', 'Consultorio 102', '3201234568', 'activo', 'Pediatra con especialización en cuidados intensivos neonatales.', 10, NULL, '2025-08-19 21:27:00'),
(3, 'Dr. Luis Rodríguez Peña', 'dr.rodriguez@hospital.com', 'MP-11111', 'Consultorio 201', '3201234569', 'activo', 'Dermatólogo especializado en cirugía dermatológica.', 8, NULL, '2025-08-19 21:27:00'),
(4, 'Dra. Ana Jiménez Castro', 'dra.jimenez@hospital.com', 'MP-22222', 'Consultorio 202', '3201234570', 'activo', 'Ginecóloga con maestría en medicina reproductiva.', 12, NULL, '2025-08-19 21:27:00');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `medico_especialidad`
--

CREATE TABLE `medico_especialidad` (
  `id_medico` bigint(20) NOT NULL,
  `id_especialidad` smallint(6) NOT NULL,
  `fecha_certificacion` date DEFAULT NULL,
  `activa` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `medico_especialidad`
--

INSERT INTO `medico_especialidad` (`id_medico`, `id_especialidad`, `fecha_certificacion`, `activa`, `created_at`) VALUES
(1, 1, '2010-01-15', 1, '2025-08-19 21:27:00'),
(1, 2, '2015-06-20', 1, '2025-08-19 21:27:00'),
(2, 4, '2018-03-10', 1, '2025-08-19 21:27:00'),
(3, 3, '2019-07-15', 1, '2025-08-19 21:27:00'),
(4, 5, '2016-09-20', 1, '2025-08-19 21:27:00');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pacientes`
--

CREATE TABLE `pacientes` (
  `id_paciente` bigint(20) NOT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `sexo` enum('M','F','O') DEFAULT NULL COMMENT 'M=Masculino, F=Femenino, O=Otro',
  `eps` varchar(120) DEFAULT NULL,
  `alergias` text DEFAULT NULL,
  `contacto_emergencia` varchar(150) DEFAULT NULL,
  `telefono_emergencia` varchar(30) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `pacientes`
--

INSERT INTO `pacientes` (`id_paciente`, `fecha_nacimiento`, `sexo`, `eps`, `alergias`, `contacto_emergencia`, `telefono_emergencia`, `created_at`, `updated_at`) VALUES
(2, '1990-05-15', 'M', 'EPS Salud Total', NULL, 'Ana Pérez (Madre)', '3009876543', '2025-08-19 21:27:00', '2025-08-19 21:27:00'),
(3, '1985-08-22', 'F', 'Nueva EPS', NULL, 'Pedro González (Esposo)', '3009876544', '2025-08-19 21:27:00', '2025-08-19 21:27:00'),
(4, '1992-12-10', 'M', 'Sanitas', NULL, 'Luisa Rodríguez (Esposa)', '3009876545', '2025-08-19 21:27:00', '2025-08-19 21:27:00');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `recuperacion_password`
--

CREATE TABLE `recuperacion_password` (
  `id` int(11) NOT NULL,
  `id_usuario` bigint(20) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expiracion` datetime NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `recuperacion_password`
--

INSERT INTO `recuperacion_password` (`id`, `id_usuario`, `token`, `expiracion`, `creado_en`) VALUES
(2, 15, '517d059073fe332c138af49033a789e2d44869812f246b0c68a4fab98dbb22c6', '2025-08-20 16:43:38', '2025-08-20 20:43:38');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id_rol` smallint(6) NOT NULL,
  `nombre` varchar(30) NOT NULL,
  `descripcion` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id_rol`, `nombre`, `descripcion`, `created_at`) VALUES
(1, 'admin', 'Administrador del sistema', '2025-08-19 21:26:58'),
(2, 'paciente', 'Paciente del sistema', '2025-08-19 21:26:58');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id_usuario` bigint(20) NOT NULL,
  `correo` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nombre_completo` varchar(150) NOT NULL,
  `documento` varchar(30) NOT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `id_rol` smallint(6) NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `fecha_ultimo_acceso` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `intentos_fallidos` int(11) DEFAULT 0,
  `bloqueado_hasta` datetime DEFAULT NULL,
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expire` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id_usuario`, `correo`, `password_hash`, `nombre_completo`, `documento`, `telefono`, `id_rol`, `activo`, `fecha_ultimo_acceso`, `created_at`, `updated_at`, `intentos_fallidos`, `bloqueado_hasta`, `reset_token`, `reset_token_expire`) VALUES
(1, 'admin@sistema.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador Sistema', '12345678', '3001234567', 1, 1, NULL, '2025-08-19 21:27:00', '2025-08-19 21:27:00', 0, NULL, NULL, NULL),
(2, 'juan@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Juan Pérez Gómez', '1023456789', '3001234568', 2, 1, NULL, '2025-08-19 21:27:00', '2025-08-19 21:27:00', 0, NULL, NULL, NULL),
(3, 'maria@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'María González López', '1034567890', '3001234569', 2, 1, NULL, '2025-08-19 21:27:00', '2025-08-19 21:27:00', 0, NULL, NULL, NULL),
(4, 'carlos@test.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Carlos Rodríguez Silva', '1045678901', '3001234570', 2, 1, NULL, '2025-08-19 21:27:00', '2025-08-19 21:27:00', 0, NULL, NULL, NULL),
(6, 'valentina@example.com', '$2b$10$Q/IlhJkvi2JDw/JCQNuKJOG1tAyEtdULS2kW1SqvTLayxMFtpdL6W', 'Valentina Ramirez', '123400000', '3001230067', 2, 1, NULL, '2025-08-20 15:47:07', '2025-08-20 15:47:07', 0, NULL, NULL, NULL),
(7, 'ramiro@example.com', '$2b$10$Y5Jx/KJTMwF3oywuGpK74.P5B2QMGKfVYLWiIl9UDzhsTq.Km3NP6', 'Ramiro Ramirez', '123488880', '3001230067', 2, 1, NULL, '2025-08-20 16:09:14', '2025-08-20 16:09:14', 0, NULL, NULL, NULL),
(15, 'valentinaramirezld25@gmail.com', '$2b$10$tFtQk36eXK5leroNYLEFKuV5SaJAaNNMZQNLHa8IjDe65OrQkje0C', 'Laura Ramirez', '123400080', '3001230067', 2, 1, '2025-08-20 20:41:28', '2025-08-20 19:18:03', '2025-08-20 20:41:28', 0, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_citas_completa`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_citas_completa` (
`id_cita` bigint(20)
,`motivo` varchar(500)
,`costo` decimal(10,2)
,`fecha_creacion` timestamp
,`fecha_actualizacion` timestamp
,`id_paciente` bigint(20)
,`paciente_nombre` varchar(150)
,`paciente_correo` varchar(150)
,`paciente_documento` varchar(30)
,`id_medico` bigint(20)
,`medico_nombre` varchar(150)
,`consultorio` varchar(60)
,`registro_profesional` varchar(60)
,`cita_fecha` date
,`hora_inicio` time
,`hora_fin` time
,`estado_nombre` varchar(40)
,`estado_color` varchar(7)
,`permite_cancelacion` tinyint(1)
,`especialidad_nombre` varchar(120)
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_horarios_disponibles`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_horarios_disponibles` (
`id_horario` bigint(20)
,`fecha` date
,`hora_inicio` time
,`hora_fin` time
,`duracion_minutos` tinyint(4)
,`id_medico` bigint(20)
,`medico_nombre` varchar(150)
,`consultorio` varchar(60)
,`registro_profesional` varchar(60)
,`especialidades` mediumtext
);

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_citas_completa`
--
DROP TABLE IF EXISTS `vista_citas_completa`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_citas_completa`  AS SELECT `c`.`id_cita` AS `id_cita`, `c`.`motivo` AS `motivo`, `c`.`costo` AS `costo`, `c`.`fecha_creacion` AS `fecha_creacion`, `c`.`fecha_actualizacion` AS `fecha_actualizacion`, `p`.`id_paciente` AS `id_paciente`, `up`.`nombre_completo` AS `paciente_nombre`, `up`.`correo` AS `paciente_correo`, `up`.`documento` AS `paciente_documento`, `m`.`id_medico` AS `id_medico`, `m`.`nombre_completo` AS `medico_nombre`, `m`.`consultorio` AS `consultorio`, `m`.`registro_profesional` AS `registro_profesional`, `h`.`fecha` AS `cita_fecha`, `h`.`hora_inicio` AS `hora_inicio`, `h`.`hora_fin` AS `hora_fin`, `ec`.`nombre` AS `estado_nombre`, `ec`.`color` AS `estado_color`, `ec`.`permite_cancelacion` AS `permite_cancelacion`, `e`.`nombre` AS `especialidad_nombre` FROM (((((((`citas` `c` join `pacientes` `p` on(`c`.`id_paciente` = `p`.`id_paciente`)) join `usuarios` `up` on(`p`.`id_paciente` = `up`.`id_usuario`)) join `horarios` `h` on(`c`.`id_horario` = `h`.`id_horario`)) join `medicos` `m` on(`h`.`id_medico` = `m`.`id_medico`)) join `estados_cita` `ec` on(`c`.`id_estado` = `ec`.`id_estado`)) left join `medico_especialidad` `me` on(`m`.`id_medico` = `me`.`id_medico` and `me`.`activa` = 1)) left join `especialidades` `e` on(`me`.`id_especialidad` = `e`.`id_especialidad`)) WHERE `up`.`activo` = 1 ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_horarios_disponibles`
--
DROP TABLE IF EXISTS `vista_horarios_disponibles`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_horarios_disponibles`  AS SELECT `h`.`id_horario` AS `id_horario`, `h`.`fecha` AS `fecha`, `h`.`hora_inicio` AS `hora_inicio`, `h`.`hora_fin` AS `hora_fin`, `h`.`duracion_minutos` AS `duracion_minutos`, `m`.`id_medico` AS `id_medico`, `m`.`nombre_completo` AS `medico_nombre`, `m`.`consultorio` AS `consultorio`, `m`.`registro_profesional` AS `registro_profesional`, group_concat(`e`.`nombre` separator ', ') AS `especialidades` FROM (((`horarios` `h` join `medicos` `m` on(`h`.`id_medico` = `m`.`id_medico`)) left join `medico_especialidad` `me` on(`m`.`id_medico` = `me`.`id_medico` and `me`.`activa` = 1)) left join `especialidades` `e` on(`me`.`id_especialidad` = `e`.`id_especialidad`)) WHERE `h`.`disponible` = 1 AND `h`.`fecha` >= curdate() AND `m`.`estado` = 'activo' GROUP BY `h`.`id_horario`, `h`.`fecha`, `h`.`hora_inicio`, `h`.`hora_fin`, `h`.`duracion_minutos`, `m`.`id_medico`, `m`.`nombre_completo`, `m`.`consultorio`, `m`.`registro_profesional` ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `auditoria_citas`
--
ALTER TABLE `auditoria_citas`
  ADD PRIMARY KEY (`id_auditoria`),
  ADD KEY `actor_id_usuario` (`actor_id_usuario`),
  ADD KEY `idx_cita` (`id_cita`),
  ADD KEY `idx_evento` (`evento`),
  ADD KEY `idx_fecha` (`fecha_evento`);

--
-- Indices de la tabla `citas`
--
ALTER TABLE `citas`
  ADD PRIMARY KEY (`id_cita`),
  ADD UNIQUE KEY `unique_horario_cita` (`id_horario`),
  ADD KEY `idx_paciente` (`id_paciente`),
  ADD KEY `idx_estado` (`id_estado`),
  ADD KEY `idx_fecha_creacion` (`fecha_creacion`),
  ADD KEY `idx_citas_paciente_estado` (`id_paciente`,`id_estado`),
  ADD KEY `idx_citas_fecha_estado` (`fecha_creacion`,`id_estado`);

--
-- Indices de la tabla `configuracion_sistema`
--
ALTER TABLE `configuracion_sistema`
  ADD PRIMARY KEY (`id_config`),
  ADD UNIQUE KEY `clave` (`clave`);

--
-- Indices de la tabla `especialidades`
--
ALTER TABLE `especialidades`
  ADD PRIMARY KEY (`id_especialidad`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `estados_cita`
--
ALTER TABLE `estados_cita`
  ADD PRIMARY KEY (`id_estado`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `horarios`
--
ALTER TABLE `horarios`
  ADD PRIMARY KEY (`id_horario`),
  ADD UNIQUE KEY `unique_horario` (`id_medico`,`fecha`,`hora_inicio`,`hora_fin`),
  ADD KEY `idx_medico_fecha` (`id_medico`,`fecha`),
  ADD KEY `idx_disponible` (`disponible`),
  ADD KEY `idx_fecha_hora` (`fecha`,`hora_inicio`);

--
-- Indices de la tabla `medicos`
--
ALTER TABLE `medicos`
  ADD PRIMARY KEY (`id_medico`),
  ADD UNIQUE KEY `registro_profesional` (`registro_profesional`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_registro` (`registro_profesional`);

--
-- Indices de la tabla `medico_especialidad`
--
ALTER TABLE `medico_especialidad`
  ADD PRIMARY KEY (`id_medico`,`id_especialidad`),
  ADD KEY `id_especialidad` (`id_especialidad`);

--
-- Indices de la tabla `pacientes`
--
ALTER TABLE `pacientes`
  ADD PRIMARY KEY (`id_paciente`);

--
-- Indices de la tabla `recuperacion_password`
--
ALTER TABLE `recuperacion_password`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_usuario` (`id_usuario`);

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id_rol`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id_usuario`),
  ADD UNIQUE KEY `correo` (`correo`),
  ADD UNIQUE KEY `documento` (`documento`),
  ADD KEY `idx_correo` (`correo`),
  ADD KEY `idx_documento` (`documento`),
  ADD KEY `idx_rol` (`id_rol`),
  ADD KEY `idx_usuarios_rol_activo` (`id_rol`,`activo`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `auditoria_citas`
--
ALTER TABLE `auditoria_citas`
  MODIFY `id_auditoria` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `citas`
--
ALTER TABLE `citas`
  MODIFY `id_cita` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `configuracion_sistema`
--
ALTER TABLE `configuracion_sistema`
  MODIFY `id_config` smallint(6) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `especialidades`
--
ALTER TABLE `especialidades`
  MODIFY `id_especialidad` smallint(6) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT de la tabla `horarios`
--
ALTER TABLE `horarios`
  MODIFY `id_horario` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `medicos`
--
ALTER TABLE `medicos`
  MODIFY `id_medico` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `recuperacion_password`
--
ALTER TABLE `recuperacion_password`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id_rol` smallint(6) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id_usuario` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `auditoria_citas`
--
ALTER TABLE `auditoria_citas`
  ADD CONSTRAINT `auditoria_citas_ibfk_1` FOREIGN KEY (`id_cita`) REFERENCES `citas` (`id_cita`) ON DELETE CASCADE,
  ADD CONSTRAINT `auditoria_citas_ibfk_2` FOREIGN KEY (`actor_id_usuario`) REFERENCES `usuarios` (`id_usuario`);

--
-- Filtros para la tabla `citas`
--
ALTER TABLE `citas`
  ADD CONSTRAINT `citas_ibfk_1` FOREIGN KEY (`id_paciente`) REFERENCES `pacientes` (`id_paciente`) ON DELETE CASCADE,
  ADD CONSTRAINT `citas_ibfk_2` FOREIGN KEY (`id_horario`) REFERENCES `horarios` (`id_horario`) ON DELETE CASCADE,
  ADD CONSTRAINT `citas_ibfk_3` FOREIGN KEY (`id_estado`) REFERENCES `estados_cita` (`id_estado`);

--
-- Filtros para la tabla `horarios`
--
ALTER TABLE `horarios`
  ADD CONSTRAINT `horarios_ibfk_1` FOREIGN KEY (`id_medico`) REFERENCES `medicos` (`id_medico`) ON DELETE CASCADE;

--
-- Filtros para la tabla `medico_especialidad`
--
ALTER TABLE `medico_especialidad`
  ADD CONSTRAINT `medico_especialidad_ibfk_1` FOREIGN KEY (`id_medico`) REFERENCES `medicos` (`id_medico`) ON DELETE CASCADE,
  ADD CONSTRAINT `medico_especialidad_ibfk_2` FOREIGN KEY (`id_especialidad`) REFERENCES `especialidades` (`id_especialidad`) ON DELETE CASCADE;

--
-- Filtros para la tabla `pacientes`
--
ALTER TABLE `pacientes`
  ADD CONSTRAINT `pacientes_ibfk_1` FOREIGN KEY (`id_paciente`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE;

--
-- Filtros para la tabla `recuperacion_password`
--
ALTER TABLE `recuperacion_password`
  ADD CONSTRAINT `recuperacion_password_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`);

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`id_rol`) REFERENCES `roles` (`id_rol`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
