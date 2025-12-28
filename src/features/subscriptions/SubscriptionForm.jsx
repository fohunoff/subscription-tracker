import React, { useState, useEffect } from 'react';
import DatePicker, { registerLocale } from "react-datepicker";
import ru from 'date-fns/locale/ru';
import { PlusCircleIcon, CalendarIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

registerLocale('ru', ru);

function SubscriptionForm({ 
  onAddSubscription, 
  onUpdateSubscription, 
  initialData, 
  isEditMode,
  categories = [],
  selectedCategory = null 
}) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('RUB');
  const [cycle, setCycle] = useState('monthly');
  const [paymentDate, setPaymentDate] = useState(null);
  const [categoryId, setCategoryId] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState([]);

  // Определяем, нужно ли показывать календарь
  const currentCategory = categories.find(cat => cat.id === categoryId);
  const showDatePicker = currentCategory?.hasReminders !== false;

  useEffect(() => {
    if (isEditMode && initialData) {
      setName(initialData.name);
      setCost(initialData.cost.toString());
      setCurrency(initialData.currency);
      setCycle(initialData.cycle);
      setCategoryId(initialData.categoryId);
      setNotificationsEnabled(initialData.notificationsEnabled || false);
      setNotifyDaysBefore(initialData.notifyDaysBefore || []);
      
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
      setNotificationsEnabled(false);
      setNotifyDaysBefore([]);
      
      // Если передана выбранная категория, устанавливаем её
      if (selectedCategory) {
        setCategoryId(selectedCategory.id);
      } else if (categories.length > 0) {
        // Выбираем дефолтную категорию или первую доступную
        const defaultCategory = categories.find(cat => cat.isDefault) || categories[0];
        setCategoryId(defaultCategory.id);
      }
    }
  }, [isEditMode, initialData, selectedCategory, categories]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!name || !cost || isNaN(parseFloat(cost)) || parseFloat(cost) <= 0) {
      alert('Пожалуйста, заполните все обязательные поля корректно.');
      return;
    }

    if (!categoryId) {
      alert('Пожалуйста, выберите категорию.');
      return;
    }

    // Проверяем дату только для категорий с напоминаниями
    if (showDatePicker && !paymentDate) {
      alert('Пожалуйста, укажите дату платежа для категории с напоминаниями.');
      return;
    }

    const subscriptionData = {
      name,
      cost: parseFloat(cost),
      currency,
      cycle,
      categoryId
    };

    // Добавляем поля даты только если нужны напоминания
    if (showDatePicker && paymentDate) {
      subscriptionData.paymentDay = paymentDate.getDate();
      subscriptionData.fullPaymentDate = paymentDate.toISOString();
    }

    // Добавляем настройки уведомлений
    subscriptionData.notificationsEnabled = notificationsEnabled;
    subscriptionData.notifyDaysBefore = notifyDaysBefore;

    if (isEditMode && initialData) {
      onUpdateSubscription(initialData.id, subscriptionData);
    } else {
      onAddSubscription(subscriptionData);
    }
  };

  const inputBaseClass = "block w-full text-sm rounded-lg border-slate-300 p-2 shadow-sm focus:border-brand-primary focus:outline-none focus:ring focus:ring-brand-primary focus:ring-opacity-90 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed";
  const labelBaseClass = "block mb-1 text-sm font-medium text-slate-700 dark:text-slate-200";

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

  const handleDayToggle = (day) => {
    setNotifyDaysBefore(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="subNameModal" className={labelBaseClass}>Название подписки</label>
        <input 
          type="text" 
          id="subNameModal" 
          placeholder="Например, Spotify Premium" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          className={inputBaseClass} 
          required 
          autoFocus 
        />
      </div>

      <div>
        <label htmlFor="subCategoryModal" className={labelBaseClass}>Категория</label>
        <select 
          id="subCategoryModal" 
          value={categoryId} 
          onChange={(e) => setCategoryId(e.target.value)} 
          className={inputBaseClass}
          required
        >
          <option value="">Выберите категорию</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>
              {category.name} {!category.hasReminders && '(без напоминаний)'}
            </option>
          ))}
        </select>
        {currentCategory && !currentCategory.hasReminders && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Для этой категории не требуется указывать дату платежа
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
        <div>
          <label htmlFor="subCostModal" className={labelBaseClass}>Стоимость</label>
          <input 
            type="number" 
            id="subCostModal" 
            placeholder="169" 
            value={cost} 
            onChange={(e) => setCost(e.target.value)} 
            className={inputBaseClass} 
            step="0.01" 
            min="0.01" 
            required 
          />
        </div>
        <div>
          <label htmlFor="subCurrencyModal" className={labelBaseClass}>Валюта</label>
          <select 
            id="subCurrencyModal" 
            value={currency} 
            onChange={(e) => setCurrency(e.target.value)} 
            className={inputBaseClass}
          >
            <option value="RUB">RUB</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="RSD">RSD</option>
          </select>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${showDatePicker ? 'sm:grid-cols-2' : ''} gap-x-4 gap-y-6`}>
        <div>
          <label htmlFor="subCycleModal" className={labelBaseClass}>Цикл оплаты</label>
          <select 
            id="subCycleModal" 
            value={cycle} 
            onChange={(e) => setCycle(e.target.value)} 
            className={inputBaseClass}
          >
            <option value="monthly">Ежемесячно</option>
            <option value="annually">Ежегодно</option>
          </select>
        </div>

        {showDatePicker && (
          <div>
            <label htmlFor="subPaymentDayModal" className={labelBaseClass}>
              Дата старта подписки <span className="text-red-500">*</span>
            </label>
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
              required={showDatePicker}
              popperClassName="z-[9999]"
              portalId="root-portal"
            />
          </div>
        )}
      </div>

      {/* Секция уведомлений в Telegram */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="mb-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary focus:ring-opacity-50"
            />
            <span className="ml-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Включить уведомления в Telegram
            </span>
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 ml-6">
            Бот будет напоминать о предстоящих платежах
          </p>
        </div>

        {notificationsEnabled && (
          <div className="ml-6 space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              Напоминать за:
            </p>
            <div className="space-y-2">
              {[
                { value: 1, label: '1 день до платежа' },
                { value: 3, label: '3 дня до платежа' },
                { value: 7, label: '7 дней до платежа' }
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyDaysBefore.includes(value)}
                    onChange={() => handleDayToggle(value)}
                    className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary focus:ring-opacity-50"
                  />
                  <span className="ml-2 text-sm text-slate-600 dark:text-slate-300">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            {notifyDaysBefore.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                Выберите хотя бы один период для уведомлений
              </p>
            )}
          </div>
        )}
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