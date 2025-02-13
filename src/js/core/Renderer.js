import * as THREE from 'three';

export class Renderer {
    constructor() {
        const canvas = document.querySelector('#gameCanvas');
        if (!canvas) throw new Error('Canvas element not found!');
        
        // Version 0.152.0 compatible WebGL check
        try {
            const testRenderer = new THREE.WebGLRenderer();
            testRenderer.dispose();
        } catch(e) {
            const warning = document.createElement('div');
            warning.textContent = 'WebGL not supported: ' + e.message;
            document.body.appendChild(warning);
            throw e;
        }

        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: true,
            shadowMapEnabled: true  // Ensure shadow support
        });
        
        // Performance optimizations
        this.renderer.autoClear = false;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Set background color directly
        this.renderer.setClearColor(new THREE.Color(0x87CEEB), 1);
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    get instance() {
        return this.renderer;
    }
} 