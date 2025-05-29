import React, { useState, useEffect } from 'react';
import { ArrowDownTrayIcon, ClipboardDocumentCheckIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

function ExportData({ subscriptions, onImport, categories = [] }) {
  const [exportedJson, setExportedJson] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedCategoryForImport, setSelectedCategoryForImport] = useState('');
  const [selectedCategoryForExport, setSelectedCategoryForExport] = useState('all');
  const fileInputRef = React.useRef();

  const handleExport = () => {
    if (subscriptions.length === 0) {
      alert('Нет данных для экспорта.');
      setExportedJson('');
      return;
    }

    // Фильтруем подписки по выбранной категории
    const filteredSubscriptions = selectedCategoryForExport === 'all' 
      ? subscriptions 
      : subscriptions.filter(sub => sub.categoryId === selectedCategoryForExport);

    if (filteredSubscriptions.length === 0) {
      alert('В выбранной категории нет подписок для экспорта.');
      setExportedJson('');
      return;
    }

    // Получаем только те категории, которые используются в экспортируемых подписках
    const usedCategoryIds = [...new Set(filteredSubscriptions.map(sub => sub.categoryId))];
    const usedCategories = categories.filter(cat => usedCategoryIds.includes(cat.id));

    // Экспортируем данные с информацией о категориях
    const exportData = {
      version: "2.0", // Версия формата для совместимости
      exportDate: new Date().toISOString(),
      categories: usedCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        hasReminders: cat.hasReminders,
        color: cat.color,
        isDefault: cat.isDefault
      })),
      subscriptions: filteredSubscriptions.map(sub => ({
        name: sub.name,
        cost: sub.cost,
        currency: sub.currency,
        cycle: sub.cycle,
        payment_day: sub.paymentDay,
        next_payment_date: sub.fullPaymentDate,
        category_id: sub.categoryId,
        category_name: sub.category?.name || 'Неизвестная категория'
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    setExportedJson(jsonString);
    setCopied(false);
    
    const categoryName = selectedCategoryForExport === 'all' 
      ? 'Все данные' 
      : categories.find(cat => cat.id === selectedCategoryForExport)?.name || 'выбранной категории';
    
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(`${categoryName} экспортированы! (${filteredSubscriptions.length} подписок)`, 'success');
    }
  };

  const handleCopyToClipboard = () => {
    if (!exportedJson) return;
    navigator.clipboard.writeText(exportedJson)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error('Не удалось скопировать текст: ', err);
        alert('Не удалось скопировать. Пожалуйста, скопируйте вручную из текстового поля.');
      });
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        
        // Проверяем версию формата
        if (imported.version === "2.0") {
          console.log(imported);

          // Новый формат с категориями
          const normalizedSubscriptions = imported.subscriptions.map(sub => ({
            name: sub.name,
            cost: sub.cost,
            currency: sub.currency,
            cycle: sub.cycle,
            paymentDay: sub.payment_day,
            fullPaymentDate: sub.next_payment_date || null,
            categoryName: sub.category_name, // Для отображения в интерфейсе
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
          }));

          console.log('normalized', normalizedSubscriptions);
          
          onImport(normalizedSubscriptions, imported.categories[0].id || null);
        } else {
          throw new Error('Неподдерживаемый формат данных');
        }
      } catch (err) {
        console.error('Ошибка при импорте:', err);
        alert('Ошибка при импорте: некорректный JSON или неподдерживаемый формат');
      }
    };
    reader.readAsText(file);
    
    // Сбрасываем значение input для возможности повторного выбора того же файла
    e.target.value = '';
  };

  useEffect(() => {
    // Устанавливаем дефолтную категорию для импорта
    if (categories.length > 0 && !selectedCategoryForImport) {
      const defaultCategory = categories.find(cat => cat.isDefault) || categories[0];
      setSelectedCategoryForImport(defaultCategory.id);
    }
  }, [categories, selectedCategoryForImport]);

  useEffect(() => {
    // Глобальный хак для тоста из ExportData
    if (typeof window !== 'undefined') {
      window.showToast = (msg, type) => {
        const event = new CustomEvent('show-toast', { detail: { msg, type } });
        window.dispatchEvent(event);
      };
    }
  }, []);

  return (
    <div className="mt-6 space-y-4">
      {/* Кнопки экспорта и импорта */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExport}
          disabled={subscriptions.length === 0}
          className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75"
        >
          <ArrowDownTrayIcon className="h-5 w-5" />
          Экспортировать данные
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
        >
          <ArrowUpTrayIcon className="h-5 w-5" />
          Импортировать данные
        </button>
      </div>

      {/* Выбор категории для экспорта */}
      {categories.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
          <label htmlFor="export-category" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            Категория для экспорта:
          </label>
          <select
            id="export-category"
            value={selectedCategoryForExport}
            onChange={(e) => setSelectedCategoryForExport(e.target.value)}
            className="block w-full max-w-xs rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 p-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90"
          >
            <option value="all">Все категории ({subscriptions.length} подписок)</option>
            {categories.map(category => {
              const categorySubscriptions = subscriptions.filter(sub => sub.categoryId === category.id);
              return (
                <option key={category.id} value={category.id}>
                  {category.name} ({categorySubscriptions.length} подписок)
                  {category.isDefault && ' - основная'}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Выберите какие данные экспортировать
          </p>
        </div>
      )}

      {/* Выбор категории для импорта */}
      {/* {categories.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
          <label htmlFor="import-category" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            Категория для импортируемых подписок:
          </label>
          <select
            id="import-category"
            value={selectedCategoryForImport}
            onChange={(e) => setSelectedCategoryForImport(e.target.value)}
            className="block w-full max-w-xs rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 p-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90"
          >
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name} {category.isDefault && '(основная)'}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Все импортированные подписки будут добавлены в выбранную категорию
          </p>
        </div>
      )} */}

      <input
        type="file"
        accept="application/json,.json"
        ref={fileInputRef}
        onChange={handleImport}
        className="hidden"
      />

      {/* Поле с экспортированными данными */}
      {exportedJson && (
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Экспортированные данные (JSON):
            </label>
            <button
              onClick={handleCopyToClipboard}
              title="Копировать в буфер обмена"
              className="inline-flex items-center gap-1 px-3 py-1 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded-md text-slate-700 dark:text-slate-200 text-sm transition-colors"
            >
              <ClipboardDocumentCheckIcon className={`h-4 w-4 ${copied ? 'text-brand-secondary' : ''}`} />
              {copied ? 'Скопировано!' : 'Копировать'}
            </button>
          </div>
          <textarea
            readOnly
            value={exportedJson}
            className="block w-full p-3 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm font-mono h-48 resize-none focus:ring-brand-primary focus:border-brand-primary text-slate-900 dark:text-slate-200"
            aria-label="Экспортированные данные в формате JSON"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Сохраните этот JSON для использования в Telegram-боте или для резервного копирования данных.
          </p>
        </div>
      )}

      {/* Информация о формате */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          Информация о экспорте/импорте:
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <li>• Можно экспортировать все данные или только выбранную категорию</li>
          <li>• Экспорт включает информацию о категориях и их настройках</li>
          <li>• При импорте дублирующиеся подписки не будут добавлены</li>
        </ul>
      </div>
    </div>
  );
}

export default ExportData;