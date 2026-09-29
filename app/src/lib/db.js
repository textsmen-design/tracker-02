/**
 * Tracker_02 (TaskFlow) — подключение к PostgreSQL.
 * Учебные параметры берутся из переменных окружения, значения по умолчанию —
 * локальная разработка. Секреты в репозиторий не коммитятся (.env.local в .gitignore).
 */
import { Pool, types } from 'pg';

/**
 * ДЕФЕКТ D2-1 (исправлен): драйвер pg по умолчанию превращает колонку DATE
 * в объект JS Date. Из-за этого срок задачи выводился как «Wed Sep 23»,
 * а сравнение с сегодняшней датой (подсветка просроченных) не работало вовсе.
 * Просим драйвер отдавать DATE (OID 1082) как строку 'YYYY-MM-DD'.
 */
types.setTypeParser(1082, (v) => v);

const globalForPg = globalThis;

export const pool =
  globalForPg.__taskflowPool ||
  new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    database: process.env.PGDATABASE || 'taskflow',
    max: 5,
  });

if (!globalForPg.__taskflowPool) globalForPg.__taskflowPool = pool;

export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows;
}
export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}
