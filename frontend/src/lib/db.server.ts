import { Pool } from "pg";

const host = process.env.DB_HOST;
const port = Number(process.env.DB_PORT ?? 16370);
const database = process.env.DB_NAME ?? "defaultdb";
const user = process.env.DB_USER ?? "avnadmin";
const password = process.env.DB_PASSWORD;

if (!host || !password) {
  throw new Error("Database environment variables are missing");
}

export const pool = new Pool({
  host,
  port,
  database,
  user,
  password,
  ssl: {
    rejectUnauthorized: false,
  },
});