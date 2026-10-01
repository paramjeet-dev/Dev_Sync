import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  server: {
    port: 5173,
    host: true,
  },
});
