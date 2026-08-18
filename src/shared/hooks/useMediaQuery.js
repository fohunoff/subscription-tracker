import { useEffect, useState } from 'react';

/**
 * Подписка на медиазапрос.
 *
 * Нужен там, где адаптивность нельзя выразить классами Tailwind: например
 * график трат рисуется в SVG, и его геометрия (viewBox, ширина столбцов,
 * шаг подписей) должна отличаться на узких экранах, а не масштабироваться
 * вместе с картинкой — при сжатии 720-пиксельного viewBox до 340
 * одиннадцатипиксельные подписи превращаются в пятипиксельные.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);

    // Значение могло измениться между первым рендером и подпиской
    setMatches(media.matches);
    media.addEventListener('change', onChange);

    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
