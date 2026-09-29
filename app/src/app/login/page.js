import { redirect } from 'next/navigation';
import { currentUser, verifyPassword, createSession } from '@/lib/auth';

export default async function LoginPage({ searchParams }) {
  const sp = await searchParams;
  const user = await currentUser();
  if (user) redirect('/tasks');

  async function login(formData) {
    'use server';
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const u = await verifyPassword(email, password);
    if (!u) redirect('/login?error=1');
    await createSession(u.id);
    redirect('/tasks');
  }

  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className="mb-6 flex items-center gap-3">
        <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="1" y="1" width="30" height="30" rx="9" fill="#14213D" />
          <path d="M8 11h11M8 16h15M8 21h8" stroke="#2F6BFF" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="24.5" cy="21" r="3.2" fill="#17B890" />
        </svg>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">TaskFlow</h1>
          <p className="text-sm text-slate-500">Задачи, сотрудники и сроки в одном месте</p>
        </div>
      </div>

      <form className="card space-y-4" action={login}>
        {sp?.error && (
          <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-sm font-medium text-rose">
            Неверный email или пароль.
          </p>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" name="email" type="email" required defaultValue="" autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="password">Пароль</label>
          <input className="field" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full" type="submit">Войти</button>
      </form>

      <p className="mt-4 text-center text-xs text-slate-500">
        Демо-доступы: admin@taskflow.ru / egor@taskflow.ru · пароль demo123
      </p>
    </div>
  );
}
