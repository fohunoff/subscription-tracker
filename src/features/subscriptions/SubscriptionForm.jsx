import React, { useState, useEffect } from 'react';
import DatePicker, { registerLocale } from "react-datepicker";
import ru from 'date-fns/locale/ru';
import { PlusCircleIcon, CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

registerLocale('ru', ru);

function SubscriptionForm({ onAddSubscription, onUpdateSubscription, initialData, isEditMode }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [cycle, setCycle] = useState('monthly');
  const [paymentDate, setPaymentDate] = useState(null);

  useEffect(() => {
    if (isEditMode && initialData) {
      setName(initialData.name);
      setCost(initialData.cost.toString());
      setCurrency(initialData.currency);
      setCycle(initialData.cycle);
      if (initialData.fullPaymentDate) {
        setPaymentDate(new Date(initialData.fullPaymentDate));
      } else if (initialData.paymentDay) {
        const today = new Date();
        try {
          let tempDate = new Date(today.getFullYear(), today.getMonth(), initialData.paymentDay);
          setPaymentDate(tempDate);
        } catch (e) {
          setPaymentDate(null);
        }
      } else {
        setPaymentDate(null);
      }
    } else {
      setName('');
      setCost('');
      setCurrency('RUB');
      setCycle('monthly');
      setPaymentDate(null);
    }
  }, [isEditMode, initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !cost || isNaN(parseFloat(cost)) || parseFloat(cost) <= 0 || !paymentDate) {
      alert('Пожалуйста, заполните все поля корректно, включая дату оплаты.');
      return;
    }
    const subscriptionData = {
      name,
      cost: parseFloat(cost),
      currency,
      cycle,
      paymentDay: paymentDate.getDate(),
      fullPaymentDate: paymentDate.toISOString(),
    };
    if (isEditMode && initialData) {
      onUpdateSubscription(initialData.id, subscriptionData);
    } else {
      onAddSubscription(subscriptionData);
    }
  };

  const inputBaseClass = "block w-full text-sm rounded-lg border-slate-300 p-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed";
  const labelBaseClass = "block mb-1 text-sm font-medium text-slate-700";

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
          <label htmlFor="subPaymentDayModal" className={labelBaseClass}>Дата старта подписки</label>
          <DatePicker
            selected={paymentDate}
            onChange={(date) => setPaymentDate(date)}
            locale="ru"
            dateFormat="dd MMMM yyyy"
            placeholderText="Выберите дату"
            customInput={<CustomDatePickerInput placeholder="Выберите дату" />}
            popperPlacement="auto"
            showMonthDropdown
            showYearDropdown
            dropdownMode="select"
            required
            popperClassName="z-[9999]"
            portalId="root-portal"
          />
        </div>
      </div>
      <div className="pt-2">
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 bg-brand-secondary hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75"
        >
          {isEditMode ? <CheckCircleIcon className="h-5 w-5" /> : <PlusCircleIcon className="h-5 w-5" />}
          {isEditMode ? 'Сохранить изменения' : 'Добавить подписку'}
        </button>
      </div>
    </form>
  );
}

export default SubscriptionForm;