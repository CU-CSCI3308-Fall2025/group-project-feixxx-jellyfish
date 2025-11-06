const pgp = require('pg-promise')();
require('dotenv').config();

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const db = pgp(dbConfig);

const initDB = async () => {
  try {
    await db.none(`
      DROP TABLE IF EXISTS users CASCADE;
      CREATE TABLE IF NOT EXISTS users(
          username VARCHAR(50) PRIMARY KEY,
          password VARCHAR(60) NOT NULL
      );
    `);
    console.log('Created users table');
    process.exit(0);
  } catch (err) {
    console.error('Cannot create table', err);
    process.exit(1);
  }
};

initDB();
