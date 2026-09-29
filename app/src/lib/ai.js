/**
 * Tracker_02 (TaskFlow) — модуль автоматической категоризации и распределения задач.
 *
 * ОТКЛОНЕНИЕ ОТ ЗАКАЗА (зафиксировано честно): клиент просил OpenAI API.
 * Ключ OpenAI — платный и принадлежит клиенту, в учебном MVP его нет,
 * поэтому реализован детерминированный "офлайн-классификатор" по словарю
 * ключевых слов + распределение на наименее загруженного сотрудника категории.
 * Это НЕ нейросеть. Точка расширения одна: функция categorize() —
 * при наличии ключа её тело заменяется вызовом OpenAI, остальной код не меняется.
 */
const RULES = [
  { category: 'Разработка',  weight: 3, words: ['баг', 'bug', 'api', 'деплой', 'релиз', 'код', 'фронт', 'бэкенд', 'верстк', 'рефактор', 'интеграц', 'миграц'] },
  { category: 'Дизайн',      weight: 3, words: ['макет', 'дизайн', 'логотип', 'баннер', 'иконк', 'figma', 'прототип', 'ui', 'ux'] },
  { category: 'Маркетинг',   weight: 2, words: ['реклам', 'смм', 'smm', 'контент', 'рассылк', 'лендинг', 'кампан', 'seo', 'пост'] },
  { category: 'Продажи',     weight: 2, words: ['клиент', 'счёт', 'счет', 'договор', 'коммерческое', 'звонок', 'лид', 'сделк'] },
  { category: 'Поддержка',   weight: 2, words: ['тикет', 'обращен', 'жалоб', 'инцидент', 'поддержк', 'вопрос польз'] },
  { category: 'Документы',   weight: 1, words: ['документ', 'отчёт', 'отчет', 'регламент', 'инструкц', 'акт', 'протокол'] },
];

const URGENT = ['срочно', 'сегодня', 'critical', 'критич', 'авари', 'падает', 'не работает', 'сроч'];

/** Возвращает {category, priority, reason} по тексту задачи. */
export function categorize(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  let best = { category: 'Прочее', score: 0, hits: [] };
  for (const r of RULES) {
    const hits = r.words.filter((w) => text.includes(w));
    const score = hits.length * r.weight;
    if (score > best.score) best = { category: r.category, score, hits };
  }
  const urgentHits = URGENT.filter((w) => text.includes(w));
  const priority = urgentHits.length ? 'high' : 'medium';
  const reason = best.score
    ? `ключевые слова: ${best.hits.join(', ')}${urgentHits.length ? `; срочность: ${urgentHits.join(', ')}` : ''}`
    : 'ключевые слова не найдены — категория «Прочее»';
  return { category: best.category, priority, reason };
}

/**
 * Выбирает исполнителя: сотрудник с этой специализацией и наименьшим числом
 * незавершённых задач. Если по категории никого нет — наименее загруженный вообще.
 */
export function suggestAssignee(category, candidates) {
  if (!candidates.length) return null;
  const byCat = candidates.filter((c) => (c.specialization || '') === category);
  const pool = byCat.length ? byCat : candidates;
  return pool.reduce((a, b) => (Number(a.open_tasks) <= Number(b.open_tasks) ? a : b));
}
