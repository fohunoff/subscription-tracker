import React, { useState } from 'react';
import { ArrowDownTrayIcon, ClipboardDocumentCheckIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

function ExportData({ subscriptions, onImport }) {
  const [exportedJson, setExportedJson] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = React.useRef();

  const handleExport = () => {
    if (subscriptions.length === 0) {
      alert('Нет данных для экспорта.');
      setExportedJson('');
      return;
    }
    const botData = subscriptions.map(sub => ({
      name: sub.name, cost: sub.cost, currency: sub.currency,
      payment_day: sub.paymentDay, cycle: sub.cycle
    }));
    const jsonString = JSON.stringify(botData, null, 2);
    setExportedJson(jsonString);
    setCopied(false); // Сбросить состояние "скопировано" при новом экспорте
  };

  const handleCopyToClipboard = () => {
    if (!exportedJson) return;
    navigator.clipboard.writeText(exportedJson)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Сбросить через 2 сек
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
        // Преобразуем поля к формату приложения
        const normalized = imported.map(sub => ({
          name: sub.name,
          cost: sub.cost,
          currency: sub.currency,
          cycle: sub.cycle,
          paymentDay: sub.payment_day,
          fullPaymentDate: sub.next_payment_date || null,
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        }));
        onImport(normalized);
      } catch (err) {
        alert('Ошибка при импорте: некорректный JSON');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mt-6 space-y-4">
      <button
        onClick={handleExport}
        disabled={subscriptions.length === 0}
        className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-lg shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75"
      >
        <ArrowDownTrayIcon className="h-5 w-5" />
        Сформировать JSON для бота
      </button>

      <button
        type="button"
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-sm hover:shadow-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
      >
        <ArrowUpTrayIcon className="h-5 w-5" />
        Импортировать JSON
      </button>
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        onChange={handleImport}
        className="hidden"
      />

      {exportedJson && (
        <div className="relative">
          <textarea
            readOnly
            value={exportedJson}
            className="block w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg shadow-sm font-mono h-48 resize-none focus:ring-brand-primary focus:border-brand-primary"
            aria-label="Экспортированные данные в формате JSON"
          />
          <button
            onClick={handleCopyToClipboard}
            title="Копировать в буфер обмена"
            className="absolute top-3 right-3 p-2 bg-slate-200 hover:bg-slate-300 rounded-md text-slate-700 transition-colors"
          >
            {copied ? <ClipboardDocumentCheckIcon className="h-5 w-5 text-brand-secondary" /> : <ClipboardDocumentCheckIcon className="h-5 w-5" />}
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportData;