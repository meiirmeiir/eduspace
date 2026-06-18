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
        // Группируем eager-vendor (firebase/katex/framer) в кэш-чанки: меняются редко
        // vs app-код → returning-юзер не перекачивает их при app-деплое. React/react-dom
        // НЕ выделяем — всегда нужны, в main. map-stack (@xyflow/dagre/d3) НАМЕРЕННО НЕ
        // группируем: он lazy (только map-экраны), а явный manualChunk заставлял Vite
        // preload'ить его в index.html (eager, −116КБ зря). Без группы Rollup авто-чанкует
        // его в общий lazy-чанк → грузится только при открытии карты. (Защита: App.jsx
        // больше не импортит @xyflow vestigial-импортами — иначе он попал бы в eager-граф.)
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase'
          if (/[\\/](katex|react-katex)[\\/]/.test(id)) return 'katex'
          if (/[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'framer-motion'
        },
      },
    },
  },
})
