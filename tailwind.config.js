/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Важно указать все файлы, где будут Tailwind классы
  ],
  theme: {
    extend: {
      // Здесь можно добавить свои кастомные цвета, шрифты и т.д.
      // Пример:
      colors: {
        'brand-primary': '#3B82F6', // Синий (blue-500)
        'brand-secondary': '#10B981', // Зеленый (emerald-500)
        'brand-danger': '#EF4444', // Красный (red-500)
        'brand-light': '#F9FAFB',  // Очень светлый серый (gray-50)
        'brand-dark': '#1F2937',   // Темно-серый (gray-800)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // Пример использования другого шрифта
      }
    },
  },
  plugins: [
    import('@tailwindcss/forms'), // Очень полезен для стилизации форм
  ],
}