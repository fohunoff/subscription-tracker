import React from 'react';
import {
  PencilSquareIcon,
  ArchiveBoxIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

/**
 * Действия над подпиской из панели деталей.
 *
 * Живут в закреплённом футере `Drawer`, а не в конце содержимого: история
 * платежей длинная, и внутри прокручиваемой области кнопки оказывались
 * в десятках записей от начала панели.
 */
function SubscriptionDetailsActions({ subscription, onEdit, onArchive, onDelete }) {
  const isArchived = subscription.status === 'archived';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onEdit(subscription)}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-blue-600 transition-colors"
      >
        <PencilSquareIcon className="h-4 w-4" />
        Редактировать
      </button>

      {!isArchived && (
        <button
          type="button"
          onClick={() => onArchive(subscription)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40 transition-colors"
        >
          <ArchiveBoxIcon className="h-4 w-4" />
          Завершить
        </button>
      )}

      {/* Удаление необратимо — держим его отдельно от остальных кнопок */}
      <button
        type="button"
        onClick={() => onDelete(subscription)}
        className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
        title="Удалить подписку"
      >
        <TrashIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Удалить</span>
      </button>
    </div>
  );
}

export default SubscriptionDetailsActions;
