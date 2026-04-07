import dotenv from 'dotenv';

dotenv.config();

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
    directory: './src/database/migrations',
    extension: 'ts'
  },
  seeds: {
    directory: './src/database/seeds',
    extension: 'ts'
  },
  pool: {
    min: 2,
    max: 10
  }
};

const config = {
  development: {
    ...baseConfig,
    debug: false
  },
  staging: {
    ...baseConfig,
    debug: false,
    pool: {
      min: 5,
      max: 20
    }
  },
  production: {
    ...baseConfig,
    debug: false,
    pool: {
      min: 10,
      max: 30
    }
  }
};

export default config;
