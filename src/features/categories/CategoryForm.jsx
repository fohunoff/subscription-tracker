import React, { useState, useEffect } from 'react';
import { PlusCircleIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

const CATEGORY_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#EC4899', // pink
  '#6B7280', // gray
];

function CategoryForm({ onAddCategory, onUpdateCategory, initialData, isEditMode, onClose }) {
  const [name, setName] = useState('');
  const [hasReminders, setHasReminders] = useState(true);
  const [color, setColor] = useState('#3B82F6');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEditMode && initialData) {
      setName(initialData.name);
      setHasReminders(initialData.hasReminders);
      setColor(initialData.color || '#3B82F6');
    } else {
      setName('');
      setHasReminders(true);
      setColor('#3B82F6');
    }
  }, [isEditMode, initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Пожалуйста, введите название категории.');
      return;
    }

    setIsSubmitting(true);
    try {
      const categoryData = {
        name: name.trim(),
        hasReminders,
        color
      };

      if (isEditMode && initialData) {
        await onUpdateCategory(initialData.id, categoryData);
      } else {
        await onAddCategory(categoryData);
      }
      onClose();
    } catch (error) {
      // Ошибка уже обработана в хуке
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBaseClass = "block w-full text-sm rounded-lg border-slate-300 p-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed";
  const labelBaseClass = "block mb-1 text-sm font-medium text-slate-700 dark:text-slate-200";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="categoryName" className={labelBaseClass}>
          Название категории
        </label>
        <input
          type="text"
          id="categoryName"
          placeholder="Например, Развлечения"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputBaseClass}
          required
          autoFocus
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label className={labelBaseClass}>Цвет категории</label>
        <div className="grid grid-cols-5 gap-2 mt-2">
          {CATEGORY_COLORS.map((colorOption) => (
            <button
              key={colorOption}
              type="button"
              className={`w-10 h-10 rounded-lg border-2 transition-all ${
                color === colorOption 
                  ? 'border-slate-400 scale-110 shadow-md' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              style={{ backgroundColor: colorOption }}
              onClick={() => setColor(colorOption)}
              disabled={isSubmitting}
              aria-label={`Выбрать цвет ${colorOption}`}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="hasReminders"
            checked={hasReminders}
            onChange={(e) => setHasReminders(e.target.checked)}
            className="mt-1 rounded border-slate-300 text-brand-primary focus:ring-brand-primary focus:ring-opacity-50"
            disabled={isSubmitting || (isEditMode && initialData?.isDefault)}
          />
          <div className="flex-1">
            <label htmlFor="hasReminders" className={labelBaseClass}>
              Включить напоминания о платежах
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {hasReminders 
                ? 'При добавлении подписки будет запрашиваться дата платежа для расчета напоминаний'
                : 'Подписки в этой категории будут использоваться только для учета расходов без напоминаний'
              }
            </p>
            {isEditMode && initialData?.isDefault && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Для основной категории нельзя отключить напоминания
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 bg-brand-secondary hover:bg-emerald-600 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              {isEditMode ? 'Сохранение...' : 'Добавление...'}
            </>
          ) : (
            <>
              {isEditMode ? <CheckCircleIcon className="h-5 w-5" /> : <PlusCircleIcon className="h-5 w-5" />}
              {isEditMode ? 'Сохранить изменения' : 'Добавить категорию'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default CategoryForm;