import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, isAdmin } from '@/lib/auth';
import { q } from '@/lib/db';
import { STATUSES, PRIORITIES, CATEGORIES, statusLabel, priorityLabel, formatDate, isOverdue, findTask, canChangeStatus, logHistory } from '@/lib/domain';

const statusChip = {
  new: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-sky/10 text-sky',
  review: 'bg-amber/15 text-amber',
  done: 'bg-mint/15 text-mint',
};
const prioChip = { low: 'bg-slate-100 text-slate-600', medium: 'bg-sky/10 text-sky', high: 'bg-rose/10 text-rose' };

export default async function TasksPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;

  const fStatus = STATUSES[sp?.status] ? sp.status : '';
  const fCategory = CATEGORIES.includes(sp?.category) ? sp.category : '';
  const fAssignee = /^\d+$/.test(sp?.assignee || '') ? Number(sp.assignee) : 0;
  const fQuery = (sp?.q || '').trim();
  const mineOnly = sp?.mine === '1';

  const where = [];
  const args = [];
  // Сотрудник видит только свои задачи — фильтр прав на уровне SQL.
  if (!isAdmin(user)) { args.push(user.id); where.push(`(t.assignee_id = $${args.length} OR t.creator_id = $${args.length})`); }
  if (mineOnly) { args.push(user.id); where.push(`t.assignee_id = $${args.length}`); }
  if (fStatus) { args.push(fStatus); where.push(`t.status = $${args.length}`); }
  if (fCategory) { args.push(fCategory); where.push(`t.category = $${args.length}`); }
  if (fAssignee) { args.push(fAssignee); where.push(`t.assignee_id = $${args.length}`); }
  if (fQuery) { args.push('%' + fQuery + '%'); where.push(`t.title ILIKE $${args.length}`); }

  const tasks = await q(
    `SELECT t.*, u.full_name AS assignee_name, c.full_name AS creator_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users c ON c.id = t.creator_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY (t.status = 'done'), t.due_date NULLS LAST, t.id DESC`,
    args
  );
  const employees = await q("SELECT id, full_name FROM users WHERE is_active = true ORDER BY full_name");

  async function changeStatus(formData) {
    'use server';
    const me = await currentUser();
    if (!me) redirect('/login');
    const id = Number(formData.get('task_id'));
    const status = String(formData.get('status'));
    if (!STATUSES[status]) redirect('/tasks?error=status');
    const task = await findTask(id);
    if (!canChangeStatus(me, task)) redirect('/tasks?error=forbidden');
    await q('UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2', [status, id]);
    await logHistory(id, me.id, `Статус → ${STATUSES[status]}`);
    redirect('/tasks');
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Задачи</h1>
        <span className="chip bg-slate-100 text-slate-600">{tasks.length} шт.</span>
        <Link className="btn-primary ml-auto" href="/tasks/new">+ Новая задача</Link>
      </div>

      {sp?.error === 'forbidden' && (
        <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-sm font-medium text-rose">
          Нет прав на изменение этой задачи.
        </p>
      )}

      <form className="card grid gap-3 md:grid-cols-5" method="get" action="/tasks">
        <div className="md:col-span-2">
          <label className="label" htmlFor="q">Поиск по названию</label>
          <input className="field" id="q" name="q" defaultValue={fQuery} placeholder="например: баннер" />
        </div>
        <div>
          <label className="label" htmlFor="status">Статус</label>
          <select className="field" id="status" name="status" defaultValue={fStatus}>
            <option value="">все</option>
            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category">Категория</label>
          <select className="field" id="category" name="category" defaultValue={fCategory}>
            <option value="">все</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {isAdmin(user) ? (
          <div>
            <label className="label" htmlFor="assignee">Исполнитель</label>
            <select className="field" id="assignee" name="assignee" defaultValue={String(fAssignee || '')}>
              <option value="">все</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
        ) : (
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={mineOnly} /> только мои
          </label>
        )}
        <div className="md:col-span-5 flex gap-2">
          <button className="btn-primary" type="submit">Применить</button>
          <Link className="btn-ghost" href="/tasks">Сбросить</Link>
        </div>
      </form>

      {tasks.length === 0 && <p className="text-slate-500">Задач по заданным условиям не найдено.</p>}

      <div className="grid gap-3">
        {tasks.map((t) => {
          const overdue = isOverdue(t, today);
          return (
            <article key={t.id} className={`card ${overdue ? 'border-rose/40' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold">{t.title}</h2>
                <span className={`chip ${statusChip[t.status]}`}>{statusLabel(t.status)}</span>
                <span className={`chip ${prioChip[t.priority]}`}>{priorityLabel(t.priority)}</span>
                <span className="chip bg-ink/5 text-ink">{t.category}</span>
                {t.ai_assigned && <span className="chip bg-mint/15 text-mint" title={t.ai_reason}>авто-распределение</span>}
              </div>
              {t.description && <p className="mt-2 text-sm text-slate-600">{t.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                <span>Исполнитель: <b className="text-ink">{t.assignee_name || 'не назначен'}</b></span>
                <span>Поставил: {t.creator_name}</span>
                <span className={overdue ? 'font-semibold text-rose' : ''}>
                  Срок: {formatDate(t.due_date)}{overdue ? ' · просрочена' : ''}
                </span>
                {t.ai_reason && <span className="text-xs text-slate-400">ИИ-модуль: {t.ai_reason}</span>}
              </div>
              {canChangeStatus(user, t) && (
                <form className="mt-3 flex items-center gap-2" action={changeStatus}>
                  <input type="hidden" name="task_id" value={t.id} />
                  <label className="text-xs font-semibold uppercase text-slate-500" htmlFor={`st-${t.id}`}>Статус</label>
                  <select className="field max-w-[190px]" id={`st-${t.id}`} name="status" defaultValue={t.status}>
                    {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="btn-ghost" type="submit">Сохранить</button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
