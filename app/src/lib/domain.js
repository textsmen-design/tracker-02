/** Tracker_02 (TaskFlow) — словари и общие серверные операции над задачами. */
import { q, one } from './db';

export const STATUSES = { new: 'Новая', in_progress: 'В работе', review: 'На проверке', done: 'Выполнена' };
export const PRIORITIES = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
export const CATEGORIES = ['Разработка', 'Дизайн', 'Маркетинг', 'Продажи', 'Поддержка', 'Документы', 'Прочее'];

export const statusLabel = (s) => STATUSES[s] || s;

/** 'YYYY-MM-DD' → 'DD.MM.YYYY'; пусто → 'без срока'. */
export function formatDate(value) {
  if (!value) return 'без срока';
  const iso = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return iso.split('-').reverse().join('.');
}

/** Просрочена ли задача (срок в прошлом и статус не «выполнена»). */
export function isOverdue(task, today = new Date().toISOString().slice(0, 10)) {
  if (!task.due_date || task.status === 'done') return false;
  return String(task.due_date).slice(0, 10) < today;
}
export const priorityLabel = (p) => PRIORITIES[p] || p;

/** Сотрудники с числом незавершённых задач — для авто-распределения и селектов. */
export function employeesWithLoad() {
  return q(
    `SELECT u.id, u.full_name, u.position, u.specialization,
            COUNT(t.id) FILTER (WHERE t.status <> 'done') AS open_tasks
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY u.full_name`
  );
}

export function logHistory(taskId, userId, action) {
  return q('INSERT INTO task_history (task_id, user_id, action) VALUES ($1,$2,$3)', [taskId, userId, action]);
}

export function findTask(id) {
  return one('SELECT * FROM tasks WHERE id = $1', [id]);
}

/** Сотрудник видит только свои задачи (созданные им или назначенные ему). */
export function canViewTask(user, task) {
  if (!task) return false;
  if (user.role === 'admin') return true;
  return task.assignee_id === user.id || task.creator_id === user.id;
}

/** Менять задачу целиком может админ; сотрудник — только статус своей задачи. */
export function canEditTask(user, task) {
  return user.role === 'admin';
}
export function canChangeStatus(user, task) {
  if (!task) return false;
  return user.role === 'admin' || task.assignee_id === user.id;
}
