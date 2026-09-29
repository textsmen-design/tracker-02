/**
 * Tracker_02 (TaskFlow) — сессии и роли.
 * ОТКЛОНЕНИЕ ОТ ЗАКАЗА (зафиксировано честно): клиент просил Supabase Auth,
 * но для этого нужен аккаунт и ключи клиента. В учебном MVP — собственная
 * сессия в БД + httpOnly-cookie. Интерфейс auth-функций сделан так, чтобы
 * замена на Supabase затрагивала только этот файл.
 */
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { q, one } from './db';
import crypto from 'crypto';

const COOKIE = 'taskflow_session';

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await q('INSERT INTO sessions (token, user_id) VALUES ($1,$2)', [token, userId]);
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('DELETE FROM sessions WHERE token = $1', [token]);
  jar.delete(COOKIE);
}

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return await one(
    `SELECT u.id, u.email, u.full_name, u.role, u.position, u.is_active
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = $1 AND u.is_active = true`,
    [token]
  );
}

export async function verifyPassword(email, password) {
  const u = await one('SELECT * FROM users WHERE lower(email) = lower($1) AND is_active = true', [email]);
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  return ok ? u : null;
}

export const hashPassword = (p) => bcrypt.hash(p, 10);
export const isAdmin = (u) => !!u && u.role === 'admin';
