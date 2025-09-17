import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'public', // 明确指定根目录为public
  server: {
    historyApiFallback: true,
    port: 5174,
    // 本地开发代理：将 /api/music-list 指向 node server.js 的 3000 端口
    // 确保使用 http://localhost:5174/ 打开时也能获取音乐清单
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            console.error('[vite proxy] /api error:', err.message || err);
          });
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: '../dist'
  }
});