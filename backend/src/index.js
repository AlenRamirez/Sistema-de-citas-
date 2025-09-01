require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./config/db');

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


testConnection();

app.use('/', authRoutes);              
app.use('/pacientes', pacienteRoutes); 
app.use('/admin', adminRoutes);        

app.get('/auth/reset-password/:token', (req, res) => {
  // Primero intenta la ruta más específica (con carpeta frontend)
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

app.get('/', (req, res) => res.send('API funcionando'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Servidor ejecutándose en http://localhost:${PORT}`);
});