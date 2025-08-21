import { VitePWA } from 'vite-plugin-pwa';
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
      },
      plugins: [
        VitePWA({
          registerType: 'autoUpdate',
          manifest: {
            name: 'FantaPilot',
            short_name: 'FantaPilot',
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#10b981',
            icons: [
              {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
              },
              {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
              },
            ],
          },
        })
      ]
    };
});
