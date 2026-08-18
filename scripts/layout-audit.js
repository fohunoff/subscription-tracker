/**
 * Проверка вёрстки: ищет то, что ломает мобильное отображение и не видно
 * на глаз в одном размере экрана.
 *
 * Скрипт намеренно без зависимостей и без раннера: playwright в проекте не
 * установлен, а проверки вёрстки здесь делаются браузером через MCP.
 * Запускать двумя способами:
 *
 *   1. DevTools: скопировать содержимое функции в консоль страницы и вызвать
 *      auditLayout() — вернёт объект с находками.
 *   2. Playwright MCP: browser_resize на нужную ширину, затем browser_evaluate
 *      с телом этой функции.
 *
 * Что проверяется (каждая проверка — реально пойманный на этом проекте баг):
 *   overflow     — элементы за границей вьюпорта: горизонтальная прокрутка;
 *   overlaps     — плавающие и абсолютные кнопки поверх заголовков: так
 *                  кнопки темы и настроек накрывали «Трекер расходов»,
 *                  а иконки категории — её название;
 *   collisions   — соседние элементы, налезающие друг на друга: сумма
 *                  категории поверх её названия в блоке расходов;
 *   smallTargets — тап-цели меньше 44px: иконки в карточке подписки;
 *   zoomInputs   — поля со шрифтом меньше 16px: Safari на iOS зумит страницу
 *                  при фокусе, и форма уезжает за край экрана;
 *   offscreen    — интерактивные элементы, полностью или частично за краем:
 *                  кнопка «Удалить» в футере панели деталей на 320px.
 *
 * Ширины, на которых имеет смысл прогонять: 320 (минимум), 390 (iPhone),
 * 430 (iPhone Pro Max), 768 (планшет в портрете), 1280 (десктоп).
 */
function auditLayout() {
  const vw = window.innerWidth;
  const overlap = (a, b) =>
    !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const label = (el) =>
    (el.getAttribute('aria-label') || el.title || el.textContent || '').trim().slice(0, 40);

  const result = {
    viewport: vw,
    documentWidth: document.scrollingElement.scrollWidth,
    overflow: [],
    overlaps: [],
    collisions: [],
    smallTargets: [],
    zoomInputs: [],
    offscreen: [],
  };

  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) continue;
    if (rect.right > vw + 1 || rect.left < -1) {
      result.overflow.push({ tag: el.tagName, text: label(el), left: Math.round(rect.left), right: Math.round(rect.right) });
    }
  }

  // Заголовки под плавающими кнопками
  const floating = [...document.querySelectorAll('.fixed button, .absolute button, .sticky button')];
  const headings = [...document.querySelectorAll('h1, h2, h3')];
  for (const button of floating) {
    const br = button.getBoundingClientRect();
    if (br.width === 0) continue;
    for (const heading of headings) {
      if (button.contains(heading) || heading.contains(button)) continue;
      // Сравниваем с текстом, а не с боксом заголовка: у блочного h1 бокс
      // тянется во всю ширину и пересекается с кнопками, даже когда текст
      // стоит по центру и ничем не перекрыт
      const range = document.createRange();
      range.selectNodeContents(heading);
      const tr = range.getBoundingClientRect();
      range.detach?.();
      if (tr.width && overlap(br, tr)) {
        result.overlaps.push({ button: label(button), heading: label(heading) });
      }
    }
  }

  // Текст, на который налезает соседний текст (обычно цифра справа)
  const textNodes = [...document.querySelectorAll('span, p, h2, h3')].filter(
    el => el.children.length === 0 && (el.textContent || '').trim()
  );
  for (let i = 0; i < textNodes.length; i += 1) {
    for (let j = i + 1; j < textNodes.length; j += 1) {
      const a = textNodes[i];
      const b = textNodes[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      if (!ra.width || !rb.width) continue;
      if (overlap(ra, rb)) {
        result.collisions.push({ a: label(a), b: label(b) });
      }
    }
  }

  for (const el of document.querySelectorAll('button, a, [role=button], input, select, textarea')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) continue;

    // Ссылки внутри абзаца по высоте строки — не тап-цель в смысле кнопки
    const inline = getComputedStyle(el).display === 'inline';
    if (!inline && (rect.height < 44 || rect.width < 44)) {
      result.smallTargets.push({ label: label(el), width: Math.round(rect.width), height: Math.round(rect.height) });
    }

    if (rect.right > vw + 1 || rect.left < -1) {
      result.offscreen.push({ label: label(el), left: Math.round(rect.left), right: Math.round(rect.right) });
    }
  }

  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (el.type === 'hidden' || el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 16) {
      result.zoomInputs.push({ label: el.name || el.id || el.type, fontSize: size });
    }
  }

  return result;
}

// Позволяет вставить файл целиком и сразу увидеть результат
if (typeof window !== 'undefined') window.auditLayout = auditLayout;
