import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function mediapipeTaskMimePlugin(): Plugin {
  const setTaskMime = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    if (req.url && req.url.split('?')[0].endsWith('.task')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    next();
  };

  return {
    name: 'mediapipe-task-mime',
    configureServer(server) {
      server.middlewares.use(setTaskMime);
    },
    configurePreviewServer(server) {
      server.middlewares.use(setTaskMime);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mediapipeTaskMimePlugin()],
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  server: {
    port: 5173,
    host: true,
  },
});
