import React from 'react';
import { Modal } from '../../shared';
import ExportData from './ExportData';

/**
 * Импорт и экспорт подписок отдельным окном.
 *
 * Раньше блок висел секцией внизу главной страницы — под списком подписок,
 * архивом и графиком трат. Действие редкое (резервная копия, переезд), а места
 * занимало столько же, сколько ежедневные разделы, и на мобильных до него
 * приходилось прокручивать всю страницу. Точка входа — меню под аватаром,
 * рядом с настройками: и то и другое про «служебное», а не про подписки.
 */
const DataModal = ({ isOpen, onClose, subscriptions, categories, onImport }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Импорт / экспорт">
    <p className="text-sm text-slate-600 dark:text-slate-300">
      Экспортируйте свои подписки в JSON-файл для резервного копирования
      или импортируйте данные из файла.
    </p>
    <ExportData
      subscriptions={subscriptions}
      categories={categories}
      onImport={onImport}
    />
  </Modal>
);

export default DataModal;
