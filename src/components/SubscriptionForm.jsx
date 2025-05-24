import React, { useState } from 'react';
import DatePicker, { registerLocale } from "react-datepicker"; // <--- Импортируем DatePicker
import ru from 'date-fns/locale/ru'; // <--- Импортируем русскую локаль
import { PlusCircleIcon, CalendarIcon } from '@heroicons/react/24/solid';

registerLocale('ru', ru); // <--- Регистрируем локаль

function SubscriptionForm({ onAddSubscription }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [cycle, setCycle] = useState('monthly');
  // Теперь paymentDate будет хранить полный объект Date
  const [paymentDate, setPaymentDate] = useState(null); // <--- Изменено с paymentDay

  const handleSubmit = (e) => {
    e.preventDefault();
    // Проверяем, что дата выбрана
    if (!name || !cost || isNaN(parseFloat(cost)) || parseFloat(cost) <= 0 || !paymentDate) {
      alert('Пожалуйста, заполните все поля корректно, включая дату оплаты.');
      return;
    }
    onAddSubscription({
      name,
      cost: parseFloat(cost),
      currency,
      cycle,
      // Передаем только день месяца
      paymentDay: paymentDate.getDate(), // <--- Получаем день из выбранной даты
      // Также можем передать полную дату, если она нужна для более точных напоминаний (особенно для годовых)
      fullPaymentDate: paymentDate.toISOString() // Опционально
    });
    // Сброс формы
    setName('');
    setCost('');
    setCurrency('RUB');
    setCycle('monthly');
    setPaymentDate(null);
  };

  const inputBaseClass = "block w-full text-sm rounded-lg border-slate-300 p-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed";
  const labelBaseClass = "block mb-1 text-sm font-medium text-slate-700";

  // Кастомный инпут для DatePicker, чтобы он выглядел как остальные поля
  const CustomDatePickerInput = React.forwardRef(({ value, onClick, placeholder }, ref) => (
    <button
      type="button"
      className={`${inputBaseClass} text-left flex justify-between items-center`}
      onClick={onClick}
      ref={ref}
    >
      {value || <span className="text-slate-400">{placeholder}</span>}
      <CalendarIcon className="h-5 w-5 text-slate-400" />
    </button>
  ));
  CustomDatePickerInput.displayName = 'CustomDatePickerInput';


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="subNameModal" className={labelBaseClass}>Название подписки</label>
        <input type="text" id="subNameModal" placeholder="Например, Spotify Premium" value={name} onChange={(e) => setName(e.target.value)} className={inputBaseClass} required autoFocus />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
        <div>
          <label htmlFor="subCostModal" className={labelBaseClass}>Стоимость</label>
          <input type="number" id="subCostModal" placeholder="169" value={cost} onChange={(e) => setCost(e.target.value)} className={inputBaseClass} step="0.01" min="0.01" required />
        </div>
        <div>
          <label htmlFor="subCurrencyModal" className={labelBaseClass}>Валюта</label>
          <select id="subCurrencyModal" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputBaseClass}>
            <option value="RUB">RUB</option> <option value="USD">USD</option> <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
        <div>
          <label htmlFor="subCycleModal" className={labelBaseClass}>Цикл оплаты</label>
          <select id="subCycleModal" value={cycle} onChange={(e) => setCycle(e.target.value)} className={inputBaseClass}>
            <option value="monthly">Ежемесячно</option> <option value="annually">Ежегодно</option>
          </select>
        </div>
        <div>
          <label htmlFor="subPaymentDayModal" className={labelBaseClass}>Дата следующего платежа</label>
          <DatePicker
            selected={paymentDate}
            onChange={(date) => setPaymentDate(date)}
            locale="ru" // Используем русскую локаль
            dateFormat="dd MMMM yyyy" // Формат отображения даты
            placeholderText="Выберите дату"
            className={inputBaseClass} // Этот класс применится к обертке, если не использовать customInput
            customInput={<CustomDatePickerInput placeholder="Выберите дату" />}
            popperPlacement="bottom-start" // Расположение календаря
            showMonthDropdown // Позволяет быстро выбирать месяц
            showYearDropdown  // Позволяет быстро выбирать год
            dropdownMode="select" // Делает дропдауны для месяца/года как <select>
            required
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-brand-secondary hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
        >
          <PlusCircleIcon className="h-5 w-5" />
          Добавить подписку
        </button>
      </div>
    </form>
  );
}

export default SubscriptionForm;