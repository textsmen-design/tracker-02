#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${TRACKER02_REPO:-https://github.com/textsmen-design/tracker-02.git}"
BRANCH="${TRACKER02_BRANCH:-main}"
APP_DIR="${TRACKER02_APP_DIR:-/opt/tracker-02}"
STAGE_DIR="${TRACKER02_STAGE_DIR:-/var/tmp/tracker-02-src}"
SERVICE="${TRACKER02_SERVICE:-tracker-02}"

echo "[deploy] repo=${REPO_URL} branch=${BRANCH}"

if [ -d "${STAGE_DIR}/.git" ]; then
  git -C "${STAGE_DIR}" remote set-url origin "${REPO_URL}"
  git -C "${STAGE_DIR}" fetch --depth 1 origin "${BRANCH}"
  git -C "${STAGE_DIR}" checkout -f "${BRANCH}"
  git -C "${STAGE_DIR}" reset --hard "origin/${BRANCH}"
else
  rm -rf "${STAGE_DIR}"
  git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${STAGE_DIR}"
fi

COMMIT="$(git -C "${STAGE_DIR}" rev-parse HEAD)"
echo "[deploy] commit=${COMMIT}"

mkdir -p "${APP_DIR}"

rsync -a --delete \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'node_modules/' --exclude '.next/' --exclude 'db/' \
  "${STAGE_DIR}/app/" "${APP_DIR}/"

mkdir -p "${APP_DIR}/db"
rsync -a --delete "${STAGE_DIR}/db/" "${APP_DIR}/db/"

cd "${APP_DIR}"
if [ ! -f .env ] && [ -f .env.example ]; then
  echo "[deploy] ВНИМАНИЕ: ${APP_DIR}/.env отсутствует — создайте его из .env.example"
fi

NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=900}" npm run build

systemctl restart "${SERVICE}"
sleep 5

if systemctl is-active --quiet "${SERVICE}"; then
  echo "[deploy] ${SERVICE} active, commit=${COMMIT}"
else
  echo "[deploy] ОШИБКА: ${SERVICE} не запустился" >&2
  journalctl -u "${SERVICE}" -n 30 --no-pager >&2
  exit 1
fi
