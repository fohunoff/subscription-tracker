import { useEffect } from 'react';
import { useLocalStorage } from '../../../shared/hooks';

export function useTheme(defaultTheme = 'light') {
  const [theme, setTheme] = useLocalStorage('theme', defaultTheme);

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [theme]);

  return [theme, setTheme];
}
