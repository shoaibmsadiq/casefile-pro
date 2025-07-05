import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Tell Vite to treat these as external and not bundle them
      external: ['moment', 'react-big-calendar'],
      output: {
        globals: {
          moment: 'moment',
          'react-big-calendar': 'ReactBigCalendar'
        }
      }
    }
  }
})
