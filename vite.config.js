import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Ältere Handy-Browser (z. B. Chrome 91 auf Android 10) kennen manche neue Schreibweisen nicht
  build: { target: 'es2020' },
});
