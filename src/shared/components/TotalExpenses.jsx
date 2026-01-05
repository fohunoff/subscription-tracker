import React, { useMemo } from 'react';
import { formatCurrency } from '../utils';

const TotalExpenses = ({
  subscriptions,
  categories,
  totalMonthlyCost,
  baseCurrency,
  onCategoryClick
}) => {
  // Группируем расходы по категориям
  const categoryExpenses = useMemo(() => {
    const expenses = {};

    subscriptions.forEach(sub => {
      const categoryId = sub.categoryId?._id || sub.categoryId?.id || sub.categoryId;
      const category = categories.find(cat => cat.id === categoryId || cat._id === categoryId);

      if (!category) return;

      let monthlyCost = sub.cost;
      if (sub.cycle === 'annually') {
        monthlyCost = sub.cost / 12;
      }

      const catId = category.id || category._id;

      if (!expenses[catId]) {
        expenses[catId] = {
          id: catId,
          name: category.name,
          color: category.color,
          total: 0,
          count: 0
        };
      }

      expenses[catId].total += monthlyCost;
      expenses[catId].count += 1;
    });

    // Сортируем по убыванию суммы
    return Object.values(expenses)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // Топ-5 категорий
  }, [subscriptions, categories]);

  // Вычисляем процент для каждой категории
  const categoriesWithPercentage = useMemo(() => {
    return categoryExpenses.map(cat => ({
      ...cat,
      percentage: totalMonthlyCost > 0 ? (cat.total / totalMonthlyCost) * 100 : 0
    }));
  }, [categoryExpenses, totalMonthlyCost]);

  const handleCategoryClick = (categoryId) => {
    if (onCategoryClick) {
      onCategoryClick(categoryId);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-xl p-6 md:p-8 mb-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200 mb-2">
          Общие расходы
        </h2>
        <p className="text-4xl font-bold text-brand-primary mb-2">
          {formatCurrency(totalMonthlyCost, baseCurrency)}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Итого в месяц • {subscriptions.length} подписок
        </p>
      </div>

      {categoriesWithPercentage.length > 0 && (
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-4">
            Топ категории:
          </h3>
          <div className="space-y-3">
            {categoriesWithPercentage.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.id)}
                className="w-full text-left group hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg p-2 -mx-2 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-brand-primary dark:group-hover:text-brand-primary transition-colors">
                      {cat.name}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      ({cat.count} {cat.count === 1 ? 'подписка' : cat.count < 5 ? 'подписки' : 'подписок'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {formatCurrency(cat.total, baseCurrency)}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium min-w-[3rem] text-right">
                      {cat.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 group-hover:opacity-90"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: cat.color
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default TotalExpenses;
