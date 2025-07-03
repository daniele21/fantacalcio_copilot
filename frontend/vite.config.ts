import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.BASE_URL': JSON.stringify(env.API_URL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          react: path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
        }
      },
      server: {
        proxy: {
          '/api': 'https://fantacalcio-backend-ze7lkfza2a-ew.a.run.app'
        }
      }
    };
});
