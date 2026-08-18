import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Хеш коммита вшивается в бандл на этапе сборки: по нему из бага в проде видно,
// какая именно сборка на экране — версия в package.json меняется реже, чем код.
// Сборка бывает и вне git (скачанный архив, CI без истории) — тогда остаётся
// версия, а хеш становится 'unknown'; падать из-за этого сборке незачем.
const gitCommit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim()
  } catch {
    return 'unknown'
  }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Значения подставляются как литералы на этапе сборки; читать их из кода
  // следует через src/shared/config.js, а не напрямую.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitCommit),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    // Отключаем кеширование в dev режиме
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  build: {
    // Добавляем хеш к файлам при сборке
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})
