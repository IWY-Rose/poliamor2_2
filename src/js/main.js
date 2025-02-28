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
        this.gravity = -50000; // Reduced from -50000 (weaker gravity for slower fall)
        this.velocityY = 0;
        this.isGrounded = false;
        this.movementSpeedMultiplier = 3; // 1.6x speed boost
        this.maxRadius = 1000000;  // Increased from 100,000 to 1,000,000
        this.coordDisplay = this.createCoordinateDisplay();
        this.currentCollisionMesh = null;
        this.currentGroundMesh = null;
        this.jumpVelocity = 30000; // Increased from 25000 (higher initial jump)
        this.canJump = true; // Flag to prevent double-jumping
        this.starRotationSpeed = 1.5; // radians per second
        this.freezeMovement = false; // Add this flag
        this.chestMessage = this.createChestMessage(); // Add chest message element
        this.isJumping = false;
        this.jumpStartTime = 0;
        this.jumpDuration = 1; // seconds for full jump cycle
        this.audioLoader = new THREE.AudioLoader();
        this.listener = new THREE.AudioListener();
        this.backgroundMusic = new THREE.Audio(this.listener);
        this.isMusicPlaying = false;
        this.jumpSound = new THREE.Audio(this.listener);
        this.landSound = new THREE.Audio(this.listener);
        this.walkSound = new THREE.Audio(this.listener); // Add this line
        this.isWalking = false; // Add this flag to track walking state
        this.creepyAudio = new THREE.Audio(this.listener);
        this.isPlayingCreepy = false;
        this.cube010Mesh = null; // Will store reference to Cube010
        this.creepyDistance = 10000;
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
            5000000  // Increased from 100,000 to 1,000,000
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
                this.assetLoader.loadGLB(`${import.meta.env.BASE_URL}models/juegomapa55.glb`),
                this.assetLoader.loadGLB(`${import.meta.env.BASE_URL}models/newproject.glb`),
                this.assetLoader.loadGLB(`${import.meta.env.BASE_URL}models/chest.glb`)
            ]);
            
            console.log('All models loaded successfully');
            this.setupScene(baseModel.scene, newModel.scene, chestModel.scene);

            // Check for animations in the base model
            if (baseModel.animations && baseModel.animations.length > 0) {
                console.log('Animations found:', baseModel.animations);
                this.setupAnimations(baseModel); // Set up animations
            } else {
                console.warn('No animations found in the base model.');
            }

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

        // After camera setup
        this.camera.add(this.listener);  // Add listener to camera

        // Load and play background music
        this.audioLoader.load(
            `${import.meta.env.BASE_URL}audio/cancionprincipal.mp3`,
            (buffer) => {
                this.backgroundMusic.setBuffer(buffer);
                this.backgroundMusic.setLoop(true);
                this.backgroundMusic.setVolume(0.5);
                this.backgroundMusic.play();
                this.isMusicPlaying = true;
            },
            undefined,
            (error) => {
                console.error('Error loading audio:', error);
            }
        );

        // Load jump sound
        this.audioLoader.load(
            `${import.meta.env.BASE_URL}audio/salto.mp3`,
            (buffer) => {
                this.jumpSound.setBuffer(buffer);
                this.jumpSound.setVolume(0.5);
            },
            undefined,
            (error) => {
                console.error('Error loading jump sound:', error);
            }
        );

        // Load landing sound
        this.audioLoader.load(
            `${import.meta.env.BASE_URL}audio/caida.mp3`,
            (buffer) => {
                this.landSound.setBuffer(buffer);
                this.landSound.setVolume(0.5);
            },
            undefined,
            (error) => {
                console.error('Error loading landing sound:', error);
            }
        );

        // Load walking sound
        this.audioLoader.load(
            `${import.meta.env.BASE_URL}audio/caminata.mp3`,
            (buffer) => {
                this.walkSound.setBuffer(buffer);
                this.walkSound.setLoop(true); // Loop the walking sound
                this.walkSound.setVolume(0.5); // Adjust volume as needed
            },
            undefined,
            (error) => {
                console.error('Error loading walking sound:', error);
            }
        );

         // Load creepy audio
        this.audioLoader.load(
            `${import.meta.env.BASE_URL}audio/pistacreepy.mp3`,
            (buffer) => {
                this.creepyAudio.setBuffer(buffer);
                this.creepyAudio.setLoop(true);
                this.creepyAudio.setVolume(0); // Start at volume 0
            },
            undefined,
            (error) => {
                console.error('Error loading creepy audio:', error);
            }
        );
    }

    setupScene(baseModel, newModel, chestModel) {
        // Replace problematic scene clearing with safer method
        this.scene.clear();  // Use Three.js's built-in clear method instead of manual removal
        
        // Configure base model (mapita.glb)
        this.baseModel = baseModel;
        baseModel.scale.set(300, 300, 300);
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

        // Find Cube010 mesh
        baseModel.traverse(child => {
            if (child.isMesh && child.name === "Cube010") {
                this.cube010Mesh = child;
                console.log('Found Cube010 mesh:', child);
            }
        });

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
            planePosition.y + planeHeight - 55000,
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

        // Add black cube at specified position
        const cubeGeometry = new THREE.BoxGeometry(250, 250, 250);
        const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cubeMesh.position.set(-5303, -5257, 3515); // Add 250 to Y to account for cube center
        this.scene.add(cubeMesh);

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

                // Stop walking sound if it's playing
                if (this.walkSound.isPlaying) {
                    this.walkSound.stop();
                }
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
        if (this.freezeMovement) return;
        if (!this.newModel || !this.planeMesh) return;
    
        const moveSpeed = 800 * this.movementSpeedMultiplier * deltaTime;
    
        // Handle jumping with spacebar
        if (this.keys[' '] && this.isGrounded && !this.isJumping) {
            this.isJumping = true;
            this.jumpStartTime = performance.now();
            this.initialY = this.newModel.position.y;
            this.isGrounded = false;
    
            // Play jump sound
            if (this.jumpSound.isPlaying) {
                this.jumpSound.stop();
            }
            this.jumpSound.play();
        }
    
        // Jump animation handling
        if (this.isJumping) {
            const elapsed = (performance.now() - this.jumpStartTime) / 1000;
            const progress = elapsed / this.jumpDuration;
    
            if (progress < 1) {
                // Parabolic jump curve (up then down)
                const jumpHeight = 1000;
                const yPos = this.initialY + jumpHeight * Math.sin(progress * Math.PI);
                this.newModel.position.y = yPos;
            } else {
                // End of jump cycle
                this.isJumping = false;
                this.isGrounded = true;
            }
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
    
        // Check if the player is moving
        const isMoving = this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d'];
    
        // Play or stop the walking sound based on movement
        if (isMoving && !this.isWalking) {
            this.isWalking = true;
            if (!this.walkSound.isPlaying) {
                this.walkSound.play(); // Start walking sound
                this.walkSound.setVolume(10);
            }
        } else if (!isMoving && this.isWalking) {
            this.isWalking = false;
            if (this.walkSound.isPlaying) {
                this.walkSound.stop(); // Stop walking sound
            }
        }
    
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
                    } else if (intersect.object.name === 'Cone002') {
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
                                bbox.max.y + this.playerHeight / 2,  // Stand on top
                                cone.position.z
                            );
    
                            // Reset vertical velocity
                            this.velocityY = 0;
                            this.isGrounded = true;
                            this.currentCollisionMesh = cone;
                        }
                        // If random number is 2, do nothing (pass through)
                    } else if (intersect.object.name === 'Sphere') {
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
                                bbox.max.y + this.playerHeight / 2,
                                coneMesh.position.z + 15000
                            );
                            this.velocityY = 0;
                            this.isGrounded = true;
                            this.currentCollisionMesh = coneMesh;
                        }
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
    
        // MAIN FIX: Always perform vertical collision check, not just during jumps
        // Improved vertical collision check for Cube004
        const playerPosition = this.newModel.position;
        const playerHalfWidth = this.playerHalfWidth;
        const playerHalfDepth = this.playerHalfDepth;
    
        // Define multiple raycast points around the player's base
        const raycastPoints = [];
        const numRays = 9; // Increase the number of raycasts for better accuracy
        const stepX = (2 * playerHalfWidth) / (numRays - 1);
        const stepZ = (2 * playerHalfDepth) / (numRays - 1);
    
        for (let i = 0; i < numRays; i++) {
            for (let j = 0; j < numRays; j++) {
                const x = playerPosition.x - playerHalfWidth + i * stepX;
                const z = playerPosition.z - playerHalfDepth + j * stepZ;
                raycastPoints.push(new THREE.Vector3(x, playerPosition.y + this.playerHeight, z));
            }
        }
    
        let maxSurfaceY = -Infinity;
        let closestCollisionMesh = null;
    
        // Perform raycasts for each point
        raycastPoints.forEach((point) => {
            const raycaster = new THREE.Raycaster(
                point, // Start slightly above the player
                new THREE.Vector3(0, -1, 0), // Direction (downwards)
                0, // Near
                this.playerHeight * 1.5 // Far (extend further to detect the surface)
            );
    
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            if (intersects.length > 0) {
                const surfaceY = intersects[0].point.y;
                if (surfaceY > maxSurfaceY) {
                    maxSurfaceY = surfaceY;
                    closestCollisionMesh = intersects[0].object;
                }
            }
        });
    
        // Update player position based on the highest surface point
        const tolerance = 1; // Small tolerance for grounded detection
        if (maxSurfaceY !== -Infinity && this.newModel.position.y <= maxSurfaceY + this.playerHeight / 2 + tolerance) {
            this.newModel.position.y = maxSurfaceY + this.playerHeight / 2;
            this.velocityY = 0;
            this.isGrounded = true;
            this.currentCollisionMesh = closestCollisionMesh;
    
            // Play landing sound if just landed
            if (this.isJumping) {
                this.isJumping = false;
                if (this.landSound.isPlaying) {
                    this.landSound.stop();
                }
                this.landSound.play();
            }
        } else if (!this.isJumping) {
            // If not grounded and not jumping, apply gravity
            this.isGrounded = false;
            this.currentCollisionMesh = null;
            this.velocityY += this.gravity * deltaTime;
            this.newModel.position.y += this.velocityY * deltaTime;
        }
    
        // Reset player if falls below -16000 Y position
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

    handleProximityAudio() {
        // Skip if Cube010 mesh wasn't found
        if (!this.cube010Mesh || !this.newModel) return;
        
        // Calculate distance to Cube010
        const distanceToCube = this.newModel.position.distanceTo(this.cube010Mesh.position);
        
        // If within creepy distance
        if (distanceToCube <= this.creepyDistance) {
            // Calculate volume based on proximity (closer = louder)
            const volume = THREE.MathUtils.clamp(
                1 - (distanceToCube / this.creepyDistance), 
                0, 
                1
            );
            
            // Start playing creepy audio if not already playing
            if (!this.isPlayingCreepy) {
                // Pause background music
                if (this.backgroundMusic.isPlaying) {
                    this.backgroundMusic.pause();
                }
                
                // Start creepy audio
                this.creepyAudio.play();
                this.isPlayingCreepy = true;
            }
            
            // Update volume based on distance
            this.creepyAudio.setVolume(volume);
        } 
        // Outside of creepy range but still playing creepy audio
        else if (this.isPlayingCreepy) {
            // Stop creepy audio
            this.creepyAudio.stop();
            this.isPlayingCreepy = false;
            
            // Resume background music if it was playing before
            if (this.isMusicPlaying && !this.backgroundMusic.isPlaying) {
                this.backgroundMusic.play();
            }
        }
    }

    setupAnimations(model) {
        // Create an AnimationMixer for the model
        this.mixer = new THREE.AnimationMixer(model.scene);

        // Play all animations (or specific ones if needed)
        model.animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            action.play();
        });

        console.log('Animations set up and playing.');
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

            // Update animations
            if (this.mixer) {
                this.mixer.update(deltaTime);
            }

            // Add star rotation
            if (this.starMesh) {
                this.starMesh.rotation.y += this.starRotationSpeed * deltaTime;
            }

            this.handleCameraRotation(deltaTime);
            this.handleMovement(deltaTime);
            this.handleProximityAudio();
            this.updateCameraPosition();
            this.renderer.instance.render(this.scene, this.camera);
        }
        
        animateFrame(performance.now());
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) {
            loadingScreen.style.display = "none"; // Hide only if it exists
        } else {
            console.warn("No loading screen found. Skipping hideLoadingScreen().");
        }
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

document.addEventListener("DOMContentLoaded", () => {
    const startButton = document.getElementById("startGameButton");

    startButton.addEventListener("click", () => {
        startButton.style.display = "none"; // Hide button after click

        // Attach listener to the audio
        const audioListener = new THREE.AudioListener();
        const audioLoader = new THREE.AudioLoader();
        const backgroundMusic = new THREE.Audio(audioListener);

        audioLoader.load(
            `${import.meta.env.BASE_URL}audio/cancionprincipal.mp3`,
            (buffer) => {
                backgroundMusic.setBuffer(buffer);
                backgroundMusic.setLoop(true);
                backgroundMusic.setVolume(0.5);
                backgroundMusic.play(); // Now it will play!
            },
            undefined,
            (error) => {
                console.error("Error loading audio:", error);
            }
        );

        // Start the game
        new GameEngine();
    });
});


