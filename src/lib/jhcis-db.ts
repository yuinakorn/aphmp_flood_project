import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.JHCIS_DB_HOST,
  port: parseInt(process.env.JHCIS_DB_PORT || '6034'),
  user: process.env.JHCIS_DB_USER,
  password: process.env.JHCIS_DB_PASS,
  database: process.env.JHCIS_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
