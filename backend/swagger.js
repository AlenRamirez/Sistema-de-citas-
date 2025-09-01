const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Sistema de Citas Médicas",
            version: "1.0.0",
            description: "Documentación completa de la API del Sistema de Citas Médicas",
            contact: {
                name: "Equipo de Desarrollo",
                email: "dev@clinica.com"
            }
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Servidor de desarrollo",
            },
            {
                url: "https://tu-api-produccion.com",
                description: "Servidor de producción",
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Token JWT para autenticación"
                }
            },
            schemas: {
                User: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        nombre: { type: "string", example: "Juan Pérez" },
                        email: { type: "string", example: "juan@email.com" },
                        telefono: { type: "string", example: "+57 300 123 4567" },
                        rol: { type: "string", enum: ["paciente", "medico", "admin"], example: "paciente" },
                        activo: { type: "boolean", example: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" }
                    }
                },
                Medico: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        nombre: { type: "string", example: "Dr. María González" },
                        email: { type: "string", example: "maria@clinica.com" },
                        telefono: { type: "string", example: "+57 301 234 5678" },
                        especialidades: {
                            type: "array",
                            items: { $ref: "#/components/schemas/Especialidad" }
                        },
                        horarios: {
                            type: "array",
                            items: { $ref: "#/components/schemas/Horario" }
                        }
                    }
                },
                Especialidad: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        nombre: { type: "string", example: "Cardiología" },
                        descripcion: { type: "string", example: "Especialidad médica que se encarga del corazón" }
                    }
                },
                Cita: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        pacienteId: { type: "integer", example: 1 },
                        medicoId: { type: "integer", example: 1 },
                        fecha: { type: "string", format: "date", example: "2024-12-15" },
                        hora: { type: "string", format: "time", example: "10:30:00" },
                        estado: { type: "string", enum: ["programada", "completada", "cancelada"], example: "programada" },
                        motivo: { type: "string", example: "Consulta general" },
                        observaciones: { type: "string", example: "Paciente presenta síntomas..." }
                    }
                },
                Horario: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        medicoId: { type: "integer", example: 1 },
                        diaSemana: { type: "integer", minimum: 0, maximum: 6, example: 1 },
                        horaInicio: { type: "string", format: "time", example: "08:00:00" },
                        horaFin: { type: "string", format: "time", example: "17:00:00" },
                        activo: { type: "boolean", example: true }
                    }
                },
                Error: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string", example: "Error en la operación" },
                        error: { type: "string", example: "Detalles del error" }
                    }
                },
                Success: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Operación exitosa" },
                        data: { type: "object" }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            }
        ]
    },
    apis: ["./routes/*.js", "./src/routes/*.js"], // Rutas donde buscar las anotaciones
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = { swaggerSpec, swaggerUi };