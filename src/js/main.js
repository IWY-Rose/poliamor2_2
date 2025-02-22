import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { AssetLoader } from './core/AssetLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

class GameEngine {
    constructor() {
        this.init();
        this.keys = {};
        this.setupKeyboardControls();
        this.mouseDown = false;
        this.rotateSpeed = 0.002;
        this.theta = 0;
        this.phi = 0;
        this.radius = 350;
        this.rotationSpeed = 1;
        this.crosshair = this.createCrosshair();
        this.cameraRotateSpeed = 1.5; // radians per second
        this.crosshair.style.display = 'none'; // Hide crosshair
        document.body.style.cursor = 'default'; // Restore cursor
        this.planeMesh = null; // Store reference to Plane001
        this.gravity = -50000; // Increased from -9.8 to -25 (much stronger pull)
        this.velocityY = 0;
        this.isGrounded = false;
        this.movementSpeedMultiplier = 1.6; // 1.6x speed boost
        this.maxRadius = 1000000;  // Increased from 100,000 to 1,000,000
    }

    async init() {
        console.log('Three.js version:', THREE.REVISION);
        
        // Initialize core systems
        this.renderer = new Renderer();
        this.assetLoader = new AssetLoader();
        this.scene = new THREE.Scene();
        
        // Camera setup with extended far plane
        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            1000000  // Increased from 100,000 to 1,000,000
        );
        this.modelCenter = new THREE.Vector3(0, -5, 0); // Model's position from setupScene
        this.camera.position.set(0, 25, 50);
        this.camera.lookAt(this.modelCenter);

        // Orbital radius range
        this.maxRadius = 1000000;  // New maximum distance
        
        // Load both models
        try {
            console.log('Starting model load...');
            const [baseModel, newModel] = await Promise.all([
                this.assetLoader.loadGLB(`${import.meta.env.BASE_URL}models/16064_autosave222.glb`),
                this.assetLoader.loadGLB(`${import.meta.env.BASE_URL}models/newproject.glb`)
            ]);
            
            console.log('Both models loaded successfully');
            this.setupScene(baseModel.scene, newModel.scene);
            this.hideLoadingScreen();
            this.animate();
        } catch (error) {
            console.error('Error loading assets:', error);
        }

        // Proper capability check after renderer initialization
        console.log('Renderer capabilities:', this.renderer.instance.capabilities);
        console.log('Logarithmic depth support:', 
            this.renderer.instance.capabilities.logarithmicDepthBuffer);

        // After scene creation
        console.log('THREE exists?', typeof THREE !== 'undefined');
        console.log('Scene children:', this.scene.children);

        // In init() after models load
        const gui = new GUI();
        gui.add(this, 'movementSpeedMultiplier', 0.5, 30.0).name('Speed Multiplier');
    }

    setupScene(baseModel, newModel) {
        // Clear previous scene
        while(this.scene.children.length > 0) { 
            this.scene.remove(this.scene.children[0]); 
        }

        // Configure base model (mapita.glb)
        this.baseModel = baseModel;
        baseModel.scale.set(30, 30, 30);
        baseModel.position.set(0, -5, 0);
        baseModel.rotation.set(0, Math.PI/4, 0);

        // Calculate base model's surface height
        const baseBBox = this.getModelBoundingBox(baseModel);
        const baseSurfaceY = baseBBox.max.y;

        // Find the "Plane001" mesh
        let planeMesh;
        baseModel.traverse(child => {
            if (child.isMesh && child.name === "Plane001") {
                planeMesh = child;
                return;  // Exit traversal after finding
            }
        });

        if (!planeMesh) {
            console.error('Plane001 mesh not found!');
            console.log('Available meshes:');
            baseModel.traverse(child => {
                if (child.isMesh) console.log('-', child.name);
            });
            return;
        }

        //Get Cone position
        let coneMesh;
        baseModel.traverse(child => {
            if (child.isMesh && child.name === "Cone") {
                coneMesh = child;
                return;  // Exit traversal after finding
            }
        });

        if (!coneMesh) {
            console.error('Cone mesh not found!');
            console.log('Available meshes:');
            baseModel.traverse(child => {
                if (child.isMesh) console.log('-', child.name);
            });
            return;
        }

        // Get plane's world position and dimensions
        const planePosition = new THREE.Vector3();
        planeMesh.getWorldPosition(planePosition);
        const planeBBox = new THREE.Box3().setFromObject(planeMesh);
        const planeHeight = planeBBox.max.y - planeBBox.min.y;

        //Get Cone's world position and dimensions
        const conePosition = new THREE.Vector3();
        planeMesh.getWorldPosition(conePosition);
        const coneBBox = new THREE.Box3().setFromObject(coneMesh);
        const coneHeight = coneBBox.max.y - coneBBox.min.y;

        // Position new model (modified Y position)
        this.newModel = newModel;
        newModel.scale.set(90, 90, 90);
        newModel.position.set(
            planePosition.x - 18000,
            planePosition.y + planeHeight - 35000,  // Changed from -8040 to -8045 (5 units lower)
            planePosition.z + 15000
        );
        newModel.rotation.set(0, 0, 0);

        // Add both models to scene
        this.scene.add(baseModel, newModel);

        // Remove existing lights
        this.scene.traverse(child => {
            if (child.isLight) {
                this.scene.remove(child);
            }
        });

        // Add shadow-friendly lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        
        // Adjusted diagonal lighting from top-right
        directionalLight.position.set(50, 100, -50);  // X/Z offset for diagonal angle
        directionalLight.castShadow = true;
        
        // Shadow configuration
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;

        // Enable shadows on models
        baseModel.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        newModel.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Add lights to scene
        this.scene.add(ambientLight, directionalLight);

        // Enable shadow map in renderer
        this.renderer.instance.shadowMap.enabled = true;
        this.renderer.instance.shadowMap.type = THREE.PCFSoftShadowMap;

        // Set camera focus to new model
        this.modelCenter = new THREE.Vector3().copy(newModel.position);
        
        // Update camera to look at new model
        this.camera.position.set(0, 15, 30);
        this.camera.lookAt(this.modelCenter);

        console.log('Base model surface height:', baseSurfaceY);
        console.log('New model position:', newModel.position.y);

        console.log('Base Model Structure:');
        baseModel.traverse(child => {
            if (child.isMesh) {
                console.log('Base Model Part:', child.name, child.type);
                this.logTextures(child);
            }
        });

        console.log('New Model Structure:');
        newModel.traverse(child => {
            if (child.isMesh) {
                console.log('New Model Part:', child.name, child.type);
                this.logTextures(child);
            }
        });

        // Store Plane001 reference
        baseModel.traverse(child => {
            if (child.isMesh && child.name === "Plane001") {
                this.planeMesh = child;
            }
        });

        // Store player model reference and calculate height
        newModel.updateMatrixWorld(true); // Ensure transformations are applied
        const playerBBox = new THREE.Box3().setFromObject(newModel);
        this.playerHeight = playerBBox.max.y - playerBBox.min.y;
        console.log('Calculated player height:', this.playerHeight);
    }

    getModelBoundingBox(model) {
        const bbox = new THREE.Box3();
        model.traverse(child => {
            if (child.isMesh) {
                const geometry = child.geometry;
                geometry.computeBoundingBox();
                bbox.union(geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
            }
        });
        return bbox;
    }

    setupKeyboardControls() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    handleCameraRotation(deltaTime) {
        const rotationAmount = this.cameraRotateSpeed * deltaTime;
        
        if (this.keys['arrowright']) this.theta -= rotationAmount;
        if (this.keys['arrowleft']) this.theta += rotationAmount;
        if (this.keys['arrowup']) this.phi = THREE.MathUtils.clamp(
            this.phi + rotationAmount,
            -Math.PI/2,
            Math.PI/2
        );
        if (this.keys['arrowdown']) this.phi = THREE.MathUtils.clamp(
            this.phi - rotationAmount,
            -Math.PI/2,
            Math.PI/2
        );
    }

    handleMovement(deltaTime) {
        if (!this.newModel || !this.planeMesh) return;

        const moveSpeed = 800 * this.movementSpeedMultiplier * deltaTime;
        
        // Get camera's forward direction (always where the camera is pointing)
        const cameraForward = new THREE.Vector3();
        this.camera.getWorldDirection(cameraForward);
        cameraForward.y = 0;
        cameraForward.normalize();

        // Calculate right vector relative to camera
        const cameraRight = new THREE.Vector3()
            .crossVectors(new THREE.Vector3(0, 1, 0), cameraForward)
            .normalize();

        // Always face the direction the camera is looking
        this.newModel.rotation.y = Math.atan2(cameraForward.x, cameraForward.z);

        // Camera-relative movement
        if (this.keys['w']) this.newModel.position.add(cameraForward.multiplyScalar(moveSpeed));
        if (this.keys['s']) this.newModel.position.add(cameraForward.multiplyScalar(-moveSpeed));
        if (this.keys['d']) this.newModel.position.add(cameraRight.multiplyScalar(-moveSpeed));
        if (this.keys['a']) this.newModel.position.add(cameraRight.multiplyScalar(moveSpeed));

        // Apply stronger gravity ONLY to player
        this.velocityY += this.gravity * deltaTime;
        this.newModel.position.y += this.velocityY * deltaTime;

        // Ground collision check
        const surfaceY = this.getSurfaceHeight(
            this.newModel.position.x, 
            this.newModel.position.z
        );
        
        if (surfaceY !== undefined) {
            // Use 10% of player height as clearance
            const groundClearance = this.playerHeight * 0.1;
            
            if (this.newModel.position.y <= surfaceY + groundClearance) {
                this.newModel.position.y = surfaceY + groundClearance;
                this.velocityY = 0;
                this.isGrounded = true;
            } else {
                this.isGrounded = false;
            }
        }

        // Force precise position alignment when grounded
        if (this.isGrounded && !this.keys[' ']) {
            this.velocityY = 0;
            // Directly set to surface without offset
            const currentSurfaceY = this.getSurfaceHeight(
                this.newModel.position.x,
                this.newModel.position.z
            );

            
            if (currentSurfaceY !== undefined) {
                this.newModel.position.y = currentSurfaceY;
            }
        }

        // Increased jump force to match stronger gravity
        if (this.isGrounded && this.keys[' ']) {
            this.velocityY = 12; // Increased from 7 to 12
        }

        // Update camera focus (maintain relative position)
        this.modelCenter.copy(this.newModel.position);

        
        console.log('Player Y:', this.newModel.position.y, 
            'Velocity Y:', this.velocityY,
            'Grounded:', this.isGrounded);
            
    }

    animate() {
        let lastTime = performance.now();
        let maxDelta = 1/30; // Max 30ms frame time (≈33ms per frame)
        
        const animateFrame = (now) => {
            requestAnimationFrame(animateFrame);
            
            let deltaTime = (now - lastTime) / 1000;
            lastTime = now;

            // Prevent physics explosions when tab is backgrounded
            deltaTime = Math.min(deltaTime, maxDelta);

            this.handleCameraRotation(deltaTime);
            this.handleMovement(deltaTime);
            this.updateCameraPosition();
            this.renderer.instance.render(this.scene, this.camera);
        }
        
        animateFrame(performance.now());
    }

    hideLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'none';
    }

    updateCameraPosition() {
        this.camera.position.x = this.modelCenter.x + this.radius * 
            Math.cos(this.theta) * Math.cos(this.phi);
        this.camera.position.y = this.modelCenter.y + this.radius * 
            Math.sin(this.phi);
        this.camera.position.z = this.modelCenter.z + this.radius * 
            Math.sin(this.theta) * Math.cos(this.phi);
        this.camera.lookAt(this.modelCenter);
    }

    createCrosshair() {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            width: 20px;
            height: 20px;
            transform: translate(-50%, -50%);
            pointer-events: none;
        `;
        div.innerHTML = `
            <div style="position:absolute;width:100%;height:2px;top:9px;background:#fff;"></div>
            <div style="position:absolute;height:100%;width:2px;left:9px;background:#fff;"></div>
        `;
        document.body.appendChild(div);
        return div;
    }

    getSurfaceHeight(x, z) {
        const meshesToTest = [];
        this.scene.traverse(child => {
            if (child.isMesh && !child.name.toLowerCase().includes('image')) {
                meshesToTest.push(child);
            }
        });
        
        if (meshesToTest.length === 0) return undefined;
        
        const raycaster = new THREE.Raycaster();
        // Cast from extremely high to extremely low
        const start = new THREE.Vector3(
            x, 
            1000000,  // Start at 1 million units up
            z
        );
        const direction = new THREE.Vector3(0, -1, 0);
        raycaster.set(start, direction);
        raycaster.far = 2000000;  // Cast 2 million units down
        
        const intersects = raycaster.intersectObjects(meshesToTest);
        return intersects.length > 0 ? intersects[0].point.y : undefined;
    }

    logTextures(mesh) {
        if (!mesh.material) return;
        
        const materials = Array.isArray(mesh.material) ? 
            mesh.material : [mesh.material];
            
        materials.forEach((material, index) => {
            console.group(`Material ${index} for ${mesh.name}`);
            console.log('Material type:', material.type);
            
            const textureTypes = [
                'map', 'normalMap', 'roughnessMap', 
                'metalnessMap', 'aoMap', 'displacementMap'
            ];
            
            textureTypes.forEach(type => {
                if (material[type]) {
                    console.log(
                        `${type}:`, 
                        material[type].image ? 
                            material[type].image.src : 
                            'Texture exists but no image data'
                    );
                }
            });
            
            console.groupEnd();
        });
    }
}

new GameEngine(); 