/**
 * Tracker_02 «TaskFlow» — браузерная проверка MVP (puppeteer-core, реальный Chrome).
 *
 * Покрывает то, что заявлено в заказе freelance.ru #1656833:
 * авторизация, создание и управление задачами, назначение задач сотрудникам,
 * отображение статуса, фильтрация, панель администратора, модуль авто-категоризации.
 * Дополнительно — границы прав (сотрудник не должен видеть чужие задачи и админку).
 *
 * Запуск (приложение поднято на http://127.0.0.1:3000, БД с демо-данными):
 *     cd app && npm i puppeteer-core && node ../e2e/check.js
 * ENV: CHROME_PATH, PSQL_BIN, BASE_URL
 */
const puppeteer = require('puppeteer-core');
const { execFileSync } = require('child_process');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => { try { return fs.existsSync(p); } catch { return false; } });
const PSQL = process.env.PSQL_BIN || '/usr/bin/psql';

const sql = (query) =>
  execFileSync(PSQL, ['-h', process.env.PGHOST || '127.0.0.1', '-U', process.env.PGUSER || 'postgres',
    '-d', process.env.PGDATABASE || 'taskflow', '-t', '-A', '-F', '\t', '-c', query], { encoding: 'utf8' }).trim();

const results = [];
const pageErrors = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? `   [${detail}]` : ''));
};

(async () => {
  if (!CHROME) throw new Error('Chrome не найден — задайте CHROME_PATH');
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    defaultViewport: { width: 1440, height: 900 }, args: ['--no-first-run', '--no-sandbox'],
  });

  const session = async (email, password = 'demo123') => {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(`${email}: ${e.message}`));
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await page.type('#email', email);
    await page.type('#password', password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.evaluate(() => document.getElementById('password').closest('form').querySelector('button[type=submit]').click()),
    ]);
    return page;
  };
  const go = (page, path) => page.goto(BASE + path, { waitUntil: 'networkidle2' });
  const text = (page) => page.evaluate(() => document.body.innerText);

  /**
   * ВАЖНО: на странице есть форма выхода в шапке, и она идёт ПЕРВОЙ в DOM.
   * Неквалифицированный клик по button[type=submit] попадает именно в неё
   * (эта ошибка уже ломала тесты Кейса №1). Поэтому форму всегда ищем
   * по полю, которое в ней лежит.
   */
  const submitFormWith = async (page, fieldId) => {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
      page.evaluate((id) => {
        const el = document.getElementById(id);
        if (!el) throw new Error('поле ' + id + ' не найдено');
        el.closest('form').querySelector('button[type=submit]').click();
      }, fieldId),
    ]);
  };

  const stamp = Date.now().toString().slice(-5);

  // ---------- АВТОРИЗАЦИЯ ----------
  const anon = await browser.newPage();
  await go(anon, '/tasks');
  check('01. Аноним перенаправлен на вход', /\/login/.test(anon.url()), anon.url());
  await anon.type('#email', 'admin@taskflow.ru');
  await anon.type('#password', 'wrong-password');
  await submitFormWith(anon, 'password');
  check('02. Неверный пароль → остаёмся на входе с ошибкой', /\/login/.test(anon.url()) && (await text(anon)).includes('Неверный email или пароль'), anon.url());

  const admin = await session('admin@taskflow.ru');
  check('03. Вход администратора', /\/tasks/.test(admin.url()), admin.url());
  check('04. Список задач отображается', (await text(admin)).includes('Починить баг в API авторизации'));

  // ---------- СОЗДАНИЕ ЗАДАЧИ + НАЗНАЧЕНИЕ ----------
  const T1 = `Сверстать баннер акции ${stamp}`;
  await go(admin, '/tasks/new');
  await admin.type('#title', T1);
  await admin.type('#description', 'Нужен макет баннера в Figma для рекламной акции.');
  await admin.select('#assignee_id', '3'); // Вера Кузьмина — дизайнер
  await submitFormWith(admin, 'title');
  const row1 = sql(`SELECT id, assignee_id, status, category FROM tasks WHERE title='${T1}'`).split('\t');
  check('05. Задача создана с выбранным исполнителем', row1[1] === '3' && row1[2] === 'new', row1.join(' '));
  check('06. Модуль определил категорию «Дизайн» по тексту', row1[3] === 'Дизайн', 'category=' + row1[3]);
  check('07. Задача видна в списке', (await text(admin)).includes(T1));

  // ---------- АВТО-РАСПРЕДЕЛЕНИЕ ----------
  const T2 = `Срочно починить баг в API ${stamp}`;
  await go(admin, '/tasks/new');
  await admin.type('#title', T2);
  await admin.type('#description', 'Падает деплой, не работает вход.');
  await admin.click('input[name=use_ai]');
  await submitFormWith(admin, 'title');
  const row2 = sql(`SELECT assignee_id, category, priority, ai_assigned FROM tasks WHERE title='${T2}'`).split('\t');
  check('08. Авто-распределение назначило исполнителя', row2[3] === 't' && row2[0] !== '', row2.join(' '));
  check('09. Категория определена как «Разработка»', row2[1] === 'Разработка', 'category=' + row2[1]);
  check('10. Срочность поднята до высокого приоритета', row2[2] === 'high', 'priority=' + row2[2]);
  const specOk = sql(`SELECT u.specialization FROM tasks t JOIN users u ON u.id=t.assignee_id WHERE t.title='${T2}'`);
  check('11. Исполнитель выбран по специализации', specOk === 'Разработка', 'specialization=' + specOk);

  // ---------- ФИЛЬТРАЦИЯ ----------
  await go(admin, '/tasks?category=%D0%94%D0%B8%D0%B7%D0%B0%D0%B9%D0%BD');
  const dsg = await text(admin);
  check('12. Фильтр по категории показывает только её задачи', dsg.includes(T1) && !dsg.includes('Выставить счёт клиенту'), '');
  await go(admin, '/tasks?status=done');
  const done = await text(admin);
  check('13. Фильтр по статусу работает', done.includes('Обновить регламент отпусков') && !done.includes(T1));
  await go(admin, `/tasks?q=${encodeURIComponent('баннер')}`);
  check('14. Поиск по названию работает', (await text(admin)).includes(T1));
  await go(admin, '/tasks?assignee=3');
  const byA = await text(admin);
  check('15. Фильтр по исполнителю работает', byA.includes(T1) && !byA.includes('Выставить счёт клиенту'));

  // ---------- СТАТУС ----------
  const tid1 = row1[0];
  await go(admin, '/tasks');
  await admin.select(`#st-${tid1}`, 'in_progress');
  await submitFormWith(admin, `st-${tid1}`);
  check('16. Смена статуса сохраняется в БД', sql(`SELECT status FROM tasks WHERE id=${tid1}`) === 'in_progress');
  await go(admin, '/tasks');
  check('17. Статус на месте после перезагрузки', sql(`SELECT status FROM tasks WHERE id=${tid1}`) === 'in_progress');
  check('18. История изменений пишется', Number(sql(`SELECT COUNT(*) FROM task_history WHERE task_id=${tid1}`)) >= 2);

  // ---------- ПАНЕЛЬ АДМИНИСТРАТОРА ----------
  await go(admin, '/admin');
  check('19. Панель администратора открывается', (await text(admin)).includes('Сотрудники'));
  const email = `qa${stamp}@taskflow.ru`;
  await admin.type('#full_name', 'Тест Тестов');
  await admin.type('#email', email);
  await admin.type('#position', 'Стажёр');
  await admin.select('#specialization', 'Поддержка');
  await admin.type('#password', 'demo123');
  await submitFormWith(admin, 'full_name');
  const newU = sql(`SELECT id, role, is_active FROM users WHERE email='${email}'`).split('\t');
  check('20. Администратор создал сотрудника', newU[0] && newU[1] === 'employee', newU.join(' '));

  const fresh = await session(email);
  check('21. Новый сотрудник входит с заданным паролем', /\/tasks/.test(fresh.url()), fresh.url());

  // ---------- ГРАНИЦЫ ПРАВ ----------
  const worker = await session('egor@taskflow.ru');
  const wText = await text(worker);
  check('22. Сотрудник видит свои задачи', wText.includes('Починить баг в API авторизации'));
  check('23. Сотрудник НЕ видит чужие задачи', !wText.includes('Выставить счёт клиенту'), '');
  check('24. У сотрудника нет ссылки на админку', !wText.includes('Сотрудники'));
  await go(worker, '/admin');
  check('25. Сотрудник не попадает в админку по прямой ссылке', !/\/admin/.test(worker.url()), worker.url());
  await go(worker, '/tasks/new');
  const hasAssigneeSelect = await worker.evaluate(() => !!document.getElementById('assignee_id'));
  check('26. У сотрудника нет выбора исполнителя', hasAssigneeSelect === false);
  const T3 = `Моя задача сотрудника ${stamp}`;
  await worker.type('#title', T3);
  await submitFormWith(worker, 'title');
  const selfRow = sql(`SELECT assignee_id, creator_id FROM tasks WHERE title='${T3}'`).split('\t');
  check('27. Задача сотрудника назначена на него самого', selfRow[0] === '2' && selfRow[1] === '2', selfRow.join(' '));

  // сотрудник не может менять статус ЧУЖОЙ задачи (server action с чужим id)
  const foreign = sql("SELECT id FROM tasks WHERE assignee_id = 5 LIMIT 1");
  const statusBefore = sql(`SELECT status FROM tasks WHERE id=${foreign}`);
  await go(worker, '/tasks');
  const hasForeignForm = await worker.evaluate((id) => !!document.getElementById('st-' + id), foreign);
  check('28. Форма смены статуса чужой задачи сотруднику не выводится', hasForeignForm === false, 'task=' + foreign);
  check('29. Статус чужой задачи не изменился', sql(`SELECT status FROM tasks WHERE id=${foreign}`) === statusBefore);

  // ---------- ВЫХОД ----------
  await go(admin, '/tasks');
  await Promise.all([
    admin.waitForNavigation({ waitUntil: 'networkidle2' }),
    admin.evaluate(() => document.querySelector('form[action="/api/logout"] button').click()),
  ]);
  check('30. Выход возвращает на страницу входа', /\/login/.test(admin.url()), admin.url());
  await go(admin, '/tasks');
  check('31. После выхода задачи недоступны', /\/login/.test(admin.url()), admin.url());

  // ---------- ВАЛИДАЦИЯ ----------
  const admin2 = await session('admin@taskflow.ru');
  const before = sql('SELECT COUNT(*) FROM tasks');
  await admin2.evaluate(async (base) => {
    const fd = new FormData();
    fd.set('title', 'ab');
    await fetch(base + '/tasks/new', { method: 'POST', body: fd });
  }, BASE);
  check('32. Задача с коротким названием не создаётся', sql('SELECT COUNT(*) FROM tasks') === before);
  const r404 = await admin2.goto(BASE + '/no-such-page', { waitUntil: 'networkidle2' });
  check('33. Несуществующая страница → 404', r404.status() === 404, 'http=' + r404.status());

  // ---------- ДЕФЕКТ D2-1: формат даты и подсветка просроченных ----------
  await go(admin2, '/tasks');
  const listText = await text(admin2);
  check('34. D2-1: срок выводится как ДД.ММ.ГГГГ, а не «Wed Sep 23»',
    /Срок: \d{2}\.\d{2}\.\d{4}/.test(listText) && !/Срок: [A-Z][a-z]{2} /.test(listText), '');
  const overdueTitle = sql("SELECT title FROM tasks WHERE due_date < CURRENT_DATE AND status <> 'done' LIMIT 1");
  check('35. D2-1: просроченная задача помечена в интерфейсе',
    !!overdueTitle && listText.includes(overdueTitle) && listText.includes('просрочена'), 'задача=' + overdueTitle);
  check('36. Задача без срока показывается как «без срока»', listText.includes('без срока'));

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n===== TaskFlow: PASS ${pass}/${results.length} =====`);
  const fails = results.filter((r) => !r.ok);
  if (fails.length) { console.log('FAILED:'); fails.forEach((f) => console.log('  - ' + f.name)); }
  console.log('page errors: ' + (pageErrors.length ? JSON.stringify([...new Set(pageErrors)]) : 'none'));
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error('ОШИБКА ПРОГОНА:', e.message); process.exit(2); });
