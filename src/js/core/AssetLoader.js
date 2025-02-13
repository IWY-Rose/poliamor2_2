import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetLoader {
    constructor() {
        this.loadingManager = new THREE.LoadingManager();
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        this.gltfLoader = new GLTFLoader(this.loadingManager);
        
        // Draco compression (if used)
        // import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
        // const dracoLoader = new DRACOLoader();
        // dracoLoader.setDecoderPath('/draco/');
        // this.gltfLoader.setDRACOLoader(dracoLoader);
    }

    loadGLB(path) {
        return new Promise((resolve, reject) => {
            if (!path) {
                reject(new Error('Invalid path provided'));
                return;
            }
            
            this.gltfLoader.load(path, 
                (gltf) => {
                    if (!gltf.scene) {
                        reject(new Error('Loaded GLTF has no scene property'));
                        return;
                    }
                    resolve(gltf);
                },
                (progress) => {
                    console.log(`Loading ${path}: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
                },
                (error) => {
                    console.error('GLB Load Error:', error);
                    reject(error);
                }
            );
        });
    }
} 