const mysql = require('mysql2/promise');

const dbConfig ={
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'sistema_citas_medicas',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Conectado a MySQL exitosamente');
        connection.release();
        return true;
    } catch (error) {
        console.error('Error conectando a MySQL:', error.message);
        return false;
    }
}
module.exports = {pool, testConnection };

