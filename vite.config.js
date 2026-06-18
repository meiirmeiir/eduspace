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
        // Группируем ТОЛЬКО по пути node_modules — import-связи не меняем, поэтому
        // manualChunks лишь группирует, не меняет КОГДА грузится. firebase/katex/framer
        // — в initial через eager-код (кэш-выигрыш, не defer). map — СЕЙЧАС тоже в initial
        // из-за vestigial-импортов @xyflow/dagre в App.jsx (defer = убрать их, отд. шаг);
        // defer katex = отд. Фаза 3. React/react-dom НЕ выделяем — всегда нужны, в main.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase'
          if (/[\\/](katex|react-katex)[\\/]/.test(id)) return 'katex'
          if (/[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'framer-motion'
          if (/[\\/](@xyflow|@dagrejs|d3-[a-z]+)[\\/]/.test(id)) return 'map'
        },
      },
    },
  },
})
