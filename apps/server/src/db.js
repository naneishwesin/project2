import pg from "pg";

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      max: 5,
      ssl: { rejectUnauthorized: false }
    });
    
  }
  return pool;
}

export async function pingDb() {
  const p = getPool();
  const { rows } = await p.query("select 1 as ok");
  return rows?.[0]?.ok === 1;
}

