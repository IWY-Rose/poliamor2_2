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
        this.movementSpeedMultiplier = 3; // 1.6x speed boost
        this.maxRadius = 1000000;  // Increased from 100,000 to 1,000,000
        this.coordDisplay = this.createCoordinateDisplay();
        this.currentCollisionMesh = null;
        this.currentGroundMesh = null;
        this.jumpVelocity = 25000; // Initial upward velocity when jumping
        this.canJump = true; // Flag to prevent double-jumping
        this.starRotationSpeed = 1.5; // radians per second
        this.freezeMovement = false; // Add this flag
        this.chestMessage = this.createChestMessage(); // Add chest message element
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
            const [baseModel, newModel, chestModel] = await Promise.all([
                this.assetLoader.loadGLB(`${import.meta.env.BASE_URL}models/16064_autosave222.glb`),
                this.assetLoader.loadGLB(`${import.meta.env.BASE_URL}models/newproject.glb`),
                this.assetLoader.loadGLB(`${import.meta.env.BASE_URL}models/chest.glb`)
            ]);
            
            console.log('All models loaded successfully');
            this.setupScene(baseModel.scene, newModel.scene, chestModel.scene);
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

    setupScene(baseModel, newModel, chestModel) {
        // Replace problematic scene clearing with safer method
        this.scene.clear();  // Use Three.js's built-in clear method instead of manual removal
        
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

        // Get plane's world position and dimensions
        const planePosition = new THREE.Vector3();
        planeMesh.getWorldPosition(planePosition);
        const planeBBox = new THREE.Box3().setFromObject(planeMesh);
        const planeHeight = planeBBox.max.y - planeBBox.min.y;

        // Position new model (modified Y position)
        this.newModel = newModel;
        newModel.scale.set(90, 90, 90);
        newModel.position.set(
            planePosition.x - 18000,
            planePosition.y + planeHeight - 36500,
            planePosition.z + 15000
        );
        
        // Store original position as offset
        this.coordinateOffset = new THREE.Vector3().copy(newModel.position);

        // Position chest using the same coordinate system as other models
        this.chestModel = chestModel
        chestModel.scale.set(150, 150, 150)
        chestModel.position.set(
            planePosition.x - 50000,
            planePosition.y + planeHeight - 36675,
            planePosition.z + 12000
        );
        chestModel.rotation.y = -Math.PI/6

        // Create star shape above chest
        const starShape = new THREE.Shape();
        const points = 5;
        const innerRadius = 20;
        const outerRadius = 40;

        starShape.moveTo(outerRadius, 0);
        for(let i = 0; i < 2 * points; i++) {
            const angle = (i * Math.PI) / points;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            starShape.lineTo(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            );
        }
        starShape.closePath();

        const extrudeSettings = {
            depth: 1,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 2,
            bevelSize: 5,
            bevelThickness: 5
        };

        const starGeometry = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
        const starMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xFFFF00,
            specular: 0x111111,
            shininess: 1000
        });
        this.starMesh = new THREE.Mesh(starGeometry, starMaterial);

        // Position star above chest
        this.starMesh.scale.set(4, 4, 4)
        this.starMesh.position.copy(chestModel.position);
        this.starMesh.position.y += 500; // Adjust this value to change height
        this.starMesh.position.z -= 100;
        //starMesh.rotation.x = -Math.PI/2; // Rotate to face camera
        this.starMesh.rotation.y = -Math.PI/4;

        // Add star to scene
        this.scene.add(this.starMesh);

        // Add all models to scene
        this.scene.add(baseModel, newModel, chestModel);

        // Remove existing lights - fix traversal issue
        const lightsToRemove = [];
        this.scene.traverse(child => {
            if (child.isLight) {
                lightsToRemove.push(child);
            }
        });

        // Remove collected lights after traversal
        lightsToRemove.forEach(light => {
            this.scene.remove(light);
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

        // Create and position point light at star's location
        this.starLight = new THREE.PointLight(0xffc45d, 10.0, 10000, 2);
        this.starLight.position.copy(this.starMesh.position);
        this.starLight.castShadow = true;
        this.scene.add(this.starLight);

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

        // Store player model reference and calculate dimensions
        newModel.updateMatrixWorld(true);
        const playerBBox = new THREE.Box3().setFromObject(newModel);
        this.playerHeight = playerBBox.max.y - playerBBox.min.y;
        this.playerHalfWidth = (playerBBox.max.x - playerBBox.min.x) / 2;
        this.playerHalfDepth = (playerBBox.max.z - playerBBox.min.z) / 2;
        console.log('Calculated player dimensions:', this.playerHeight, this.playerHalfWidth, this.playerHalfDepth);

        // Store Cone reference
        baseModel.traverse(child => {
            if (child.isMesh && child.name === "Cone") {
                this.coneMesh = child;
            }
        });
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
            
            // Add Q key handling
            if (e.key.toLowerCase() === 'q' && this.freezeMovement) {
                this.freezeMovement = false;
                this.chestMessage.style.display = 'none';
                
                // Move player back 100 units in camera direction
                const cameraForward = new THREE.Vector3();
                this.camera.getWorldDirection(cameraForward);
                const backwardVector = cameraForward.multiplyScalar(-100);
                this.newModel.position.add(backwardVector);
                
                this.coordDisplay.style.display = 'block';
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }

    handleCameraRotation(deltaTime) {
        if (this.freezeMovement) return; // Prevent camera movement when frozen
        const rotationAmount = this.cameraRotateSpeed * deltaTime;
        
        if (this.keys['arrowright']) this.theta -= rotationAmount;
        if (this.keys['arrowleft']) this.theta += rotationAmount;
        if (this.keys['arrowup']) this.phi = THREE.MathUtils.clamp(
            this.phi + rotationAmount,
            -Math.PI/4,
            Math.PI/4
        );
        if (this.keys['arrowdown']) this.phi = THREE.MathUtils.clamp(
            this.phi - rotationAmount,
            -Math.PI/25,
            Math.PI/25
        );
    }

    handleMovement(deltaTime) {
        if (this.freezeMovement) return; // Prevent movement when frozen
        if (!this.newModel || !this.planeMesh) return;

        const moveSpeed = 800 * this.movementSpeedMultiplier * deltaTime;
        
        // Handle jumping with spacebar
        if (this.keys[' '] && this.isGrounded && this.canJump) {
            this.velocityY = this.jumpVelocity;
            this.isGrounded = false;
            this.canJump = false;
        }
        
        // Reset ability to jump when grounded
        if (this.isGrounded) {
            this.canJump = true;
        }

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

        // Horizontal collision check (4 directions)
        const directions = [
            new THREE.Vector3(1, 0, 0),  // Right
            new THREE.Vector3(-1, 0, 0), // Left
            new THREE.Vector3(0, 0, 1),  // Forward
            new THREE.Vector3(0, 0, -1)  // Backward
        ];
        
        const collisionDistance = 10; // Detection distance in units
        let collisionDetected = false;

        // List of meshes that trigger player reset (remove Cone002)
        const resetMeshes = [
            'Cube001', 'Cube002', 'Cube003', 'Cube005', 'Cube006',
            'Cone001',
            'images', 'images001', 'images002', 'images003', 'images004', 'images005',
            'Sphere001', 'Sphere002',
            'Cylinder', 'Cylinder001'
        ];

        directions.forEach(dir => {
            const raycaster = new THREE.Raycaster(
                this.newModel.position, 
                dir, 
                0, 
                collisionDistance
            );
            
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            intersects.forEach(intersect => {
                if (intersect.object.isMesh) {
                    if (resetMeshes.includes(intersect.object.name)) {
                        collisionDetected = true;
                    }
                    else if (intersect.object.name === 'Cone002') {
                        // Generate random number (1 or 2)
                        const randomChance = Math.floor(Math.random() * 2) + 1;
                        
                        // Only teleport if random number is 1
                        if (randomChance === 1) {
                            // Get Cone002's world position and bounding box
                            const cone = intersect.object;
                            cone.updateMatrixWorld(true);
                            const bbox = new THREE.Box3().setFromObject(cone);
                            
                            // Teleport to top of cone
                            this.newModel.position.set(
                                cone.position.x,
                                bbox.max.y + this.playerHeight/2,  // Stand on top
                                cone.position.z
                            );
                            
                            // Reset vertical velocity
                            this.velocityY = 0;
                            this.isGrounded = true;
                            this.currentCollisionMesh = cone;
                        }
                        // If random number is 2, do nothing (pass through)
                    }
                    else if (intersect.object.name === 'Sphere') {
                        // Find Cone mesh in the scene
                        let coneMesh;
                        this.scene.traverse(child => {
                            if (child.isMesh && child.name === 'Cone') {
                                coneMesh = child;
                            }
                        });
                        
                        if (coneMesh) {
                            coneMesh.updateMatrixWorld(true);
                            const bbox = new THREE.Box3().setFromObject(coneMesh);
                            this.newModel.position.set(
                                coneMesh.position.x - 10000,
                                bbox.max.y + this.playerHeight/2,
                                coneMesh.position.z + 15000
                            );
                            this.velocityY = 0;
                            this.isGrounded = true;
                            this.currentCollisionMesh = coneMesh;
                        }
                    }
                    else if (intersect.object.name === 'Cube004' && this.newModel.position.y < -1575) {
                        // Clamp Y position to -1575 but allow X/Z movement
                        this.newModel.position.y = -1575;
                        this.velocityY = 0;
                        this.isGrounded = true;
                        this.currentCollisionMesh = intersect.object;
                    }
                }
            });
        });

        // Reset player if collision detected with specified meshes
        if (collisionDetected) {
            this.newModel.position.copy(this.coordinateOffset);
            this.velocityY = 0;
            this.isGrounded = true;
        }

        if (this.isGrounded && this.newModel.position.y == -3675.4) {
                // Clamp Y position to -1575 but allow X/Z movement
                this.newModel.position.y = -1575;
                this.velocityY = 0;
                this.isGrounded = true;
                this.currentCollisionMesh = intersect.object;
            }

        // Existing Y-axis reset (keep this)
        if (this.newModel.position.y <= -16000) {
            this.newModel.position.copy(this.coordinateOffset);
            this.velocityY = 0;
            this.isGrounded = true;
        }

        // Enhanced vertical collision detection
        const meshesToTest = [];
        this.scene.traverse(child => {
            if (child.isMesh && !child.name.toLowerCase().includes('image')) {
                meshesToTest.push(child);
            }
        });

        // Vertical collision check covering full player height
        const playerTop = this.newModel.position.y + this.playerHeight/2;
        const playerBottom = this.newModel.position.y - this.playerHeight/2;
        
        // Check vertical collisions first
        const verticalRaycaster = new THREE.Raycaster(
            new THREE.Vector3(this.newModel.position.x, playerTop, this.newModel.position.z),
            new THREE.Vector3(0, -1, 0),
            0,
            this.playerHeight // Check through entire player height
        );
        
        const verticalHit = verticalRaycaster.intersectObjects(meshesToTest)[0];
        if (verticalHit) {
            // Calculate surface position based on hit point
            const surfaceY = verticalHit.point.y;
            
            if (this.velocityY < 0) { // Moving downward
                // Position player on top of surface with full height
                this.newModel.position.y = surfaceY + this.playerHeight/2;
                this.velocityY = 0;
                this.isGrounded = true;
                this.currentCollisionMesh = verticalHit.object;
            } else if (this.velocityY > 0) { // Moving upward
                // Position player below ceiling
                this.newModel.position.y = surfaceY - this.playerHeight/2 - 1;
                this.velocityY = 0;
            }
        } else {
            this.isGrounded = false;
            this.currentCollisionMesh = null;
        }

        // Apply gravity only if not grounded
        if (!this.isGrounded) {
            this.velocityY += this.gravity * deltaTime;
            this.newModel.position.y += this.velocityY * deltaTime;
        }

        // Reset player if falls below -34000 Y position
        if (this.newModel.position.y <= -16000) {
            this.newModel.position.copy(this.coordinateOffset);
            this.velocityY = 0;
            this.isGrounded = true;
        }

        // Update coordinate display with offset adjustment
        const pos = this.newModel.position.clone().sub(this.coordinateOffset);
        const meshName = this.currentCollisionMesh ? 
            (this.currentCollisionMesh.name || 'Unnamed Mesh') : 'None';
        
        this.coordDisplay.textContent = 
            `X: ${pos.x.toFixed(1)} \u2022 ` +
            `Y: ${pos.y.toFixed(1)} \u2022 ` +
            `Z: ${pos.z.toFixed(1)} \n` +
            `VelY: ${this.velocityY.toFixed(1)} \u2022 ` +
            `Grounded: ${this.isGrounded} \n` +
            `Colliding with: ${meshName}`;

        // Update camera focus (maintain relative position)
        this.modelCenter.copy(this.newModel.position);

        // Add chest proximity check at the end of handleMovement
        const distanceToChest = this.newModel.position.distanceTo(this.chestModel.position);
        if (distanceToChest < 1000 && !this.freezeMovement) {
            this.freezeMovement = true;
            this.chestMessage.style.display = 'block';
            this.coordDisplay.style.display = 'none'; // Hide coordinate display
        }
    }

    animate() {
        let lastTime = performance.now();
        let maxDelta = 1/30;
        
        const animateFrame = (now) => {
            requestAnimationFrame(animateFrame);
            
            let deltaTime = (now - lastTime) / 1000;
            lastTime = now;

            // Prevent physics explosions when tab is backgrounded
            deltaTime = Math.min(deltaTime, maxDelta);

            // Add star rotation
            if (this.starMesh) {
                this.starMesh.rotation.y += this.starRotationSpeed * deltaTime;
            }

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

    createCoordinateDisplay() {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            color: white;
            font-family: monospace;
            background: rgba(0,0,0,0.7);
            padding: 8px;
            border-radius: 4px;
            z-index: 1000;
        `;
        document.body.appendChild(div);
        return div;
    }

    createChestMessage() {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-family: Arial, sans-serif;
            font-size: 2em;
            text-align: center;
            background: rgba(0,0,0,0.8);
            padding: 20px;
            border-radius: 10px;
            display: none;
            z-index: 1001;
        `;
        div.textContent = "Wow! A chest! I wonder what's inside";
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
        const direction = new THREE.Vector3(0, -1, 0);
        raycaster.far = 2000000;
        
        // Check multiple points around player's base
        const testPoints = [
            [x - this.playerHalfWidth, z - this.playerHalfDepth], // bottom-left
            [x + this.playerHalfWidth, z - this.playerHalfDepth], // bottom-right
            [x - this.playerHalfWidth, z + this.playerHalfDepth], // top-left
            [x + this.playerHalfWidth, z + this.playerHalfDepth], // top-right
            [x, z] // center
        ];
        
        let maxSurfaceY = -Infinity;
        let closestCollisionMesh = null;
        
        testPoints.forEach(([testX, testZ]) => {
            const start = new THREE.Vector3(testX, 1000000, testZ);
            raycaster.set(start, direction);
            const intersects = raycaster.intersectObjects(meshesToTest);
            
            if (intersects.length > 0) {
                const surfaceY = intersects[0].point.y;
                if (surfaceY > maxSurfaceY) {
                    maxSurfaceY = surfaceY;
                    closestCollisionMesh = intersects[0].object;
                }
            }
        });
        
        this.currentCollisionMesh = closestCollisionMesh;
        return maxSurfaceY !== -Infinity ? maxSurfaceY : undefined;
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