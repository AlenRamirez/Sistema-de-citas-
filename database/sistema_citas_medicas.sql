-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 01-09-2025 a las 21:36:19
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.1.25

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

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `citas`
--

CREATE TABLE `citas` (
  `id_cita` bigint(20) NOT NULL,
  `id_paciente` bigint(20) NOT NULL,
  `id_horario` bigint(20) NOT NULL,
  `id_estado` smallint(6) NOT NULL DEFAULT 1,
  `motivo` text DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `costo` decimal(10,2) DEFAULT 0.00,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cancelada_por` varchar(50) DEFAULT NULL,
  `motivo_cancelacion` text DEFAULT NULL,
  `fecha_cancelacion` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
(7, 'Psiquiatría', 'Trastornos de salud mental', 1, '2025-08-19 21:26:59');

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
  `duracion_minutos` int(11) DEFAULT 30,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `horarios`
--

INSERT INTO `horarios` (`id_horario`, `id_medico`, `fecha`, `hora_inicio`, `hora_fin`, `disponible`, `duracion_minutos`, `created_at`) VALUES
(1, 1, '2025-09-07', '08:00:00', '09:00:00', 1, 60, '2025-09-01 19:35:25'),
(2, 1, '2025-09-08', '09:30:00', '10:30:00', 1, 60, '2025-09-01 19:35:25'),
(3, 1, '2025-09-09', '11:00:00', '12:00:00', 1, 60, '2025-09-01 19:35:25'),
(4, 1, '2025-09-10', '14:00:00', '15:00:00', 1, 60, '2025-09-01 19:35:25'),
(5, 1, '2025-09-11', '15:30:00', '16:30:00', 1, 60, '2025-09-01 19:35:25'),
(6, 2, '2025-09-07', '08:30:00', '09:30:00', 1, 60, '2025-09-01 19:35:25'),
(7, 2, '2025-09-08', '10:00:00', '11:00:00', 1, 60, '2025-09-01 19:35:25'),
(8, 2, '2025-09-09', '11:30:00', '12:30:00', 1, 60, '2025-09-01 19:35:25'),
(9, 2, '2025-09-10', '13:30:00', '14:30:00', 1, 60, '2025-09-01 19:35:25'),
(10, 2, '2025-09-11', '15:00:00', '16:00:00', 1, 60, '2025-09-01 19:35:25'),
(11, 3, '2025-09-07', '07:30:00', '08:30:00', 1, 60, '2025-09-01 19:35:25'),
(12, 3, '2025-09-08', '09:00:00', '10:00:00', 1, 60, '2025-09-01 19:35:25'),
(13, 3, '2025-09-09', '10:30:00', '11:30:00', 1, 60, '2025-09-01 19:35:25'),
(14, 3, '2025-09-10', '12:00:00', '13:00:00', 1, 60, '2025-09-01 19:35:25'),
(15, 3, '2025-09-11', '14:00:00', '15:00:00', 1, 60, '2025-09-01 19:35:25'),
(16, 4, '2025-09-07', '08:00:00', '09:00:00', 1, 60, '2025-09-01 19:35:25'),
(17, 4, '2025-09-08', '09:30:00', '10:30:00', 1, 60, '2025-09-01 19:35:25'),
(18, 4, '2025-09-09', '11:00:00', '12:00:00', 1, 60, '2025-09-01 19:35:25'),
(19, 4, '2025-09-10', '13:00:00', '14:00:00', 1, 60, '2025-09-01 19:35:25'),
(20, 4, '2025-09-11', '14:30:00', '15:30:00', 1, 60, '2025-09-01 19:35:25'),
(21, 5, '2025-09-07', '07:00:00', '08:00:00', 1, 60, '2025-09-01 19:35:25'),
(22, 5, '2025-09-08', '08:30:00', '09:30:00', 1, 60, '2025-09-01 19:35:25'),
(23, 5, '2025-09-09', '10:00:00', '11:00:00', 1, 60, '2025-09-01 19:35:25'),
(24, 5, '2025-09-10', '11:30:00', '12:30:00', 1, 60, '2025-09-01 19:35:25'),
(25, 5, '2025-09-11', '13:00:00', '14:00:00', 1, 60, '2025-09-01 19:35:25');

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
(1, 'Dr. Juan Pérez', 'juan.perez@email.com', 'RP12345', 'Consultorio A', '3001234567', 'activo', 'Especialista en medicina general con 10 años de experiencia.', 10, 'https://example.com/foto1.jpg', '2025-09-01 19:28:24'),
(2, 'Dra. María López', 'maria.lopez@email.com', 'RP67890', 'Consultorio B', '3007654321', 'activo', 'Ginecóloga con amplia experiencia en atención prenatal y fertilidad.', 12, 'https://example.com/foto2.jpg', '2025-09-01 19:28:24'),
(3, 'Dr. Carlos Martínez', 'carlos.martinez@email.com', 'RP11223', 'Consultorio C', '3011122233', 'activo', 'Pediatra enfocado en desarrollo infantil y vacunas.', 8, 'https://example.com/foto3.jpg', '2025-09-01 19:28:24'),
(4, 'Dra. Ana Gómez', 'ana.gomez@email.com', 'RP44556', 'Consultorio D', '3013344556', 'activo', 'Dermatóloga especializada en piel sensible y tratamientos estéticos.', 5, 'https://example.com/foto4.jpg', '2025-09-01 19:28:24'),
(5, 'Dr. Luis Torres', 'luis.torres@email.com', 'RP77889', 'Consultorio E', '3024455667', 'activo', 'Cirujano con experiencia en procedimientos ambulatorios y quirúrgicos.', 15, 'https://example.com/foto5.jpg', '2025-09-01 19:28:24');

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
(1, 1, '2015-06-15', 1, '2025-09-01 19:30:49'),
(2, 2, '2012-03-10', 1, '2025-09-01 19:30:49'),
(3, 3, '2018-09-05', 1, '2025-09-01 19:30:49'),
(4, 4, '2020-01-20', 1, '2025-09-01 19:30:49'),
(5, 5, '2010-11-30', 1, '2025-09-01 19:30:49');

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
(1, NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-01 19:15:21', '2025-09-01 19:15:21'),
(2, '2006-10-25', 'F', 'Compensar', 'Ninguna', 'Liliana Ramirez (Mamá)', '3183904956', '2025-09-01 19:16:11', '2025-09-01 19:22:51'),
(3, '2006-10-25', 'M', 'Sanitas', 'Ninguna', 'Daniela Luna (Esposa)', '3183904956', '2025-09-01 19:17:45', '2025-09-01 19:19:52'),
(4, '2000-10-10', 'M', NULL, NULL, NULL, NULL, '2025-09-01 19:24:41', '2025-09-01 19:25:26');

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
(1, 'lauravalentinadiaz25@gmail.com', '$2b$10$5jYrFjvYfmILe5X1hgb6D.Ss04d4AVEK8GPZBBfgC5pR5ME1x5/By', 'Laura Valentina Diaz Ramirez', '1110487272', '314372727272', 1, 1, NULL, '2025-09-01 19:15:21', '2025-09-01 19:21:49', 0, NULL, NULL, NULL),
(2, 'valentinaramirezld25@gmail.com', '$2b$10$WqmOR4.I23NYPqwe3l2G9eIM1UBLeA4ac33ZyEhCyfZsDR2QiW09a', 'Laura Valentina Diaz Ramirez', '29999293718', '3123461118', 2, 1, '2025-09-01 19:22:27', '2025-09-01 19:16:11', '2025-09-01 19:22:27', 0, NULL, NULL, NULL),
(3, 'leonba251996@gmail.com', '$2b$10$VxoZ8.gviKS0U3iFYS/.w.2uU9Ft9bOCR0EXps.OphgJGrzW1gkhq', 'Manuel Antonio  Leon Ballesta', '1292938512', '3123232848', 2, 1, '2025-09-01 19:19:07', '2025-09-01 19:17:45', '2025-09-01 19:19:07', 0, NULL, NULL, NULL),
(4, 'Juan@gmail.com', '$2b$10$FPrh7YQOwiEQ6ciyoV9w7eFRYWpgeKla9swM/gP4kZ1wCZMb7vNpi', 'Juan David Cardona Espinosa', '52786045', '3198467785', 2, 1, '2025-09-01 19:25:08', '2025-09-01 19:24:41', '2025-09-01 19:25:08', 0, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_citas_completa`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_citas_completa` (
`id_cita` bigint(20)
,`motivo` text
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
,`duracion_minutos` int(11)
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
  ADD KEY `idx_paciente` (`id_paciente`),
  ADD KEY `idx_horario` (`id_horario`),
  ADD KEY `idx_estado` (`id_estado`),
  ADD KEY `idx_fecha_creacion` (`fecha_creacion`);

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
  ADD KEY `fk_horario_medico` (`id_medico`);

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
  MODIFY `id_auditoria` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `citas`
--
ALTER TABLE `citas`
  MODIFY `id_cita` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `configuracion_sistema`
--
ALTER TABLE `configuracion_sistema`
  MODIFY `id_config` smallint(6) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `especialidades`
--
ALTER TABLE `especialidades`
  MODIFY `id_especialidad` smallint(6) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `horarios`
--
ALTER TABLE `horarios`
  MODIFY `id_horario` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT de la tabla `medicos`
--
ALTER TABLE `medicos`
  MODIFY `id_medico` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `recuperacion_password`
--
ALTER TABLE `recuperacion_password`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id_rol` smallint(6) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id_usuario` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

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
  ADD CONSTRAINT `fk_citas_estado` FOREIGN KEY (`id_estado`) REFERENCES `estados_cita` (`id_estado`),
  ADD CONSTRAINT `fk_citas_horario` FOREIGN KEY (`id_horario`) REFERENCES `horarios` (`id_horario`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_citas_paciente` FOREIGN KEY (`id_paciente`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE;

--
-- Filtros para la tabla `horarios`
--
ALTER TABLE `horarios`
  ADD CONSTRAINT `fk_horario_medico` FOREIGN KEY (`id_medico`) REFERENCES `medicos` (`id_medico`) ON DELETE CASCADE ON UPDATE CASCADE;

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
  ADD CONSTRAINT `fk_paciente_usuario` FOREIGN KEY (`id_paciente`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE,
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
