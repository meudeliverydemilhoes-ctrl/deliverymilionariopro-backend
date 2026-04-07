const knex = require('knex');

/**
 * Initialize Knex instance for database connection
 * Uses DATABASE_URL environment variable for connection string
 */
const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
});

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    console.log('[DB] Database connection successful');
  })
  .catch((err) => {
    console.error('[DB] Database connection failed:', err.message);
  });

module.exports = db;
