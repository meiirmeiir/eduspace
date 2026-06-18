import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vendor в отдельные кэш-чанки: либы меняются РЕДКО (обновления) vs app-код
        // (часто) → при деплое app-кода юзер не перекачивает firebase/katex/framer/map
        // (они кэшированы по хешу). Плюс параллельная загрузка и дедуп общих vendor.
        // Группируем eager-vendor (firebase/framer) в кэш-чанки: меняются редко vs app-код
        // → returning-юзер не перекачивает их при app-деплое. React/react-dom НЕ выделяем —
        // всегда нужны, в main. НАМЕРЕННО НЕ группируем LAZY-vendor (map-stack @xyflow/dagre/d3
        // и katex/react-katex): они нужны только на lazy-экранах (карта; формулы через
        // LatexText), а явный manualChunk заставлял Vite preload'ить чанк в index.html (eager,
        // зря). Без группы Rollup авто-чанкует их в общий lazy-чанк → грузятся по требованию.
        // (Защита: App.jsx больше не импортит @xyflow/react-katex vestigial-импортами.)
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase'
          if (/[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'framer-motion'
        },
      },
    },
  },
})
