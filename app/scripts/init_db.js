/** Tracker_02 (TaskFlow) — демо-данные для локального запуска. Пароль всех демо-учёток: demo123. */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '',
  database: process.env.PGDATABASE || 'taskflow',
});

const USERS = [
  ['admin@taskflow.ru',  'Ирина Лазарева', 'admin',    'Операционный директор', ''],
  ['egor@taskflow.ru',   'Егор Панин',     'employee', 'Front-end разработчик', 'Разработка'],
  ['vera@taskflow.ru',   'Вера Кузьмина',  'employee', 'Дизайнер',              'Дизайн'],
  ['nikita@taskflow.ru', 'Никита Ершов',   'employee', 'Маркетолог',            'Маркетинг'],
  ['sofia@taskflow.ru',  'София Град',     'employee', 'Менеджер по продажам',  'Продажи'],
];

const TASKS = [
  ['Починить баг в API авторизации', 'После деплоя падает вход по email.', 'in_progress', 'Разработка', 2, 1, 'high', 3],
  ['Сверстать лендинг рассылки',     'Нужна вёрстка по макету из Figma.',   'new',         'Разработка', 2, 1, 'medium', 7],
  ['Макет баннера для акции',        'Баннер 1200×400 под рекламу.',        'new',         'Дизайн',     3, 1, 'medium', 5],
  ['Запустить рекламную кампанию',   'Контекст + СММ на две недели.',       'in_progress', 'Маркетинг',  4, 1, 'medium', 10],
  ['Выставить счёт клиенту «Орион»', 'Договор подписан, нужен счёт.',       'review',      'Продажи',    5, 1, 'high', 1],
  ['Обновить регламент отпусков',    'Документ для отдела кадров.',         'done',        'Документы',  5, 1, 'low', -3],
  ['Разобрать обращения поддержки',  'Накопились тикеты за неделю.',        'new',         'Поддержка',  4, 1, 'medium', null],
  ['Сдать отчёт по рекламной кампании','Срок прошёл, отчёт всё ещё не сдан.','in_progress', 'Маркетинг',  4, 1, 'high', -4],
];

(async () => {
  const hash = await bcrypt.hash('demo123', 10);
  await pool.query('TRUNCATE task_history, sessions, tasks, users RESTART IDENTITY CASCADE');
  for (const [email, name, role, position, spec] of USERS) {
    await pool.query(
      'INSERT INTO users (email, full_name, password_hash, role, position, specialization) VALUES ($1,$2,$3,$4,$5,$6)',
      [email, name, hash, role, position, spec]
    );
  }
  for (const [title, descr, status, cat, assignee, creator, prio, dueIn] of TASKS) {
    const due = dueIn === null ? null : new Date(Date.now() + dueIn * 86400000).toISOString().slice(0, 10);
    const r = await pool.query(
      `INSERT INTO tasks (title, description, status, category, assignee_id, creator_id, priority, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [title, descr, status, cat, assignee, creator, prio, due]
    );
    await pool.query('INSERT INTO task_history (task_id, user_id, action) VALUES ($1,$2,$3)', [r.rows[0].id, creator, 'Задача создана']);
  }
  const c = await pool.query('SELECT (SELECT COUNT(*) FROM users) u, (SELECT COUNT(*) FROM tasks) t');
  console.log('Демо-данные загружены: пользователей', c.rows[0].u, ', задач', c.rows[0].t);
  await pool.end();
})().catch((e) => { console.error('Ошибка:', e.message); process.exit(1); });
