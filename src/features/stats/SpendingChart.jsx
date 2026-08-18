import React, { useMemo, useState } from 'react';
import { formatCurrency } from '../../shared/utils';
import { useMediaQuery } from '../../shared/hooks';

/**
 * Траты по месяцам — колонки от общей базовой линии.
 *
 * Столбец состоит из двух частей: наблюдённые списания в акцентном цвете и
 * восстановленные бэкфиллом оценки — в приглушённом сером. Это приём
 * «выделение»: важны настоящие платежи, оценка идёт фоном и не спорит с ними
 * за внимание. Разделяет части зазор цвета поверхности, а не обводка.
 */

// Акцент проходит проверку контраста и на светлой, и на тёмной поверхности,
// поэтому цвет один на обе темы. Серый для оценок — де-эмфазис.
const ACCENT = '#3B82F6';
const ESTIMATED_LIGHT = '#64748B';
const ESTIMATED_DARK = '#94A3B8';

// padLeft вмещает самую широкую подпись оси («20 тыс. ₽»): при меньшем
// отступе она обрезалась левым краем
const VIEW = { width: 720, height: 240, padTop: 24, padBottom: 28, padLeft: 74, padRight: 8 };

// На узких экранах viewBox сужается вместе с экраном, а не масштабируется:
// 720 пикселей, сжатые до 340, уменьшали и подписи — 11px превращались
// в нечитаемые 5px. Пропорции при этом остаются те же, меняется только
// плотность: столбцы уже, отступ под ось меньше.
const VIEW_COMPACT = { width: 360, height: 220, padTop: 22, padBottom: 26, padLeft: 46, padRight: 4 };
const MAX_BAR_WIDTH = 24;
const MAX_BAR_WIDTH_COMPACT = 16;
const SEGMENT_GAP = 2;
const CORNER = 4;

const MONTH_LABELS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const monthLabel = (key, { withYear = false } = {}) => {
  const [year, month] = key.split('-');
  const label = MONTH_LABELS[Number(month) - 1] || month;
  return withYear ? `${label} ${year.slice(2)}` : label;
};

const compact = (value, currency) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);

// На узком графике подписи идут без символа валюты: «20 тыс. ₽» не влезало
// в отступ под ось и обрезалось левым краем, а валюта и так названа в сумме
// за период над графиком
const compactPlain = (value) =>
  new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/**
 * Верх шкалы округляется вверх до «круглого» числа, чтобы подписи оси читались
 * (0 / 2 500 / 5 000), а не повторяли максимум с копейками.
 */
const niceCeil = (value) => {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  // Шагов больше, чем классические 1/2/5: с редкой сеткой максимум 12 500
  // округлялся до 20 000, и половина графика оставалась пустой
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return magnitude * (steps.find(step => value <= magnitude * step) ?? 10);
};

/**
 * Контур столбца: скругление только сверху, у базовой линии — прямой угол.
 * Через rx скруглялись бы все четыре угла, и столбец «отрывался» бы от оси.
 */
const barPath = (x, y, width, height) => {
  const radius = Math.min(CORNER, height, width / 2);
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + width - radius} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `L ${x + width} ${y + height}`,
    'Z'
  ].join(' ');
};

function SpendingChart({ months, baseCurrency, isDark = false }) {
  const [hovered, setHovered] = useState(null);
  const isCompact = useMediaQuery('(max-width: 639px)');

  const estimatedColor = isDark ? ESTIMATED_DARK : ESTIMATED_LIGHT;
  const view = isCompact ? VIEW_COMPACT : VIEW;
  const shortAmount = (value) => (isCompact ? compactPlain(value) : compact(value, baseCurrency));

  const { plotWidth, plotHeight, slotWidth, barWidth, scaleMax, ticks, peakIndex } = useMemo(() => {
    const width = view.width - view.padLeft - view.padRight;
    const height = view.height - view.padTop - view.padBottom;
    const slot = months.length > 0 ? width / months.length : width;
    const max = niceCeil(Math.max(...months.map(m => m.total), 0));

    const peak = months.reduce(
      (best, month, index) => (month.total > (months[best]?.total ?? -1) ? index : best),
      0
    );

    return {
      plotWidth: width,
      plotHeight: height,
      slotWidth: slot,
      // Столбец не занимает слот целиком: остаток — воздух, а не поле для заливки
      barWidth: Math.min(isCompact ? MAX_BAR_WIDTH_COMPACT : MAX_BAR_WIDTH, slot * 0.6),
      scaleMax: max,
      ticks: [0, max / 2, max],
      peakIndex: peak
    };
  }, [months, view, isCompact]);

  const y = (value) => view.padTop + plotHeight - (value / scaleMax) * plotHeight;

  const hasEstimated = months.some(month => month.estimated > 0);
  const hasObserved = months.some(month => month.total - month.estimated > 0.01);
  // Подписи месяцев начинают сливаться примерно после десятка колонок,
  // а на узком графике — уже после полугода
  const labelStep = isCompact
    ? (months.length > 12 ? 3 : months.length > 6 ? 2 : 1)
    : (months.length > 14 ? 3 : months.length > 8 ? 2 : 1);

  const hoveredMonth = hovered !== null ? months[hovered] : null;

  return (
    <div>
      {/* Значение под курсором — вместо всплывающей подсказки, которая на
          мобильных всё равно недоступна. Высота держится минимумом, а не
          фиксируется: на узком экране строка занимает две строки, и жёсткие
          h-5 срезали бы вторую */}
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 min-h-[1.25rem]">
        {hoveredMonth ? (
          <>
            <span className="font-medium">{monthLabel(hoveredMonth.month, { withYear: true })}</span>
            {' — '}
            {formatCurrency(hoveredMonth.total, baseCurrency, 'ru-RU', { maximumFractionDigits: 0 })}
            <span className="text-slate-400 dark:text-slate-500">
              {' · '}
              {hoveredMonth.count === 0
                ? 'платежей не было'
                : `платежей: ${hoveredMonth.count}`}
              {hoveredMonth.estimated > 0 && ', часть — оценка'}
            </span>
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">
            {isCompact
              ? 'Нажмите на столбец, чтобы увидеть месяц'
              : 'Наведите на столбец, чтобы увидеть месяц'}
          </span>
        )}
      </p>

      <svg
        viewBox={`0 0 ${view.width} ${view.height}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Траты по месяцам в ${baseCurrency}`}
      >
        {/* Сетка: тонкая, сплошная, отступает на второй план */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={view.padLeft}
              x2={view.padLeft + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-slate-200 dark:stroke-slate-700"
              strokeWidth="1"
            />
            <text
              x={view.padLeft - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-slate-400 dark:fill-slate-500"
              style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
            >
              {shortAmount(tick)}
            </text>
          </g>
        ))}

        {months.map((month, index) => {
          const observed = Math.max(month.total - month.estimated, 0);
          const x = view.padLeft + slotWidth * index + (slotWidth - barWidth) / 2;
          const baseY = y(0);

          const observedHeight = scaleMax > 0 ? (observed / scaleMax) * plotHeight : 0;
          const estimatedHeight = scaleMax > 0 ? (month.estimated / scaleMax) * plotHeight : 0;
          // Зазор между сегментами съедает часть нижнего — только когда есть оба
          const gap = observedHeight > 0 && estimatedHeight > 0 ? SEGMENT_GAP : 0;

          const isPeak = index === peakIndex && month.total > 0;
          const dimmed = hovered !== null && hovered !== index;

          return (
            /* На тачскрине наведения нет: там месяц выбирают тапом, повторный
               тап снимает выбор. Иначе строка со значением оставалась пустой
               и цифру по столбцу узнать было нельзя */
            <g
              key={month.month}
              opacity={dimmed ? 0.6 : 1}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setHovered(current => (current === index ? null : index))}
              style={{ cursor: 'pointer' }}
            >
              {/* Прозрачная зона наведения шире столбца */}
              <rect
                x={view.padLeft + slotWidth * index}
                y={view.padTop}
                width={slotWidth}
                height={plotHeight}
                fill="transparent"
              />

              {/* Оценка лежит поверх наблюдённой части — у неё скруглён верх,
                  у нижней части он срезан зазором в цвет поверхности */}
              {estimatedHeight > 0 && (
                <path
                  d={barPath(x, baseY - observedHeight - estimatedHeight, barWidth, estimatedHeight)}
                  fill={estimatedColor}
                />
              )}

              {observedHeight > 0 && (
                <path
                  d={barPath(x, baseY - observedHeight + gap, barWidth, Math.max(observedHeight - gap, 1))}
                  fill={ACCENT}
                />
              )}

              {/* Подписываем только пик: значение на каждом столбце не читается */}
              {isPeak && (
                <text
                  x={x + barWidth / 2}
                  y={baseY - observedHeight - estimatedHeight - 8}
                  textAnchor="middle"
                  className="fill-slate-500 dark:fill-slate-400"
                  style={{ fontSize: 11 }}
                >
                  {shortAmount(month.total)}
                </text>
              )}

              {index % labelStep === 0 && (
                <text
                  x={view.padLeft + slotWidth * index + slotWidth / 2}
                  y={view.height - 8}
                  textAnchor="middle"
                  className="fill-slate-400 dark:fill-slate-500"
                  style={{ fontSize: 11 }}
                >
                  {monthLabel(month.month, { withYear: month.month.endsWith('-01') })}
                </text>
              )}
            </g>
          );
        })}

        {/* Базовая линия */}
        <line
          x1={view.padLeft}
          x2={view.padLeft + plotWidth}
          y1={y(0)}
          y2={y(0)}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth="1"
        />
      </svg>

      {hasEstimated && hasObserved && (
        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ACCENT }} />
            Списания
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: estimatedColor }} />
            Оценка по истории
          </span>
        </div>
      )}
    </div>
  );
}

export default SpendingChart;
