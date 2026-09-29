# DEPLOY — Tracker_02 «TaskFlow»

## Source of truth

**GitHub-репозиторий:** https://github.com/textsmen-design/tracker-02

Код на production берётся **только** из этого репозитория (ветка `main`).
Любое изменение прода сначала попадает в GitHub, затем разворачивается на VDS.
Прямая правка файлов на сервере без коммита в GitHub — нарушение процесса.

## Production

| Параметр | Значение |
|---|---|
| URL | https://tracker-02.gonka.blog |
| VDS | VDS #1 `62.109.5.155` (FirstVDS, Москва) |
| Путь | `/opt/tracker-02` (содержимое `app/` из репозитория) |
| Сервис | `tracker-02.service` (systemd, `Restart=always`, порт `127.0.0.1:3002`) |
| БД | PostgreSQL 16, база `taskflow`, пользователь `tracker02` |
| Веб-сервер | Nginx reverse proxy + Let's Encrypt |
| Домен | wildcard `*.gonka.blog` (DNS не меняется) |

Секреты (`.env`, `PGPASSWORD`) на VDS — `/opt/tracker-02/.env` (`chmod 600`),
пароль БД — `/root/.tracker02_dbpass` (`chmod 600`). В GitHub не хранятся.

## Раскладка репозитория → VDS

```
repo/app/   → /opt/tracker-02/        (Next.js-приложение)
repo/db/    → /opt/tracker-02/db/     (схема PostgreSQL)
```

## Деплой из репозитория

```bash
# на локальной машине: зафиксировать и отправить изменение
git add -A && git commit -m "..." && git push origin main

# на VDS #1
bash scripts/deploy.sh
```

`scripts/deploy.sh` клонирует/обновляет репозиторий во временный каталог,
синхронизирует `app/` и `db/` в `/opt/tracker-02`, пересобирает приложение и
перезапускает сервис. Секреты (`.env`) и `node_modules` при синхронизации не
затрагиваются.

## Проверка после деплоя (VERIFY)

```bash
systemctl is-active tracker-02                       # active
curl -s -o /dev/null -w '%{http_code}\n' https://tracker-02.gonka.blog/login   # 200
```

Соответствие production коду из GitHub проверяется сравнением git-blob SHA
файлов `app/` в репозитории и в `/opt/tracker-02`.

## Правила

- Не трогать Tracker_01 (`/var/www/tracker-01`) и его БД.
- Не менять DNS.
- Секреты, `node_modules` и сборочные артефакты в GitHub не отправляются.
