import { redirect } from 'next/navigation';
import { currentUser, isAdmin, hashPassword } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { CATEGORIES, employeesWithLoad } from '@/lib/domain';

export default async function AdminPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  // Панель администратора: сотрудник сюда не попадает даже по прямой ссылке.
  if (!isAdmin(user)) redirect('/tasks?error=forbidden');
  const sp = await searchParams;

  const users = await q(
    `SELECT u.id, u.email, u.full_name, u.role, u.position, u.specialization, u.is_active,
            COUNT(t.id) FILTER (WHERE t.status <> 'done') AS open_tasks
       FROM users u LEFT JOIN tasks t ON t.assignee_id = u.id
      GROUP BY u.id ORDER BY u.role, u.full_name`
  );

  async function createUser(formData) {
    'use server';
    const me = await currentUser();
    if (!isAdmin(me)) redirect('/tasks?error=forbidden');
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const fullName = String(formData.get('full_name') || '').trim();
    const role = String(formData.get('role') || 'employee');
    const position = String(formData.get('position') || '').trim();
    const spec = String(formData.get('specialization') || '');
    const password = String(formData.get('password') || '');

    if (!email.includes('@') || fullName.length < 3) redirect('/admin?error=fields');
    if (password.length < 6) redirect('/admin?error=password');
    if (!['admin', 'employee'].includes(role)) redirect('/admin?error=fields');
    const dup = await one('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (dup) redirect('/admin?error=duplicate');

    await q(
      'INSERT INTO users (email, full_name, password_hash, role, position, specialization) VALUES ($1,$2,$3,$4,$5,$6)',
      [email, fullName, await hashPassword(password), role, position, spec]
    );
    redirect('/admin?ok=created');
  }

  async function toggleActive(formData) {
    'use server';
    const me = await currentUser();
    if (!isAdmin(me)) redirect('/tasks?error=forbidden');
    const id = Number(formData.get('user_id'));
    if (id === me.id) redirect('/admin?error=self');
    const target = await one('SELECT * FROM users WHERE id = $1', [id]);
    if (!target) redirect('/admin?error=fields');
    // Нельзя отключить последнего активного администратора.
    if (target.role === 'admin' && target.is_active) {
      const left = await one("SELECT COUNT(*)::int AS c FROM users WHERE role='admin' AND is_active = true");
      if (left.c <= 1) redirect('/admin?error=lastadmin');
    }
    await q('UPDATE users SET is_active = NOT is_active WHERE id = $1', [id]);
    if (target.is_active) await q('DELETE FROM sessions WHERE user_id = $1', [id]);
    redirect('/admin?ok=toggled');
  }

  const messages = {
    fields: 'Проверьте email и имя сотрудника.',
    password: 'Пароль — минимум 6 символов.',
    duplicate: 'Сотрудник с таким email уже есть.',
    self: 'Себя отключать нельзя.',
    lastadmin: 'Это последний активный администратор — его нельзя отключить.',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Сотрудники</h1>

      {sp?.error && <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-sm font-medium text-rose">{messages[sp.error] || 'Ошибка.'}</p>}
      {sp?.ok && <p className="rounded-lg bg-mint/10 px-3 py-2 text-sm font-medium text-mint">Сохранено.</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2">Сотрудник</th><th className="pb-2">Email</th><th className="pb-2">Должность</th>
              <th className="pb-2">Специализация</th><th className="pb-2">Роль</th><th className="pb-2">Открытых</th>
              <th className="pb-2">Статус</th><th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2 font-semibold">{u.full_name}</td>
                <td className="py-2 text-slate-600">{u.email}</td>
                <td className="py-2 text-slate-600">{u.position || '—'}</td>
                <td className="py-2 text-slate-600">{u.specialization || '—'}</td>
                <td className="py-2">{u.role === 'admin' ? 'администратор' : 'сотрудник'}</td>
                <td className="py-2">{u.open_tasks}</td>
                <td className="py-2">
                  <span className={`chip ${u.is_active ? 'bg-mint/15 text-mint' : 'bg-slate-100 text-slate-500'}`}>
                    {u.is_active ? 'активен' : 'отключён'}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <form action={toggleActive}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <button className="text-xs font-semibold text-sky hover:underline" type="submit">
                      {u.is_active ? 'отключить' : 'включить'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="card grid gap-4 sm:grid-cols-2" action={createUser}>
        <h2 className="sm:col-span-2 text-lg font-bold">Добавить сотрудника</h2>
        <div><label className="label" htmlFor="full_name">Имя и фамилия *</label><input className="field" id="full_name" name="full_name" required /></div>
        <div><label className="label" htmlFor="email">Email *</label><input className="field" id="email" name="email" type="email" required /></div>
        <div><label className="label" htmlFor="position">Должность</label><input className="field" id="position" name="position" /></div>
        <div>
          <label className="label" htmlFor="specialization">Специализация (для авто-распределения)</label>
          <select className="field" id="specialization" name="specialization" defaultValue="">
            <option value="">не задана</option>
            {CATEGORIES.filter((c) => c !== 'Прочее').map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="role">Роль</label>
          <select className="field" id="role" name="role" defaultValue="employee">
            <option value="employee">сотрудник</option><option value="admin">администратор</option>
          </select>
        </div>
        <div><label className="label" htmlFor="password">Пароль * (от 6 символов)</label><input className="field" id="password" name="password" type="password" minLength={6} required /></div>
        <div className="sm:col-span-2"><button className="btn-primary" type="submit">Добавить</button></div>
      </form>
    </div>
  );
}
