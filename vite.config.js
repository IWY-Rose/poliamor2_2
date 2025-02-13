import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    publicDir: 'public',
    build: {
        assetsInlineLimit: 4096, // Optimize asset inlining
        rollupOptions: {
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