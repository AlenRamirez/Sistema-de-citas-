require('dotenv').config();
const express = require('express');
const { testConnection } = require('./config/db');

const app = express();
app.use(express.json());


testConnection();
app.get('/', (req, res) => {
  res.send('Servidor funcionando ');
});

// levantar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
