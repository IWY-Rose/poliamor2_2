import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: './',
    publicDir: 'public',
    build: {
        assetsInlineLimit: 4096, // Optimize asset inlining
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                game: resolve(__dirname, 'game.html'),
                gallery: resolve(__dirname, 'gallery.html'),
                player: resolve(__dirname, 'player.html'),
                merch: resolve(__dirname, 'merch.html'),
                test: resolve(__dirname, 'test.html')
            },
            output: {
                manualChunks: {
                    three: ['three']
                }
            }
        }
    },
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp'
        }
    }
}); 