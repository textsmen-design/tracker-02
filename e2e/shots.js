/** Tracker_02 «TaskFlow» — реальные скриншоты по фактически пройденному сценарию. */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, '..', 'doc', 'screenshots', process.env.SHOT_DIR || 'final');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    defaultViewport: { width: 1440, height: 900 }, args: ['--no-first-run', '--no-sandbox'],
  });
  const shot = async (page, name) => {
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('shot:', name);
  };
  const ctxPage = async (w = 1440, h = 900) => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: w, height: h });
    return p;
  };
  const login = async (p, email) => {
    await p.goto(BASE + '/login', { waitUntil: 'networkidle2' });
    await p.type('#email', email);
    await p.type('#password', 'demo123');
    await Promise.all([
      p.waitForNavigation({ waitUntil: 'networkidle2' }),
      p.evaluate(() => document.getElementById('password').closest('form').querySelector('button[type=submit]').click()),
    ]);
  };
  const submit = async (p, fieldId) => {
    await Promise.all([
      p.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
      p.evaluate((id) => document.getElementById(id).closest('form').querySelector('button[type=submit]').click(), fieldId),
    ]);
  };

  const admin = await ctxPage();
  await admin.goto(BASE + '/login', { waitUntil: 'networkidle2' });
  await shot(admin, '01_login');

  await login(admin, 'admin@taskflow.ru');
  await shot(admin, '02_tasks_admin');

  await admin.goto(BASE + '/tasks/new', { waitUntil: 'networkidle2' });
  await shot(admin, '03_task_new_form');

  await admin.type('#title', 'Подготовить макет баннера для акции');
  await admin.type('#description', 'Нужен макет баннера в Figma, срочно к пятнице.');
  await admin.click('input[name=use_ai]');
  await shot(admin, '04_task_new_ai_enabled');
  await submit(admin, 'title');
  await shot(admin, '05_task_created_autoassigned');

  await admin.goto(BASE + '/tasks?category=' + encodeURIComponent('Дизайн'), { waitUntil: 'networkidle2' });
  await shot(admin, '06_filter_by_category');

  await admin.goto(BASE + '/tasks?status=done', { waitUntil: 'networkidle2' });
  await shot(admin, '07_filter_by_status');

  await admin.goto(BASE + '/admin', { waitUntil: 'networkidle2' });
  await shot(admin, '08_admin_users');

  const worker = await ctxPage();
  await login(worker, 'egor@taskflow.ru');
  await shot(worker, '09_tasks_employee');
  await worker.goto(BASE + '/tasks/new', { waitUntil: 'networkidle2' });
  await shot(worker, '10_employee_no_assignee_choice');
  await worker.goto(BASE + '/admin', { waitUntil: 'networkidle2' });
  await shot(worker, '11_employee_admin_forbidden');

  const mob = await ctxPage(390, 844);
  await login(mob, 'egor@taskflow.ru');
  await shot(mob, '12_mobile_tasks_390');

  console.log('Готово →', OUT);
  await browser.close();
})().catch((e) => { console.error('ОШИБКА:', e.message); process.exit(1); });
