require('dotenv').config();
const express = require('express');
const { testConnection } = require('./config/db');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const authRoutes = require('./routes/authRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
app.use(express.json());


testConnection();

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: { title: "API Sistema de Citas Médicas", version: "1.0.0" }
  },
  apis: ["./src/routes/*.js"],
};
const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use('/auth', authRoutes);
app.use('/pacientes', pacienteRoutes);
app.use('/admin', adminRoutes);




app.get('/', (req, res) => res.send('API funcionando'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
