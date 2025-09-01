require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');
const { swaggerSpec, swaggerUi } = require('../swagger'); // Importar configuración de Swagger

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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Configuración de Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "API Sistema de Citas Médicas"
}));

// Ruta para obtener el JSON de Swagger
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

testConnection();

// Rutas de la API
app.use('/', authRoutes);
app.use('/pacientes', pacienteRoutes);
app.use('/admin', adminRoutes);

// Rutas de redirección para reset password
app.get('/auth/reset-password/:token', (req, res) => {
  const tokenParam = req.params.token;
  const redirectUrl = `http://127.0.0.1:5501/frontend/pages/resetPass.html?token=${tokenParam}`;

  console.log(`🔄 Redirigiendo a: ${redirectUrl}`);
  res.redirect(redirectUrl);
});

app.get('/reset-password/:token', (req, res) => {
  const tokenParam = req.params.token;
  const redirectUrl = `http://127.0.0.1:5501/resetPass.html?token=${tokenParam}`;

  console.log(`Redirigiendo (alternativa) a: ${redirectUrl}`);
  res.redirect(redirectUrl);
});

app.get('/', (req, res) => {
  res.json({
    message: 'API Sistema de Citas Médicas funcionando',
    documentation: 'http://localhost:3000/api-docs',
    version: '1.0.0'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📚 Documentación disponible en http://localhost:${PORT}/api-docs`);
});