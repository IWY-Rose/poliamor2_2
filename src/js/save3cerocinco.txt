import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { AssetLoader } from './core/AssetLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// Core system classes
class InputController {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      space: false,
      shift: false,
      quit: false
    };
    this.cameraRotation = {
      left: false,
      right: false,
      up: false,
      down: false
    };
    this._Initialize();
  }

  _Initialize() {
    document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
    document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
  }

  _onKeyDown(event) {
    switch(event.key.toLowerCase()) {
      case 'w': this.keys.forward = true; break;
      case 'a': this.keys.left = true; break;
      case 's': this.keys.backward = true; break;
      case 'd': this.keys.right = true; break;
      case ' ': this.keys.space = true; break;
      case 'shift': this.keys.shift = true; break;
      case 'q': this.keys.quit = true; break;
      case 'arrowright': this.cameraRotation.left = true; break;
      case 'arrowleft': this.cameraRotation.right = true; break;
      case 'arrowup': this.cameraRotation.up = true; break;
      case 'arrowdown': this.cameraRotation.down = true; break;
    }
  }

  _onKeyUp(event) {
    switch(event.key.toLowerCase()) {
      case 'w': this.keys.forward = false; break;
      case 'a': this.keys.left = false; break;
      case 's': this.keys.backward = false; break;
      case 'd': this.keys.right = false; break;
      case ' ': this.keys.space = false; break;
      case 'shift': this.keys.shift = false; break;
      case 'q': this.keys.quit = false; break;
      case 'arrowright': this.cameraRotation.left = false; break;
      case 'arrowleft': this.cameraRotation.right = false; break;
      case 'arrowup': this.cameraRotation.up = false; break;
      case 'arrowdown': this.cameraRotation.down = false; break;
    }
  }

  resetMovementKeys() {
    console.log("Resetting movement keys in InputController.");
    this.keys.forward = false;
    this.keys.backward = false;
    this.keys.left = false;
    this.keys.right = false;
    // Keep space, shift, quit as they might be needed for other interactions immediately
    // this.keys.space = false;
    // this.keys.shift = false;
    // this.keys.quit = false; // Q is used for chest, don't reset here
  }
}

class ThirdPersonCamera {
  constructor(params) {
    this.params = params;
    this.camera = params.camera;
    this.target = params.target; // The player model

    // Define the desired offset in the target's local space (behind and slightly up)
    this.idealOffsetLocal = new THREE.Vector3(0, 150, -15000); // Adjust z for distance, y for height

    // Define the desired look-at point in the target's local space (in front and slightly up)
    this.idealLookAtLocal = new THREE.Vector3(0, 50, 100); // Adjust z to look further ahead, y for target height

    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    
    // Camera configuration (phi/theta still used for input control)
    this.phi = params.phi || Math.PI / 6; // Start slightly elevated
    this.theta = params.theta || 0;
    this.radius = this.idealOffsetLocal.length(); // Radius is determined by the offset

    // Camera rotation speed
    this.rotationSpeed = params.cameraRotateSpeed || 1.5;
    this.phiSpeed = params.cameraRotateSpeed || 1.5;

    // Camera constraints
    this.phiClamp = {
      min: -Math.PI / 10,
      max: Math.PI / 3
    };

    // Initialize camera position
    this._UpdateCamera();
  }

  _CalculateIdealOffset() {
    const idealOffset = this.idealOffsetLocal.clone();

    // Apply the target's rotation (which should match camera's theta)
    // Note: We derive rotation from theta, assuming target.rotation.y is updated elsewhere
    const rotationY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.theta);
    idealOffset.applyQuaternion(rotationY);

    // Add the rotated offset to the target's world position
    idealOffset.add(this.target.position);
    return idealOffset;
  }

  _CalculateIdealLookat() {
    const idealLookat = this.idealLookAtLocal.clone();

    // Apply the target's rotation
    const rotationY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.theta);
    idealLookat.applyQuaternion(rotationY);

    // Add the rotated offset to the target's world position
    idealLookat.add(this.target.position);
    return idealLookat;
  }


  _UpdateCamera() {
    // This is called initially and potentially if needing a hard reset
    const idealPosition = this._CalculateIdealOffset();
    const idealLookAt = this._CalculateIdealLookat();

    this.currentPosition.copy(idealPosition);
    this.currentLookAt.copy(idealLookAt);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  Update(timeElapsed, input) {
    // Skip if freeze movement is enabled
    if (this.params.freezeMovement) return this.theta;

    // Rotate theta/phi based on arrow keys
    if (input.cameraRotation.left) {
      this.theta += this.rotationSpeed * timeElapsed;
    }
    if (input.cameraRotation.right) {
      this.theta -= this.rotationSpeed * timeElapsed;
    }
    if (input.cameraRotation.up) {
      this.phi = Math.min(
        this.phiClamp.max,
        this.phi + this.phiSpeed * timeElapsed
      );
       // Adjust vertical offset based on phi (optional, if you want vertical angle change)
       // This recalculates the local offset based on phi, keeping radius constant
       this.idealOffsetLocal.x = 0; // Assuming offset is primarily behind/above
       this.idealOffsetLocal.y = this.radius * Math.sin(this.phi);
       this.idealOffsetLocal.z = -this.radius * Math.cos(this.phi); // Negative Z to be behind
    }
    if (input.cameraRotation.down) {
      this.phi = Math.max(
        this.phiClamp.min,
        this.phi - this.phiSpeed * timeElapsed
      );
       // Adjust vertical offset based on phi
       this.idealOffsetLocal.x = 0;
       this.idealOffsetLocal.y = this.radius * Math.sin(this.phi);
       this.idealOffsetLocal.z = -this.radius * Math.cos(this.phi);
    }

    // Calculate ideal camera position and look-at point using target's rotation (theta)
    const idealPosition = this._CalculateIdealOffset();
    const idealLookAt = this._CalculateIdealLookat();

    // Remove Lerping: Update camera position and look-at instantly
    this.camera.position.copy(idealPosition);
    this.camera.lookAt(idealLookAt);

    // Return current theta for player to match rotation
    return this.theta;
  }
}

class CharacterController {
  constructor(params) {
    this.params = params;
    this.model = params.model;
    this.scene = params.scene;
    this.collisionMeshes = params.collisionMeshes || []; // Store the collision meshes
    this.audioLoader = params.audioLoader;
    this.listener = params.listener;
    this.isMuted = params.isMuted;
    this.coordinateOffset = params.coordinateOffset;
    
    // Physics settings
    this.gravity = params.gravity || -50000;
    this.velocityY = 0;
    this.isGrounded = false;
    this.hoverHeight = params.hoverHeight || 10;
    
    // Movement settings
    this.movementSpeed = 800;
    this.movementSpeedMultiplier = params.movementSpeedMultiplier || 10;
    this.runMultiplier = 2.0;
    
    // Jumping
    this.isJumping = false;
    this.jumpStartTime = 0;
    this.jumpDuration = 1.0; // seconds
    this.initialJumpY = 0;
    
    // Player dimensions
    this.playerHeight = params.playerHeight || 0;
    this.playerHalfWidth = params.playerHalfWidth || 5;
    this.playerHalfDepth = params.playerHalfDepth || 5;
    
    // Ground detection
    this.raycaster = new THREE.Raycaster();
    this.currentCollisionMesh = null;
    
    // Audio
    this.setupAudio();
    
    // Walking state
    this.isWalking = false;
  }
  
  setupAudio() {
    if (!this.audioLoader || !this.listener) return;
    
    // Initialize audio components
    this.walkSound = this.params.walkSound || new THREE.Audio(this.listener);
    this.jumpSound = this.params.jumpSound || new THREE.Audio(this.listener);
    
    // Configure existing sounds if already loaded
    if (this.walkSound && !this.walkSound.buffer && this.audioLoader) {
      this.audioLoader.load(
        '/audio/caminata.mp3', // Updated path
        (buffer) => {
          this.walkSound.setBuffer(buffer);
          this.walkSound.setLoop(true);
          this.walkSound.setVolume(this.isMuted ? 0 : 10);
        }
      );
    }
    
    if (this.jumpSound && !this.jumpSound.buffer && this.audioLoader) {
      this.audioLoader.load(
        '/audio/salto.mp3', // Updated path
        (buffer) => {
          this.jumpSound.setBuffer(buffer);
          this.jumpSound.setVolume(this.isMuted ? 0 : 0.5);
        }
      );
    }
  }
  
  _HandleJump(timeElapsed, input) {
    if (input.keys.space && this.isGrounded && !this.isJumping) {
      // Start jump
      this.isJumping = true;
      this.jumpStartTime = performance.now();
      this.initialJumpY = this.model.position.y;
      this.isGrounded = false;
      
      // Play jump sound
      if (!this.isMuted && this.jumpSound) {
        if (this.jumpSound.isPlaying) {
          this.jumpSound.stop();
        }
        this.jumpSound.play();
      }
    }
    
    // Handle jump animation
    if (this.isJumping) {
      const elapsed = (performance.now() - this.jumpStartTime) / 1000;
      const progress = elapsed / this.jumpDuration;
      
      if (progress < 1) {
        // Parabolic jump path
        const jumpHeight = 3000;
        const yPos = this.initialJumpY + jumpHeight * Math.sin(progress * Math.PI);
        this.model.position.y = yPos;
      } else {
        // End jump
        this.isJumping = false;
      }
    }
  }
  
  _CheckGrounded() {
    if (!this.model || !this.collisionMeshes || this.collisionMeshes.length === 0) {
        // console.log("CheckGrounded skipped: No model or collision meshes.");
        this.isGrounded = false; // Can't be grounded if no meshes to check against
        this.currentCollisionMesh = null;
        return false;
    }
    
    // Cast rays down from the player position
    const playerPos = this.model.position.clone();
    const halfWidth = this.playerHalfWidth * 0.8; // Reduce width slightly for less edge catching
    const halfDepth = this.playerHalfDepth * 0.8; // Reduce depth slightly

    // Ray points setup remains the same
    const rayOriginYOffset = this.playerHeight * 0.1; // Start rays lower inside the model
    const rayLength = this.playerHeight * 0.5 + this.hoverHeight + 100; // Ray length based on height + hover + buffer
    this.raycaster.far = rayLength;

    const rayPoints = [
      new THREE.Vector3(playerPos.x, playerPos.y + rayOriginYOffset, playerPos.z), // Center
      new THREE.Vector3(playerPos.x + halfWidth, playerPos.y + rayOriginYOffset, playerPos.z + halfDepth), // Front-right
      new THREE.Vector3(playerPos.x - halfWidth, playerPos.y + rayOriginYOffset, playerPos.z + halfDepth), // Front-left
      new THREE.Vector3(playerPos.x + halfWidth, playerPos.y + rayOriginYOffset, playerPos.z - halfDepth), // Back-right
      new THREE.Vector3(playerPos.x - halfWidth, playerPos.y + rayOriginYOffset, playerPos.z - halfDepth)  // Back-left
    ];

    
    let highestY = -Infinity;
    let hitObject = null;
    
    // Use the provided collisionMeshes list
    const objectsToCheck = this.collisionMeshes.filter(obj => obj !== this.model); // Ensure player model isn't checked


    for (const point of rayPoints) {
      this.raycaster.set(point, new THREE.Vector3(0, -1, 0));
      const hits = this.raycaster.intersectObjects(objectsToCheck, true); // Recursive check
      
      if (hits.length > 0) {
         // Find the highest hit point among all hits from this ray
         for (const hit of hits) {
             // Check if this hit is higher than the current highest *and* below the ray origin
             if (hit.point.y < point.y && hit.point.y > highestY) {
          highestY = hit.point.y;
                 hitObject = hit.object; // Store the object associated with the highest point
             }
        }
      }
    }
    
    // Apply grounding logic (remains mostly the same)
    if (highestY !== -Infinity) {
      const targetY = highestY + this.hoverHeight; 
        const groundSnapThreshold = this.hoverHeight * 1.5; // Snap threshold relative to hover height
      
      if (!this.isJumping && Math.abs(this.model.position.y - targetY) < groundSnapThreshold) {
            // Close enough or slightly below, snap and ground
             if (!this.isGrounded && this.velocityY < 0) { // Only reset velocity when first landing
                 // console.log(`Grounded. Snapping to ${targetY.toFixed(2)}`);
         this.model.position.y = targetY;
         this.velocityY = 0; 
             } else if (this.model.position.y < targetY) {
                 // If slightly below, gently push up (or snap)
                 this.model.position.y = targetY; // Snap up
             }
         this.isGrounded = true;

        } else if (!this.isJumping && this.model.position.y > targetY && this.velocityY <= 0) {
            // Falling towards hover zone but still too high
            this.isGrounded = false;
      } else if (!this.isJumping && this.model.position.y < targetY) {
            // Below targetY and not within snap threshold (e.g. falling fast past it)
             this.isGrounded = false; // Treat as falling until within snap range
      } else {
            // Jumping or too far above
         this.isGrounded = false; 
      }


      this.currentCollisionMesh = hitObject;
      return this.isGrounded; // Return the determined grounded state

    } else {
      // No ground hit by any ray
      // console.log("No ground hit by raycasts.");
      this.isGrounded = false;
      this.currentCollisionMesh = null;
      return false;
    }
  }
  
  _ApplyGravity(timeElapsed) {
    if (!this.isGrounded && !this.isJumping) {
      this.velocityY += this.gravity * timeElapsed;
      
      // Limit fall speed
      this.velocityY = Math.max(this.velocityY, -20000);
      
      // Apply gravity to Y position
      this.model.position.y += this.velocityY * timeElapsed;
      
      // Reset if falls too far
      if (this.model.position.y <= -16000 && this.coordinateOffset) {
        this.model.position.copy(this.coordinateOffset);
        this.velocityY = 0;
        this.isGrounded = true;
      }
    }
  }

  _HandleMovement(timeElapsed, input, cameraTheta) {
    if (!this.model) return;

    // --- Player Rotation: Always update rotation based on camera ---
    this.model.rotation.y = cameraTheta;
    // --- End Player Rotation ---

    // Calculate movement direction vectors based on camera orientation (now matches player)
    const forward = new THREE.Vector3(
      Math.sin(cameraTheta), 0, Math.cos(cameraTheta));
    const right = new THREE.Vector3(
      Math.sin(cameraTheta + Math.PI/2), 0, Math.cos(cameraTheta + Math.PI/2));

    // Speed calculation
    const speedMultiplier = input.keys.shift ? this.runMultiplier : 1.0;
    const moveSpeed = this.movementSpeed * this.movementSpeedMultiplier * timeElapsed * speedMultiplier;

    // Apply movement based on input
    let isMoving = false;

    if (input.keys.forward) {
      this.model.position.x += forward.x * moveSpeed;
      this.model.position.z += forward.z * moveSpeed;
      isMoving = true;
    }

    if (input.keys.backward) {
      this.model.position.x -= forward.x * moveSpeed;
      this.model.position.z -= forward.z * moveSpeed;
      isMoving = true;
    }

    if (input.keys.left) {
      this.model.position.x += right.x * moveSpeed;
      this.model.position.z += right.z * moveSpeed;
      isMoving = true;
    }

    if (input.keys.right) {
      this.model.position.x -= right.x * moveSpeed;
      this.model.position.z -= right.z * moveSpeed;
      isMoving = true;
    }

    // Handle walking sound (still depends on actual movement)
    this._UpdateWalkingSound(isMoving);

    return isMoving;
  }
  
  _UpdateWalkingSound(isMoving) {
    if (!this.walkSound || this.isMuted) return;
    
    if (isMoving && this.isGrounded && !this.isWalking) {
      this.isWalking = true;
      if (!this.walkSound.isPlaying) {
        this.walkSound.play();
        this.walkSound.setVolume(10);
      }
    } else if ((!isMoving || !this.isGrounded) && this.isWalking) {
      this.isWalking = false;
      if (this.walkSound.isPlaying) {
        this.walkSound.stop();
      }
    }
  }
  
  Update(timeElapsed, input, cameraTheta) {
    // --- New: Check freeze status ---
    // Note: We access freezeMovement directly from params which should be updated by the Game class
    if (this.params.freezeMovement) {
        // If frozen, potentially stop sounds immediately
        this._UpdateWalkingSound(false); // Ensure walking sound stops
        return { // Return default state without performing updates
             isMoving: false,
             isGrounded: this.isGrounded, // Keep last known grounded state
             position: this.model.position,
             currentCollisionMesh: this.currentCollisionMesh
         };
    }
    // --- End New ---

    // --- Note: Player rotation is now handled directly in _HandleMovement ---
    // this.model.rotation.y = cameraTheta; // This line can be removed if handled in _HandleMovement

    this._CheckGrounded();
    this._HandleJump(timeElapsed, input);
    const isMoving = this._HandleMovement(timeElapsed, input, cameraTheta); // This now also handles rotation

    // Apply gravity if not jumping
    if (!this.isJumping) {
      this._ApplyGravity(timeElapsed);
    }

    return {
      isMoving: isMoving,
      isGrounded: this.isGrounded,
      position: this.model.position,
      currentCollisionMesh: this.currentCollisionMesh
    };
  }
}

class Game {
  constructor(muted = false) {
    this.isMuted = muted;
    this.initialized = false;
    this.freezeMovement = false;
    this.untexturedMeshes = [];
    this.untexturedWarningShown = false;
    this.frozenByUntexturedWarning = false;
    this.tempBox = new THREE.Box3();
    this.playerBox = new THREE.Box3();
    this.collisionMeshes = [];
    this.currentLevelPath = null;

    // --- Death State Variables ---
    this.isDyingPhase1 = false;
    this.isMovingCameraToCenital = false;
    this.isWaitingForDeathReload = false;
    this.deathAnimationTimer = 0;
    this.deathAnimationDuration = 1.5;
    this.cenitalCameraAnimationTimer = 0;
    this.cenitalCameraAnimationDuration = 1.5;
    this.deathDelayTimer = 0;
    this.deathDelayDuration = 3.0;
    this.initialDeathPlayerPosition = new THREE.Vector3();
    this.initialDeathXRotation = 0;
    this.targetDeathXRotation = 0;
    this.targetDeathYPosition = 0;
    this.initialCameraPosition = new THREE.Vector3();
    this.targetCameraPositionPhase1 = new THREE.Vector3();
    this.finalPlayerPosition = new THREE.Vector3();
    this.initialCameraCenitalPosition = new THREE.Vector3();
    this.targetCameraCenitalPosition = new THREE.Vector3();
    this.initialCameraCenitalQuaternion = new THREE.Quaternion();
    this.targetCameraCenitalQuaternion = new THREE.Quaternion();
    // --- End Death State Variables ---

    // --- Teleport State Variables ---
    this.isPreTeleportLock = false;
    this.preTeleportLockTimer = 0;
    this.preTeleportLockDuration = 1.0;
    this.isTeleportingFreeze = false; // Add this flag to track the freeze state
    this.teleportFreezeTimer = 0;     // Add timer for the freeze phase
    this.teleportFreezeDuration = 2.0; // Define the freeze duration (e.g., 2 seconds)
    this.nextLevelPath = null;
    this.columpioMesh = null;
    // --- End Teleport State Variables ---

    // --- Orbiting Light Variables ---
    this.orbitingLight = null;            // Reference to the orbiting light
    this.orbitCenter = new THREE.Vector3(0, 10000, 0); // Center of the orbit (can adjust Y)
    this.orbitRadius = 500000;           // Radius of the orbit - Increased from 25000
    this.orbitSpeed = 1.0;              // Speed of orbit (radians per second) 
    // --- End Orbiting Light Variables ---

    // --- Chest Physics Variables ---
    this.chestVelocityY = 0;
    this.isChestGrounded = false;
    this.chestRaycaster = new THREE.Raycaster();
    this.chestGravity = -50000;
    this.chestHoverHeight = 5;
    this.starYOffset = 1000;
    // --- End Chest Physics Variables ---

    // Setup basic properties
    this.time = 0;
    this.clock = new THREE.Clock();

    // Create the renderer
    this.renderer = new Renderer();

    // Set up the scene
    this.scene = new THREE.Scene();

    // Set up the camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      5000000
    );

    // Model center for camera tracking
    this.modelCenter = new THREE.Vector3(0, -5, 0);

    // Audio setup
    this.audioLoader = new THREE.AudioLoader();
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    // Camera settings
    this.theta = 0;
    this.phi = 0;
    this.radius = 350;
    this.cameraRotateSpeed = 1.5;

    // UI elements
    this.coordDisplay = this._createCoordinateDisplay();
    this.chestMessage = this._createChestMessage();

    // Load models and initialize the game
    this._initializeGame();

    // Handle window resizing
    window.addEventListener('resize', () => this._onWindowResize(), false);
  }
  
  // New function to handle the overall initialization sequence
  async _initializeGame() {
    try {
      this._setupInput(); // Input needs to be ready early
      this.assetLoader = new AssetLoader(); // Loader needed for levels

      // Load initial player and chest models (assuming they are persistent across levels)
      const [playerModel, chestModel] = await Promise.all([
        this.assetLoader.loadGLB('/models/newproject.glb'), // Updated path
        this.assetLoader.loadGLB('/models/chest.glb') // Updated path
      ]);
      this._setupPlayer(playerModel.scene);
      this._setupChest(chestModel.scene); // Initial setup for chest model

      // Load the initial level
      await this._loadLevel('/models/juegomapa334433.glb'); // Updated path

      // Initialize components that depend on player/level being loaded
      this._initializeCharacterController();
      this._initializeCamera();
      this._setupAudio(); // Audio might depend on listener attached to camera
      this._setupGUI();

      this.initialized = true;
      this._startGameLoop();
      
      // Hide loading screen if it exists
      const loadingScreen = document.getElementById("loading-screen");
      if (loadingScreen) loadingScreen.style.display = "none";
      
    } catch (error) {
      console.error('Error initializing game:', error);
       // Show error to user?
    }
  }

  // Modified: Handles loading and setting up a specific level
  async _loadLevel(levelPath) {
    console.log(`Loading level: ${levelPath}`);
    this.currentLevelPath = levelPath; // Store current level path
    this.freezeMovement = true; // Freeze during load

    // Show loading screen (implement this if you have one)
    // const loadingScreen = document.getElementById("loading-screen");
    // if (loadingScreen) loadingScreen.style.display = "block";

    try {
      // 1. Remove old level model if it exists
      if (this.baseModel) {
        this.scene.remove(this.baseModel);
        // Dispose geometry/material if needed to free memory? (Advanced)
      }

      // 2. Load the new level model
      const levelGLTF = await this.assetLoader.loadGLB(levelPath);
      this.baseModel = levelGLTF.scene; // Assign the scene group as the base model

      // 3. Setup the scene with the new level model
      this._setupLevelScene(this.baseModel);

      // 4. Reset player position (adjust coordinates as needed for the new level)
      this._resetPlayerPosition(this.baseModel); // Pass the new base model for context

      // 5. Update components that depend on the level
      if (this.character) {
        this.character.coordinateOffset.copy(this.playerModel.position); // Update respawn point
        this.character.collisionMeshes = this.collisionMeshes; // Update collision meshes
      }
      // Note: Camera target is already playerModel, should update automatically
      // Chest physics needs the new collision meshes
      // Mixer needs to be potentially updated if the new level has animations (optional)
      if (levelGLTF.animations && levelGLTF.animations.length > 0) {
          this._setupAnimations(levelGLTF); // Re-setup animations for the new level
      } else if (this.mixer) {
          this.mixer.stopAllAction(); // Stop old animations if new level has none
          this.mixer = null; // Clear the mixer
      }


      console.log(`Level ${levelPath} loaded successfully.`);

    } catch (error) {
      console.error(`Error loading level ${levelPath}:`, error);
      // Handle error: maybe load a default level or show an error message
      // Re-throw or handle gracefully
      throw error; // Re-throw to be caught by the caller if needed
    } finally {
       // Hide loading screen
       // if (loadingScreen) loadingScreen.style.display = "none";
       // Unfreeze movement only if NOT in another freeze state (like teleport freeze ending)
       if (!this.isTeleportingFreeze && !this.isDyingPhase1 /* etc. */) {
           this.freezeMovement = false;
       }
       console.log("Movement frozen status after level load attempt:", this.freezeMovement);
    }
  }

  // Sets up the player model initially
  _setupPlayer(playerModel) {
    this.playerModel = playerModel;
    playerModel.scale.set(3000, 3000, 3000);
    // Initial position will be set by _resetPlayerPosition
    this.scene.add(playerModel); // Add player to the scene once

    // Store player dimensions (only needs to be done once)
    playerModel.updateMatrixWorld(true);
    const playerBBox = new THREE.Box3().setFromObject(playerModel);
    this.playerHeight = playerBBox.max.y - playerBBox.min.y;
    this.playerHalfWidth = (playerBBox.max.x - playerBBox.min.x) / 2;
    this.playerHalfDepth = (playerBBox.max.z - playerBBox.min.z) / 2;
    
    this.coordinateOffset = new THREE.Vector3(); // Will be set in _resetPlayerPosition
  }
    
  // Sets up the chest model initially
  _setupChest(chestModel) {
    this.chestModel = chestModel;
    chestModel.scale.set(500, 500, 500);
      // Initial position will be set relative to the level in _resetPlayerPosition or _setupLevelScene
      this.scene.add(chestModel); // Add chest to the scene once

      // Create star (position will be updated)
      this._createStar(new THREE.Vector3()); // Create with temp position
  }

  // New: Resets player position based on the loaded level
  _resetPlayerPosition(levelModel) {
      // Find a suitable spawn point in the new level
      let spawnPosition = new THREE.Vector3(0, 5000, 0); // More reasonable default backup Y
      const planeMesh = levelModel.getObjectByName('piso'); // Still useful for ground height

      console.log(`Resetting player position for level: ${this.currentLevelPath}`);

      if (planeMesh) {
          const planePosition = new THREE.Vector3();
          planeMesh.getWorldPosition(planePosition); // Gets the mesh's origin world position
          const planeBBox = new THREE.Box3().setFromObject(planeMesh);
          const planeHeight = planeBBox.max.y; // Base height from 'piso'

          // --- Conditional Spawn Logic ---
          if (this.currentLevelPath.endsWith('juegomapa334433.glb')) {
              console.log("Setting spawn for juegomapa334433.glb to piso center.");
              // Calculate the center of the piso bounding box
              const pisoCenter = new THREE.Vector3();
              planeBBox.getCenter(pisoCenter);

              spawnPosition.set(
                  pisoCenter.x,       // Use the calculated X center
                  planeHeight + 100,  // Place slightly above the plane surface
                  pisoCenter.z        // Use the calculated Z center
              );
          } else if (this.currentLevelPath.endsWith('nivel1.glb')) {
              console.log("Setting spawn for nivel1.glb");
              // !!! IMPORTANT: Replace these with actual desired coordinates for nivel1.glb !!!
              // You might base them on planePosition or use entirely fixed coordinates.
              // Example using fixed coordinates relative to world origin (0,0,0) if 'piso' isn't helpful for positioning:
              // spawnPosition.set(1000, planeHeight + 100, 2000);
              // Example using different offsets from 'piso':
              spawnPosition.set(
                  planePosition.x + 5000, // Use DIFFERENT offsets for level 1
                  planeHeight + 100,
                  planePosition.z - 10000
              );
          } else {
              // Fallback for any other level path, maybe use the center of the piso?
              console.warn(`Unknown level path for spawn: ${this.currentLevelPath}. Using default offset.`);
               spawnPosition.set(
                  planePosition.x,
                  planeHeight + 100,
                  planePosition.z
              );
          }
          // --- End Conditional Spawn Logic ---

          console.log("Player spawn point calculated:", spawnPosition);

      } else {
          console.warn("'piso' mesh not found in the new level. Using default world origin spawn point.");
           spawnPosition.set(0, 5000, 0); // Use the backup defined earlier
      }


    if (this.playerModel) {
          this.playerModel.position.copy(spawnPosition);
          this.playerModel.rotation.set(0, 0, 0); // Reset rotation
        this.playerModel.updateMatrixWorld(true);
          this.coordinateOffset.copy(spawnPosition); // Update respawn offset
          console.log("Player position reset to:", this.playerModel.position);
      }

      // Reset character controller state
      if (this.character) {
        this.character.velocityY = 0;
        this.character.isGrounded = false; // Re-check on next frame
        this.character.isJumping = false;
      }

      // Reset camera
      if (this.cameraController) {
         this.cameraController.theta = 0; // Reset camera angle to look forward relative to player
         this.cameraController._UpdateCamera(); // Force snap to new player position/orientation
      }

      // Reposition chest (using similar conditional logic if needed)
      if (this.chestModel && planeMesh) {
           const planePosition = new THREE.Vector3();
           planeMesh.getWorldPosition(planePosition);
           const planeBBox = new THREE.Box3().setFromObject(planeMesh);
           const planeHeight = planeBBox.max.y;

           // Example: Chest position might be fixed relative to world or spawn
           let chestPos = new THREE.Vector3();
            if (this.currentLevelPath.endsWith('juegomapa334433.glb')) {
                // Position chest relative to the new player spawn (center of piso)
                 const chestOffset = new THREE.Vector3(10000, 0, 5000); // Example offset from center
                 chestPos.copy(spawnPosition).add(chestOffset);
                 chestPos.y = planeHeight + 100; // Ensure it's above ground

            } else if (this.currentLevelPath.endsWith('nivel1.glb')) {
                 // !!! Define chest position for nivel1.glb !!!
                 chestPos.set(
                    spawnPosition.x + 10000, // Example: Near the player spawn for nivel1
                    planeHeight + 100,
                    spawnPosition.z
                 );
            } else {
                 // Default chest position if 'piso' exists but level unknown
                 chestPos.copy(spawnPosition).add(new THREE.Vector3(5000, 0, 0));
            }

           this.chestModel.position.copy(chestPos);
           this.chestModel.rotation.y = -Math.PI/6; // Or maybe reset rotation too?
           this.chestVelocityY = 0;
           this.isChestGrounded = false;
           console.log("Chest position reset relative to level:", this.chestModel.position);

      } else if (this.chestModel) {
          console.warn("'piso' not found, cannot accurately reposition chest. Placing near player.");
          // Place it near player based on calculated spawnPosition
          this.chestModel.position.copy(spawnPosition).add(new THREE.Vector3(5000, 0, 0));
           this.chestVelocityY = 0;
           this.isChestGrounded = false;
      }

      // Update star/light position
      this._updateStarAndLightPosition();
  }


  // Renamed from _setupScene, takes the specific level model
  _setupLevelScene(levelModel) {
    // Clear previous level-specific data
    this.untexturedMeshes = [];
    this.collisionMeshes = [];
    this.planeMesh = null;
    this.cube010Mesh = null;
    this.columpioMesh = null; // Reset reference

    // Configure the loaded level model
    levelModel.scale.set(300, 300, 300);
    levelModel.position.set(0, -5, 0); // Adjust as needed
    levelModel.rotation.set(0, Math.PI / 4, 0); // Adjust as needed
    this.scene.add(levelModel); // Add the new level to the scene

    console.log("--- Traversing New Level Scene Meshes ---");
    levelModel.traverse(child => {
      if (child.isMesh) {
        // --- Add mesh to collision list (basic example: add all meshes) ---
        // More specific filtering might be needed (e.g., based on name or userData)
         this.collisionMeshes.push(child);
        // --- End Add mesh ---

        // console.group(`Mesh: ${child.name || 'Unnamed Mesh'} ...`); // Keep logging brief for now
        // console.log(`  Position: (...)`); // Abridged logging
        // const material = child.material; // ... check material ...

        // --- Find specific named meshes ---
        if (child.name === "piso") this.planeMesh = child;
        if (child.name === "Cube010") this.cube010Mesh = child;
        if (child.name === "columpio") {
             this.columpioMesh = child;
             console.log("Found 'columpio' mesh:", child);
        }
        // --- End Find specific named meshes ---

        // Enable shadows
        child.castShadow = true;
        child.receiveShadow = true;

        // Check for "notexturebro" material map name
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        let hasNoTextureBroMap = false;
        for (const mat of materials) {
            if (mat && mat.map && mat.map.name === "notexturebro") {
                hasNoTextureBroMap = true;
                break;
            }
        }
        if (hasNoTextureBroMap) {
             // console.log(`  ^^^ Flagged: Contains map named "notexturebro".`);
             this.untexturedMeshes.push(child);
        }
        // console.groupEnd();
      }
    });
    console.log(`--- Finished Traversing Level. Found ${this.collisionMeshes.length} potential collision meshes. ---`);
    if (!this.planeMesh) console.warn("'piso' mesh not found in this level!");
    if (!this.columpioMesh) console.warn("'columpio' mesh not found in this level!");


    // Add black cube (assuming this is persistent or re-added?)
    // If it's part of the level GLB, this isn't needed. If separate, add it.
    // const cubeGeometry = new THREE.BoxGeometry(250, 250, 250);
    // const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    // const cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
    // cubeMesh.position.set(-5303, -5257, 3515); // Adjust position if needed
    // this.scene.add(cubeMesh);

    // Setup lighting (might need adjustment per level?)
    this._setupLighting(); // Reuse existing lighting for now

    // Update camera focus if needed (player position is reset elsewhere)
    // this.modelCenter.copy(this.playerModel.position);

    // Ensure matrices are updated for the new level
    levelModel.updateMatrixWorld(true);
  }

  // Re-added _createStar method definition
  _createStar(position) {
    // Create star shape
    const starShape = new THREE.Shape();
    const points = 5;
    const innerRadius = 20;
    const outerRadius = 40;
    
    starShape.moveTo(outerRadius, 0);
    for (let i = 0; i < 2 * points; i++) {
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
    this.starMesh.scale.set(4, 4, 4);
    // Set initial position - will be updated by _updateStarAndLightPosition or _resetPlayerPosition
    this.starMesh.position.copy(position);
    // Initial offset might be set here but gets overwritten later based on chest position
    // this.starMesh.position.y += this.starYOffset;
    // this.starMesh.position.z -= 400;
    this.starMesh.rotation.y = -Math.PI/4;
    
    // Add star to scene
    this.scene.add(this.starMesh);
    
    // Create star light
    this.starLight = new THREE.PointLight(0xffc45d, 10.0, 10000, 2);
    this.starLight.position.copy(this.starMesh.position); // Initial position
    this.starLight.castShadow = true;
    this.scene.add(this.starLight);
    
    this.starRotationSpeed = 1.5;
  }
  
  // Re-added _setupLighting method definition
  _setupLighting() {
    // Remove or comment out the AmbientLight
    // const ambientLight = new THREE.AmbientLight(0xff00ff, 0.5);
    // if (!this.scene.getObjectByName("ambientLight")) {
    //   ambientLight.name = "ambientLight";
    //   this.scene.add(ambientLight);
    // }

    // Add a new PointLight instead, using the ambient light's color
    // Check if the light already exists (e.g., from a previous level load)
    if (!this.orbitingLight) {
        // Increased intensity from 0.8 to 1.5
        this.orbitingLight = new THREE.PointLight(0xff00ff, 1.8, 5000000); // Color 0xff00ff, intensity 1.5, range 50000
        // this.orbitingLight.position.set(0, 10000, 0); // Remove static position setting
        this.orbitingLight.name = "replacementPointLight"; 
        // Optional: Configure shadows if needed (be mindful of performance)
        // this.orbitingLight.castShadow = true; 
        
        // Ensure we don't add it multiple times
        if (!this.scene.getObjectByName("replacementPointLight")) {
            this.scene.add(this.orbitingLight);
        }
    }

    // --- Disable the Directional Light ---
     
    // Keep the Directional Light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.01);
    directionalLight.position.set(50, 100, -50); // Adjust position as needed
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 2048; // Higher resolution for better shadows
    directionalLight.shadow.mapSize.height = 2048;
    // Adjust shadow camera frustum based on scene size
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500000; // Increase if needed
    directionalLight.shadow.camera.left = -100000; // Adjust bounds
    directionalLight.shadow.camera.right = 100000;
    directionalLight.shadow.camera.top = 100000;
    directionalLight.shadow.camera.bottom = -100000;

    // Add lights to scene only if they aren't already there
    // (This prevents adding lights multiple times on level change)
    // Ambient light check removed
     if (!this.scene.getObjectByName("directionalLight")) {
       directionalLight.name = "directionalLight";
       this.scene.add(directionalLight);
       // Optional: Add a shadow camera helper for debugging
       // const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
       // this.scene.add(shadowHelper);
     }
    
    // --- End Disable the Directional Light ---


    // Enable shadows in renderer (usually done once)
    // Note: Shadows will now only be cast by starLight (since orbitingLight.castShadow is false)
    this.renderer.instance.shadowMap.enabled = true;
    this.renderer.instance.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
  }


  // Removed _loadModels - its logic is now split between _initializeGame and _loadLevel

  // Removed _setupScene - its logic is now in _setupLevelScene

  // Helper to update star/light pos based on chest
  _updateStarAndLightPosition() {
      if (this.starMesh && this.chestModel) {
            this.starMesh.position.set(
                this.chestModel.position.x,
                this.chestModel.position.y + this.starYOffset,
                this.chestModel.position.z - 400 // Maintain original relative offset
            );
        }
        if (this.starLight && this.starMesh) {
            this.starLight.position.copy(this.starMesh.position);
        }
  }

  
  _setupInput() {
    this.input = new InputController();
  }
  
  _initializeCharacterController() {
    const desiredHoverHeight = 1050

    this.characterParams = {
        model: this.playerModel,
        scene: this.scene, // Scene ref might be less useful now
        collisionMeshes: this.collisionMeshes, // Pass initial collision meshes
        gravity: this.gravity || -50000,
        audioLoader: this.audioLoader,
        listener: this.listener,
        isMuted: this.isMuted,
        walkSound: this.walkSound,
        jumpSound: this.jumpSound,
        playerHeight: this.playerHeight,
        playerHalfWidth: this.playerHalfWidth,
        playerHalfDepth: this.playerHalfDepth,
        coordinateOffset: this.coordinateOffset, // Updated in resetPlayerPosition
        movementSpeedMultiplier: this.movementSpeedMultiplier || 15,
        hoverHeight: desiredHoverHeight,
        freezeMovement: this.freezeMovement // Pass initial value
    };

    this.character = new CharacterController(this.characterParams);
  }
  
  _initializeCamera() {
     // Pass the Game's freezeMovement flag itself within the params object.
     // ThirdPersonCamera will access it via this.params.freezeMovement
     this.cameraParams = { // Store params separately
        camera: this.camera,
        target: this.playerModel,
        radius: this.radius,
        theta: this.theta,
        phi: this.phi,
        cameraRotateSpeed: this.cameraRotateSpeed,
        freezeMovement: this.freezeMovement // Pass initial value
     };
    this.cameraController = new ThirdPersonCamera(this.cameraParams);
  }
  
  _setupAudio() {
    // Background music
    this.backgroundMusic = new THREE.Audio(this.listener);
    this.audioLoader.load(
      '/audio/cancionprincipal.mp3', // Updated path
      (buffer) => {
        this.backgroundMusic.setBuffer(buffer);
        this.backgroundMusic.setLoop(true);
        this.backgroundMusic.setVolume(this.isMuted ? 0 : 0.5);
        if (!this.isMuted) {
          this.backgroundMusic.play();
          this.isMusicPlaying = true;
        }
      }
    );
    
    // Creepy audio
    this.creepyAudio = new THREE.Audio(this.listener);
    this.audioLoader.load(
      '/audio/pistacreepy.mp3', // Updated path
      (buffer) => {
        this.creepyAudio.setBuffer(buffer);
        this.creepyAudio.setLoop(true);
        this.creepyAudio.setVolume(0);
      }
    );
    
    this.creepyDistance = 10000;
    this.isPlayingCreepy = false;
  }
  
  _setupAnimations(model) {
    this.mixer = new THREE.AnimationMixer(model.scene);
    
    model.animations.forEach((clip) => {
      const action = this.mixer.clipAction(clip);
      action.play();
    });
  }
  
  _setupGUI() {
    const gui = new GUI();
    gui.add(this.character, 'movementSpeedMultiplier', 0.5, 100.0).name('Speed Multiplier');
  }
  
  _startGameLoop() {
    const frame = () => {
      requestAnimationFrame(frame);
      
      if (!this.initialized) return;
      
      // --- Update shared freezeMovement status ---
      // Prioritize freeze states: Death > PreTeleport > Teleport > Untextured Warning > Manual Freeze
      let frameFreeze = false;
      if (this.isDyingPhase1 || this.isMovingCameraToCenital || this.isWaitingForDeathReload) {
          frameFreeze = true;
      } else if (this.isPreTeleportLock) { // Check new pre-teleport lock state
          frameFreeze = true;
      } else if (this.isTeleportingFreeze) {
          frameFreeze = true;
      } else if (this.frozenByUntexturedWarning) {
          frameFreeze = true; // Warning explicitly freezes
      } else {
          frameFreeze = this.freezeMovement; // Use general freeze if no specific state active
      }

      // Update controller params based on calculated freeze state
      this.characterParams.freezeMovement = frameFreeze;
      this.cameraParams.freezeMovement = frameFreeze;
      // --- End Update Freeze Status ---


      const deltaTime = this.clock.getDelta();
      this.time += deltaTime;

      // --- Update Player Bounding Box ---
      if (this.playerModel && !this.isDyingPhase1 && !this.isMovingCameraToCenital && !this.isWaitingForDeathReload) {
         this.playerBox.setFromObject(this.playerModel, true);
      }
      // --- End Player Bounding Box Update ---

      // --- Handle State Updates (Death, Teleport Phases) ---
      // NOTE: Order matters here. Check most critical/overriding states first.
      if (this.isDyingPhase1) {
        this._updateDeathAnimationPhase1(deltaTime);
        if (this.chestModel) this._updateChestPhysics(deltaTime); // Keep chest physics going
        this.renderer.instance.render(this.scene, this.camera); // Render death anim
        return;
      } else if (this.isMovingCameraToCenital) {
        this._updateCenitalCameraAnimation(deltaTime);
        if (this.chestModel) this._updateChestPhysics(deltaTime);
        this.renderer.instance.render(this.scene, this.camera); // Render cam move
        return;
      } else if (this.isWaitingForDeathReload) {
        this._updateDeathDelay(deltaTime);
        if (this.chestModel) this._updateChestPhysics(deltaTime);
        this.renderer.instance.render(this.scene, this.camera); // Render final frame
        return;
      } else if (this.isPreTeleportLock) { // Check for the new 1-second lock phase
          this._updatePreTeleportLock(deltaTime); // Update lock timer, potentially transition state
          // Player movement is frozen via frameFreeze, but game logic continues
          // We still need to update chest, animations, etc. and render normally during this phase.
          if (this.chestModel) this._updateChestPhysics(deltaTime);
          if (this.mixer) this.mixer.update(deltaTime);
          if (this.starMesh) this.starMesh.rotation.y += this.starRotationSpeed * deltaTime;
          // Camera updates are skipped because frameFreeze is true
          // Character updates are skipped because frameFreeze is true (and we're already in a teleport state)
          this._updateCoordinateDisplay(this.character.Update(0, this.input, this.cameraController.theta)); // Pass 0 delta to get status without update
          this.renderer.instance.render(this.scene, this.camera); // Render normally during lock phase
          return; // Exit here for this frame
      } else if (this.isTeleportingFreeze) { // Check for the 2-second freeze phase
        this._updateTeleportFreeze(deltaTime); // Handles 2s timer and triggers level load
        // During this phase, rendering is frozen (implicitly by returning),
        // but we might still want physics to run if needed (e.g., chest falling).
        if (this.chestModel) this._updateChestPhysics(deltaTime);
        this.renderer.instance.render(this.scene, this.camera); // Render the frozen frame
        return; // Exit to maintain frozen image
      }
      // --- End State Updates ---


      // --- Regular Updates (only run if not frozen/in special state) ---
      // These only run if none of the above if/else if conditions were met.

      // --- Update Orbiting Light ---
      if (this.orbitingLight) {
        const angle = this.time * this.orbitSpeed;
        // Orbit in the YZ plane (keeping X constant)
        this.orbitingLight.position.set(
            this.orbitCenter.x, // Keep X the same as the orbit center's X
            this.orbitCenter.y + this.orbitRadius * Math.sin(angle), // Oscillate Y
            this.orbitCenter.z + this.orbitRadius * Math.cos(angle)  // Oscillate Z
        );
      }
      // --- End Update Orbiting Light ---


      // Update Chest Physics
      if (this.chestModel) {
          this._updateChestPhysics(deltaTime);
      }

      // Update Level Animations
      if (this.mixer) this.mixer.update(deltaTime);

      // Rotate star
      if (this.starMesh) {
        this.starMesh.rotation.y += this.starRotationSpeed * deltaTime;
      }

      // Update Camera
      const cameraTheta = this.cameraController.Update(deltaTime, this.input);

      // Update Character
      const characterStatus = this.character.Update(deltaTime, this.input, cameraTheta);

      // Update model center for camera tracking
      if (!frameFreeze) {
          this.modelCenter.copy(this.playerModel.position);
      }

      // Handle proximity events (collision checks for death, teleport, chest)
      this._handleProximityEvents(); // This might set isDyingPhase1 or isPreTeleportLock

      // Update coordinate display
      this._updateCoordinateDisplay(characterStatus);

      // Final Render
      this.renderer.instance.render(this.scene, this.camera);
    };
    
    frame();
  }

  // --- New Method: Update Pre-Teleport Lock Timer ---
  _updatePreTeleportLock(deltaTime) {
      this.preTeleportLockTimer += deltaTime;
      console.log(`Pre-Teleport lock timer: ${this.preTeleportLockTimer.toFixed(2)} / ${this.preTeleportLockDuration}`);

      // Ensure player movement remains frozen (already handled by frameFreeze in game loop)
      // this.characterParams.freezeMovement = true;
      // this.cameraParams.freezeMovement = true;

      if (this.preTeleportLockTimer >= this.preTeleportLockDuration) {
          console.log("Pre-Teleport lock finished. Starting Teleport Freeze phase.");
          this.isPreTeleportLock = false;     // End this phase
          this.preTeleportLockTimer = 0;    // Reset timer

          this.isTeleportingFreeze = true;    // Start the next phase
          this.teleportFreezeTimer = 0;     // Reset timer for the freeze phase

          // No need to change nextLevelPath here, it was set on collision
      }
      // Rendering happens in the main loop branch that calls this function
  }

  // --- Modified Method: Update Teleport Freeze Timer ---
  _updateTeleportFreeze(deltaTime) {
      this.teleportFreezeTimer += deltaTime;
      // console.log(`Teleport freeze timer: ${this.teleportFreezeTimer.toFixed(2)} / ${this.teleportFreezeDuration}`); // Can be verbose

      // Ensure player stays frozen (handled by frameFreeze in game loop)
      // this.characterParams.freezeMovement = true;
      // this.cameraParams.freezeMovement = true;

      if (this.teleportFreezeTimer >= this.teleportFreezeDuration) {
          console.log("Teleport freeze finished. Loading next level.");
          this.isTeleportingFreeze = false; // Exit freeze state *before* async load starts
          this.teleportFreezeTimer = 0;     // Reset timer

          // Call the level loading function
          if (this.nextLevelPath) {
              const path = this.nextLevelPath;
              this.nextLevelPath = null; // Clear path immediately

              this._loadLevel(path).then(() => {
                  console.log("New level loaded successfully after teleport.");
                  // Unfreeze movement only after successful load
                  this.freezeMovement = false; // Allow general movement again
                  // Controller params will be updated by the game loop next frame

              }).catch(error => {
                  console.error("Failed to load next level after teleport:", error);
                  // Handle error, maybe show message
                  this.freezeMovement = false; // Unfreeze even on error
              });
          } else {
               console.warn("Teleport freeze ended, but no nextLevelPath was set.");
               this.freezeMovement = false; // Unfreeze movement anyway
          }
      }
      // Rendering happens in the main loop branch that calls this function
  }
  
  // Renamed from _updateDeathAnimation
  _updateDeathAnimationPhase1(deltaTime) {
    this.deathAnimationTimer += deltaTime;
    const progress = Math.min(this.deathAnimationTimer / this.deathAnimationDuration, 1.0);

    // Interpolate Player Rotation (X-axis)
    this.playerModel.rotation.x = THREE.MathUtils.lerp(
        this.initialDeathXRotation,
        this.targetDeathXRotation,
        progress
    );

    // Interpolate Player Position (Y-axis)
    const currentY = THREE.MathUtils.lerp(
        this.initialDeathPlayerPosition.y,
        this.targetDeathYPosition,
        progress
    );
    this.playerModel.position.y = currentY;

    // Interpolate Camera Position (Initial Zoom)
    this.camera.position.lerpVectors(
        this.initialCameraPosition,
        this.targetCameraPositionPhase1, // Use Phase 1 target
        progress
    );

    // Ensure camera keeps looking at the player
    this.camera.lookAt(this.playerModel.position);

    // Check for completion of Phase 1
    if (progress >= 1.0) {
        console.log("Death Phase 1 complete. Starting Phase 2 (Move to Cenital).");
        this.isDyingPhase1 = false; // End phase 1
        this.isMovingCameraToCenital = true; // Start phase 2

        // Store final state of phase 1 / initial state for phase 2
        this.finalPlayerPosition.copy(this.playerModel.position);
        this.initialCameraCenitalPosition.copy(this.camera.position);
        this.initialCameraCenitalQuaternion.copy(this.camera.quaternion);

        // Calculate target state for phase 2
        // Target position: Directly above the player's final spot
        const overheadDistance = 5000; // Adjust as needed
        this.targetCameraCenitalPosition.set(
            this.finalPlayerPosition.x,
            this.finalPlayerPosition.y + overheadDistance,
            this.finalPlayerPosition.z
        );

        // Calculate target quaternion (looking down)
        // Use a temporary camera to calculate the quaternion without moving the actual camera yet
        const tempCam = new THREE.PerspectiveCamera(); // Or use this.camera if careful
        tempCam.position.copy(this.targetCameraCenitalPosition); // Position it overhead
        tempCam.lookAt(this.finalPlayerPosition); // Make it look down
        tempCam.updateWorldMatrix(true, false); // Update its matrix
        this.targetCameraCenitalQuaternion.copy(tempCam.quaternion); // Get the resulting quaternion

        // Reset timer for phase 2
        this.cenitalCameraAnimationTimer = 0;
    }
  }

  // New method for Phase 2: Camera moves overhead and rotates down
  _updateCenitalCameraAnimation(deltaTime) {
    this.cenitalCameraAnimationTimer += deltaTime;
    const progress = Math.min(this.cenitalCameraAnimationTimer / this.cenitalCameraAnimationDuration, 1.0);

    // Interpolate Camera Position to overhead
    this.camera.position.lerpVectors(
        this.initialCameraCenitalPosition,
        this.targetCameraCenitalPosition,
        progress
    );

    // Interpolate Camera Rotation (Quaternion Slerp) to look down
    this.camera.quaternion.slerpQuaternions(
        this.initialCameraCenitalQuaternion,
        this.targetCameraCenitalQuaternion,
        progress
    );

    // Optional: Keep looking at the player's final spot just in case lerp/slerp drifts slightly
    // this.camera.lookAt(this.finalPlayerPosition);

    // Check for completion of Phase 2
    if (progress >= 1.0) {
        console.log("Death Phase 2 complete. Starting Phase 3 (Delay).");
        this.isMovingCameraToCenital = false; // End phase 2
        this.isWaitingForDeathReload = true; // Start phase 3
        this.deathDelayTimer = 0; // Reset timer for phase 3
    }
  }

  // New method for Phase 3: Delay before game over
  _updateDeathDelay(deltaTime) {
    this.deathDelayTimer += deltaTime;

    // Ensure camera stays put and looks down during delay
    this.camera.position.copy(this.targetCameraCenitalPosition);
    this.camera.quaternion.copy(this.targetCameraCenitalQuaternion);
    // this.camera.lookAt(this.finalPlayerPosition); // Redundant if quat is correct

    if (this.deathDelayTimer >= this.deathDelayDuration) {
        console.log("Death Phase 3 complete. Game Over.");
        this.isWaitingForDeathReload = false; // End phase 3
        alert("You died :(");
        window.location.reload();
    }
  }

  _handleProximityEvents() {
    // Exit early if any death, pre-teleport, or teleport freeze is active
    if (this.isDyingPhase1 || this.isMovingCameraToCenital || this.isWaitingForDeathReload || this.isPreTeleportLock || this.isTeleportingFreeze) return;

    // --- Teleport Collision Check ---
    if (this.columpioMesh && this.playerModel && !this.freezeMovement) { // Check general freeze flag too
        this.columpioMesh.updateMatrixWorld(true);
        this.tempBox.setFromObject(this.columpioMesh, true);

        if (this.playerBox.intersectsBox(this.tempBox)) {
            console.log("Player collided with columpio! Initiating Pre-Teleport Lock.");
            this.isPreTeleportLock = true; // <--- Start the PRE-LOCK phase
            this.freezeMovement = true;    // Set general freeze flag immediately
            // Ensure controllers know immediately (via game loop update)
            this.input.resetMovementKeys(); // Prevent held keys
            this.preTeleportLockTimer = 0; // Reset PRE-LOCK timer
            this.nextLevelPath = '/models/nivel1.glb'; // Updated path // Set the target level

            // DO NOT set isTeleportingFreeze = true here yet
            // DO NOT reset teleportFreezeTimer here yet

            return; // Exit proximity checks for this frame
        }
    }
    // --- End Teleport Collision Check ---


    let isNearUntexturedForWarning = false;
    const warningProximityThreshold = 100000;

    // Handle Untextured Mesh Collision (Death Trigger) and Proximity (Warning)
    if (this.playerModel && this.untexturedMeshes.length > 0 && !this.freezeMovement) {
        for (const mesh of this.untexturedMeshes) {
            if (mesh && mesh.geometry) {
                 mesh.updateMatrixWorld(true);
                 this.tempBox.setFromObject(mesh, true);

                 // --- 1. Check for Collision (Death) ---
                 if (this.playerBox.intersectsBox(this.tempBox)) {
                     console.log("Player collided with untextured mesh! Triggering death phase 1.");
                     this.isDyingPhase1 = true;
                     this.freezeMovement = true; // General freeze
                     this.frozenByUntexturedWarning = false; // Not the warning freeze
                     this.characterParams.freezeMovement = true;
                     this.cameraParams.freezeMovement = true;
                     this.input.resetMovementKeys();
                     this.initialDeathPlayerPosition.copy(this.playerModel.position);
                     this.initialDeathXRotation = this.playerModel.rotation.x;
                     this.targetDeathXRotation = this.initialDeathXRotation + Math.PI / 2;
                     this.targetDeathYPosition = this.initialDeathPlayerPosition.y - 1000;
                     this.deathAnimationTimer = 0;

                     return; // Exit proximity checks
                 }

                 // --- 2. Check for Proximity (Warning) ---
                 const distance = this.tempBox.distanceToPoint(this.playerModel.position);
                 if (distance < warningProximityThreshold) {
                    isNearUntexturedForWarning = true;
                    if (!this.untexturedWarningShown) {
                        console.log("Near untextured, freezing movement for warning.");
                        this.freezeMovement = true; // Set general freeze
                        this.frozenByUntexturedWarning = true; // Mark as warning freeze
                        this.characterParams.freezeMovement = true;
                        this.cameraParams.freezeMovement = true;

                        alert("WARNING! Getting closer..."); // Blocking alert

                        console.log("Alert dismissed, unfreezing movement and resetting input.");
                        this.freezeMovement = false; // Unset general freeze
                        this.frozenByUntexturedWarning = false; // Unset warning marker
                        this.untexturedWarningShown = true; // Mark warning as shown
                        this.input.resetMovementKeys(); // Reset keys after freeze ends
                    }
                 }
            }
        }
    }

    // Reset the *warning* 'shown' flag logic
    if (!isNearUntexturedForWarning && this.untexturedWarningShown && !this.frozenByUntexturedWarning && !this.isDyingPhase1 && !this.isPreTeleportLock && !this.isTeleportingFreeze) {
             console.log("Away from all untextured meshes (for warning), resetting shown flag.");
             this.untexturedWarningShown = false;
    }


    // Handle chest proximity (only if not frozen by other interactions)
    if (this.chestModel && this.playerModel && !this.freezeMovement) {
      const distanceToChest = this.playerModel.position.distanceTo(this.chestModel.position);

      if (distanceToChest < 1000) {
        console.log("Near chest, freezing movement.");
        this.freezeMovement = true; // Set general freeze
        this.frozenByUntexturedWarning = false; // Not a warning freeze
        this.characterParams.freezeMovement = true;
        this.cameraParams.freezeMovement = true;
        this.chestMessage.style.display = 'block';
        this.coordDisplay.style.display = 'none';
      }
      }

    // Handle chest interaction via Q key (only if frozen specifically for the chest)
    // Ensure it doesn't interfere with teleport/death states
    if (this.freezeMovement && !this.frozenByUntexturedWarning && !this.isPreTeleportLock && !this.isTeleportingFreeze && !this.isDyingPhase1 /* etc. */ && this.input.keys.quit && this.chestMessage.style.display === 'block') {
        console.log("Leaving chest, unfreezing movement.");
        this.freezeMovement = false; // Unset general freeze
        this.untexturedWarningShown = false; // Reset warning flag too
        // No need to reset input here, Q is intentional

        this.chestMessage.style.display = 'none';

        // Move player back slightly
        const cameraForward = new THREE.Vector3();
        this.camera.getWorldDirection(cameraForward);
        const backwardVector = cameraForward.multiplyScalar(-100);
        this.playerModel.position.add(backwardVector);

        this.coordDisplay.style.display = 'block';
    }


    // Handle creepy audio proximity
    if (this.cube010Mesh && this.playerModel) {
      const distanceToCube = this.playerModel.position.distanceTo(this.cube010Mesh.position);
      // ... (audio logic remains the same) ...
    }
  }
  
  _updateCoordinateDisplay(characterStatus) {
    if (!this.coordDisplay || !this.playerModel) return;
    
    const pos = this.playerModel.position.clone().sub(this.coordinateOffset);
    const meshName = characterStatus.currentCollisionMesh ?
      (characterStatus.currentCollisionMesh.name || 'Unnamed Mesh') : 'None';

    this.coordDisplay.textContent =
      `X: ${pos.x.toFixed(1)} \u2022 ` +
      `Y: ${pos.y.toFixed(1)} \u2022 ` +
      `Z: ${pos.z.toFixed(1)} \n` +
      `VelY: ${this.character.velocityY?.toFixed(1) || '0.0'} \u2022 ` +
      `Grounded: ${characterStatus.isGrounded ? 'YES' : 'NO'} \n` +
      `Colliding with: ${meshName}`;
  }

  _onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.instance.setSize(window.innerWidth, window.innerHeight);
  }

  _createCoordinateDisplay() {
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

  _createChestMessage() {
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

  _updateChestPhysics(deltaTime) {
      // Use the Game's collisionMeshes list
      if (!this.chestModel || !this.collisionMeshes || this.collisionMeshes.length === 0) {
          // console.log("Skipping chest physics: No model or collision meshes.");
          return;
      }

      this.chestModel.updateMatrixWorld(true); // Ensure matrix is current

      // 1. Check Grounded State
      const groundY = this._getGroundHeightBelowChest(this.chestModel.position);

      if (groundY !== -Infinity) {
          const targetY = groundY + this.chestHoverHeight;
          const groundSnapThreshold = 5.0; // Increased threshold slightly

          if (Math.abs(this.chestModel.position.y - targetY) < groundSnapThreshold ||
             (this.chestModel.position.y > targetY && this.chestVelocityY <= 0))
          {
              if (!this.isChestGrounded) { // Snap only once when becoming grounded
                 // console.log(`Chest grounded. Snapping from ${this.chestModel.position.y.toFixed(2)} to ${targetY.toFixed(2)}`);
              this.chestModel.position.y = targetY;
              }
              this.chestVelocityY = 0;
              this.isChestGrounded = true;
          } else {
              this.isChestGrounded = false;
          }
      } else {
          // No ground detected below
          // console.log("Chest: No ground detected below.");
          this.isChestGrounded = false;
      }

      // 2. Apply Gravity if not Grounded
      if (!this.isChestGrounded) {
          this.chestVelocityY += this.chestGravity * deltaTime;
          this.chestVelocityY = Math.max(this.chestVelocityY, -20000); // Limit fall speed
          const deltaY = this.chestVelocityY * deltaTime;
          this.chestModel.position.y += deltaY;
          // console.log(`Chest falling: velY=${this.chestVelocityY.toFixed(2)}, deltaY=${deltaY.toFixed(2)}, newY=${this.chestModel.position.y.toFixed(2)}`);

          // Optional: Boundary check
          if (this.chestModel.position.y < -30000) {
             console.warn("Chest fell too far, resetting position near player.");
             this.chestModel.position.copy(this.playerModel.position).add(new THREE.Vector3(2000, 500, 0));
             this.chestVelocityY = 0;
          }
      }

      // 3. Update Star and Light Position AFTER chest position is updated
      this._updateStarAndLightPosition();
  }

  _getGroundHeightBelowChest(position) {
      const rayOrigin = position.clone();
      rayOrigin.y += 10; // Start ray slightly above
      this.chestRaycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
      this.chestRaycaster.far = position.y + 31000; // Limit ray distance based on current Y + fall limit

      // Ensure collisionMeshes is populated
      if (!this.collisionMeshes || this.collisionMeshes.length === 0) return -Infinity;

      // Exclude chest itself if it somehow ended up in collisionMeshes
      const meshesToCheck = this.collisionMeshes.filter(m => m !== this.chestModel);

      const intersects = this.chestRaycaster.intersectObjects(meshesToCheck, true); // Recursive check

      if (intersects.length > 0) {
          // Find the highest intersection point below the ray origin
          let highestY = -Infinity;
          for(const hit of intersects) {
              // Ensure the hit point is below the origin's Y to avoid hitting things above
              if (hit.point.y < rayOrigin.y && hit.point.y > highestY) {
                  highestY = hit.point.y;
              }
          }
          return highestY; // Return the highest valid point found
      } else {
          return -Infinity; // No ground found
      }
  }
}

// Start the game when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded event fired."); // Log 1: Check if listener runs

  const startButton = document.getElementById("startGameButton");
  const mutedButton = document.getElementById("startMutedButton");
  const buttonsContainer = document.getElementById("game-buttons");

  console.log("startButton found:", startButton); // Log 2: Check if button exists
  console.log("mutedButton found:", mutedButton); // Log 3: Check if button exists
  console.log("buttonsContainer found:", buttonsContainer); // Log 4: Check if container exists

  if (startButton && mutedButton && buttonsContainer) { // Also check container here
    console.log("Buttons and container found, attaching listeners."); // Log 5: Confirm elements are ready

    // Helper function to start the game
    function startGame(muted = false) {
      console.log(`startGame called with muted = ${muted}`); // Log 7: Check if startGame runs
      if (buttonsContainer) {
        console.log("Hiding buttons container."); // Log 8: Check if container is hidden
        buttonsContainer.style.display = "none";
      }
      console.log("Creating new Game instance..."); // Log 9: Check before Game creation
      new Game(muted);
      console.log("New Game instance created."); // Log 10: Check after Game creation (might not show if constructor hangs)
    }

    // Set up button event listeners
    startButton.addEventListener("click", () => {
        console.log("Start Game button clicked!"); // Log 6a: Check if click fires
        startGame(false);
    });
    mutedButton.addEventListener("click", () => {
        console.log("Start Muted button clicked!"); // Log 6b: Check if click fires
        startGame(true);
    });
    console.log("Event listeners attached."); // Log 11: Confirm listeners attached

  } else {
    // If no buttons found, log a warning
    console.warn("One or more start elements (buttons or container) not found!");
    // Optionally, you might still want to try starting the game if the buttons are missing for some reason
    // console.log("Attempting to start game directly...");
    // new Game(false); 
  }
});