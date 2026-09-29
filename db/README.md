# База данных Tracker_02 «TaskFlow» (PostgreSQL 16)

Создание БД и схемы:

    createdb -h 127.0.0.1 -U postgres taskflow
    psql -h 127.0.0.1 -U postgres -d taskflow -f db/schema.sql
    node app/scripts/init_db.js     # демо-данные (пароль demo123)

Демо-учётки после `init_db.js`:

| Роль     | Email             | Пароль  |
|----------|-------------------|---------|
| admin    | admin@taskflow.ru | demo123 |
| employee | egor@taskflow.ru  | demo123 |
| employee | vera@taskflow.ru  | demo123 |
| employee | nikita@taskflow.ru| demo123 |
| employee | sofia@taskflow.ru | demo123 |

Пароли демонстрационные и предназначены только для локального запуска.
Реальные секреты в репозиторий не коммитятся (см. .gitignore: .env*, node_modules).
