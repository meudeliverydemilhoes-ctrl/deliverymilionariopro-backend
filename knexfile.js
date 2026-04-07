require('dotenv').config();

const baseConfig = {
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'deliverymilionario'
  },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  },
  pool: {
    min: 2,
    max: 10
  }
};

module.exports = {
  development: {
    ...baseConfig,
    debug: false
  },
  staging: {
    ...baseConfig,
    debug: false,
    pool: { min: 5, max: 20 }
  },
  production: {
    ...baseConfig,
    debug: false,
    pool: { min: 5, max: 20 }
  }
};
