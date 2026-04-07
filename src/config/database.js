const knex = require('knex');

/**
 * Initialize Knex instance for database connection
 * Uses DATABASE_URL environment variable for connection string
 */
const db = knex({
  client: process.env.DB_CLIENT || 'postgresql',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    ...(process.env.DB_CLIENT === 'sqlite' && { filename: process.env.DB_FILENAME || ':memory:' })
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createTimeoutMillis: 30000
  },
  migrations: {
    directory: './migrations',
    extension: 'js'
  },
  seeds: {
    directory: './seeds',
    extension: 'js'
  }
});

// Test database connection
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connection successful');
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
  });

module.exports = db;
