import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // 圧縮（ミニファイ）をオフにして、関数名が勝手に書き換えられるのを防ぐ
    minify: false
  }
});