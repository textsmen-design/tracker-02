-- ============================================================
-- Tracker_02 «TaskFlow» — схема PostgreSQL
-- Кейс №2 (freelance.ru #1656833) — задачи, сотрудники, роли
-- Обозначения: [ЗАКАЗ] = из описания клиента, [УРОК] = учебное расширение
-- ============================================================

DROP TABLE IF EXISTS task_history, sessions, tasks, users CASCADE;

-- Пользователи [ЗАКАЗ: регистрация/авторизация, панель администратора]
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(190) NOT NULL UNIQUE,
  full_name      VARCHAR(160) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20)  NOT NULL DEFAULT 'employee'
                 CHECK (role IN ('admin','employee')),
  position       VARCHAR(120) DEFAULT '',        -- должность [УРОК]
  specialization VARCHAR(60)  DEFAULT '',        -- для авто-распределения [УРОК]
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP    NOT NULL DEFAULT now()
);

-- Сессии [УРОК: замена Supabase Auth, см. src/lib/auth.js]
CREATE TABLE sessions (
  token      VARCHAR(64) PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Задачи [ЗАКАЗ: создание, назначение, статус, фильтрация]
CREATE TABLE tasks (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  description  TEXT DEFAULT '',
  status       VARCHAR(20) NOT NULL DEFAULT 'new'
               CHECK (status IN ('new','in_progress','review','done')),
  priority     VARCHAR(10) NOT NULL DEFAULT 'medium'
               CHECK (priority IN ('low','medium','high')),
  category     VARCHAR(60) DEFAULT 'Прочее',     -- заполняет ИИ-модуль [ЗАКАЗ]
  ai_reason    TEXT DEFAULT '',                  -- объяснение решения модуля [УРОК]
  ai_assigned  BOOLEAN NOT NULL DEFAULT FALSE,   -- исполнитель выбран модулем [УРОК]
  assignee_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  creator_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date     DATE,
  created_at   TIMESTAMP NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status   ON tasks(status);

-- История изменений [УРОК: контроль прогресса]
CREATE TABLE task_history (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
