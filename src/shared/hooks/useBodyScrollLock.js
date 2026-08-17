import { useEffect } from 'react';

/**
 * Блокировка прокрутки фона на время модального окна или боковой панели.
 *
 * `overflow: hidden` убирает у страницы скроллбар, и на десктопе контент
 * прыгал вправо на его ширину в момент открытия окна (и обратно при закрытии).
 * Поэтому вместе с блокировкой добавляем body отступ ровно в ширину исчезнувшего
 * скроллбара — ширина считается по фактической разнице `innerWidth` и
 * `clientWidth`, а не константой: на мобильных и при overlay-скроллбарах она 0.
 *
 * Блокировки считаются, а не выставляются флагом: окно правки открывается
 * поверх боковой панели, и закрытие любого из них вернуло бы прокрутку фона,
 * пока второе ещё на экране.
 */
let lockCount = 0;
let savedOverflow = '';
let savedPaddingRight = '';

const lock = () => {
  const { body } = document;

  if (lockCount === 0) {
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const currentPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }

    body.style.overflow = 'hidden';
  }

  lockCount += 1;
};

const unlock = () => {
  lockCount = Math.max(0, lockCount - 1);

  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
};

export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return undefined;

    lock();
    return unlock;
  }, [isLocked]);
}

export default useBodyScrollLock;
