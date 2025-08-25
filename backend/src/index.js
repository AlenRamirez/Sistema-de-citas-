require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const authRoutes = require('./routes/authRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middlewares
app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://localhost:5500',
    'http://localhost:5501'
  ],
  credentials: true
}));

testConnection();

// Swagger
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: { title: "API Sistema de Citas Médicas", version: "1.0.0" }
  },
  apis: ["./routes/*.js"],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ⭐ RUTAS SIN PREFIJOS ADICIONALES
app.use('/', authRoutes);              // Crea: /register, /login, etc.
app.use('/pacientes', pacienteRoutes); // Crea: /pacientes/*
app.use('/admin', adminRoutes);        // Crea: /admin/*

app.get('/', (req, res) => res.send('API funcionando'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(` Documentación en http://localhost:${PORT}/api-docs`);
});