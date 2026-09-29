import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, isAdmin } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { STATUSES, PRIORITIES, employeesWithLoad, logHistory } from '@/lib/domain';
import { categorize, suggestAssignee } from '@/lib/ai';

export default async function NewTaskPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const sp = await searchParams;
  const employees = await employeesWithLoad();

  async function createTask(formData) {
    'use server';
    const me = await currentUser();
    if (!me) redirect('/login');

    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const priorityIn = String(formData.get('priority') || '');
    const dueRaw = String(formData.get('due_date') || '').trim();
    const useAi = formData.get('use_ai') === '1';
    let assigneeId = Number(formData.get('assignee_id') || 0);

    if (title.length < 3) redirect('/tasks/new?error=title');
    if (dueRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) redirect('/tasks/new?error=date');

    // Сотрудник ставит задачи только на себя — проверка на сервере, не только в форме.
    if (!isAdmin(me)) assigneeId = me.id;

    const ai = categorize(title, description);
    let category = ai.category;
    let priority = PRIORITIES[priorityIn] ? priorityIn : ai.priority;
    let aiAssigned = false;
    let reason = `категория: ${ai.reason}`;

    if (isAdmin(me) && useAi) {
      const pick = suggestAssignee(category, employees);
      if (pick) {
        assigneeId = pick.id;
        aiAssigned = true;
        reason += `; исполнитель ${pick.full_name} — наименьшая загрузка (${pick.open_tasks} откр.)`;
      }
    }

    if (!assigneeId) redirect('/tasks/new?error=assignee');
    const exists = await one('SELECT id FROM users WHERE id = $1 AND is_active = true', [assigneeId]);
    if (!exists) redirect('/tasks/new?error=assignee');

    const row = await one(
      `INSERT INTO tasks (title, description, status, priority, category, ai_reason, ai_assigned, assignee_id, creator_id, due_date)
       VALUES ($1,$2,'new',$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [title, description, priority, category, reason, aiAssigned, assigneeId, me.id, dueRaw || null]
    );
    await logHistory(row.id, me.id, 'Задача создана');
    redirect('/tasks');
  }

  const errors = {
    title: 'Название задачи — минимум 3 символа.',
    date: 'Некорректная дата срока.',
    assignee: 'Выберите исполнителя или включите авто-распределение.',
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Новая задача</h1>
      {sp?.error && (
        <p role="alert" className="rounded-lg bg-rose/10 px-3 py-2 text-sm font-medium text-rose">
          {errors[sp.error] || 'Проверьте заполнение формы.'}
        </p>
      )}

      <form className="card space-y-4" action={createTask}>
        <div>
          <label className="label" htmlFor="title">Название *</label>
          <input className="field" id="title" name="title" required minLength={3} maxLength={200} />
        </div>
        <div>
          <label className="label" htmlFor="description">Описание</label>
          <textarea className="field" id="description" name="description" rows={4} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="priority">Приоритет</label>
            <select className="field" id="priority" name="priority" defaultValue="">
              <option value="">определит модуль</option>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="due_date">Срок (необязательно)</label>
            <input className="field" id="due_date" name="due_date" type="date" />
          </div>
        </div>

        {isAdmin(user) ? (
          <>
            <div>
              <label className="label" htmlFor="assignee_id">Исполнитель</label>
              <select className="field" id="assignee_id" name="assignee_id" defaultValue="">
                <option value="">— выберите сотрудника —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}{e.specialization ? ` — ${e.specialization}` : ''} (открытых: {e.open_tasks})
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-2 rounded-lg bg-mint/10 p-3 text-sm">
              <input type="checkbox" name="use_ai" value="1" className="mt-0.5" />
              <span>
                <b>Авто-распределение модулем</b> — категория определяется по тексту задачи,
                исполнитель выбирается по специализации и наименьшей загрузке.
                <span className="block text-xs text-slate-500">
                  Офлайн-классификатор по ключевым словам (не нейросеть). Замена на OpenAI API —
                  одна функция в src/lib/ai.js, ключ клиента не подключён.
                </span>
              </span>
            </label>
          </>
        ) : (
          <div>
            <span className="label">Исполнитель</span>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              {user.full_name} <span className="text-slate-500">(сотрудник ставит задачи только на себя)</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn-primary" type="submit">Создать задачу</button>
          <Link className="btn-ghost" href="/tasks">Отмена</Link>
        </div>
      </form>
    </div>
  );
}
