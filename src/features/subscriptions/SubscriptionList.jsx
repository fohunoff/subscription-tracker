import React from 'react';
import SubscriptionItem from './SubscriptionItem';
import { DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';

function SubscriptionList({ subscriptions, onDeleteSubscription, onEditSubscription }) {
  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12 px-6 border-2 border-dashed border-slate-300 rounded-lg">
        <DocumentMagnifyingGlassIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
        <p className="text-xl font-medium text-slate-600">Список подписок пуст.</p>
        <p className="text-slate-500 mt-1">Добавьте свою первую подписку, чтобы начать отслеживать расходы.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {subscriptions.map((sub) => (
        <SubscriptionItem
          key={sub.id}
          subscription={sub}
          onDeleteSubscription={onDeleteSubscription}
          onEditSubscription={onEditSubscription}
        />
      ))}
    </ul>
  );
}

export default SubscriptionList;