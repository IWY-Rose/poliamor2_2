import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

let scene, camera, renderer, cdromModel;
const container = document.getElementById('three-container');
let rotationSpeed = 0.005; // Control the model's rotation speed

// --- Camera Animation State ---
let isCameraAnimating = false;
let cameraAnimationProgress = 0;
const CAMERA_DISTANCE = 15;

// --- DVD-style Movement State ---
let cdromVelocity = { x: 0.02, y: 0.015 }; // Movement speed
let boundsCache = null; // Cache for performance

// --- Audio Visualizer State ---
let audioContext, analyser, sourceNode, dataArray;
let canvas, canvasCtx;

// --- Playlist State ---
const songs = [
    'cancionprincipal.mp3',
    'pistacreepy.mp3',
    'pajaro.mp3',
    'caminata.mp3',
    'salto.mp3',
    'caida.mp3',
    'poliamor1.mp3',
    'prueba01.mp3',
    'hellowelcome.mp3',
    'cfnm.mp3',
    'easy.mp3', 
    'paristexas.mp3',
    'version_slow.mp3',
    'La Revuelta.mp3',
    'no soi un ser de luz.mp3'
];
let currentSongIndex = 0;
let currentAudio = null;
let playlistItems = [];
let isPlaying = false;

// --- Lyrics State ---
let currentLyrics = [];
let currentLyricIndex = 0;
let lyricsDisplay = null;

// Update lyrics display based on current playback time
function updateLyricsDisplay() {
    if (!currentAudio || currentLyrics.length === 0) return;
    
    const currentTime = currentAudio.currentTime;
    
    // Find the current lyric line
    let lyricToShow = '';
    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentTime >= currentLyrics[i].time) {
            lyricToShow = currentLyrics[i].text;
            currentLyricIndex = i;
        } else {
            break;
        }
    }
    
    if (lyricsDisplay.textContent !== lyricToShow) {
        lyricsDisplay.textContent = lyricToShow;
    }
}

// LRC Parser Function - Fixed to handle your file format
function parseLRC(lrcContent) {
    const lines = lrcContent.split('\n');
    const lyrics = [];
    
    for (const line of lines) {
        // Match timestamp pattern [mm:ss.xxx] with optional space and handle both 2 and 3 digit decimals
        const match = line.match(/\[(\d{1,2}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            let centiseconds = 0;
            
            // Handle both 2-digit and 3-digit decimal places
            if (match[3]) {
                if (match[3].length === 3) {
                    // Convert milliseconds to centiseconds (890 -> 89)
                    centiseconds = Math.floor(parseInt(match[3]) / 10);
                } else {
                    // Already centiseconds
                    centiseconds = parseInt(match[3]);
                }
            }
            
            const text = match[4] ? match[4].trim() : '';
            
            const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
            if (text) { // Only add non-empty lyrics
                lyrics.push({ time: timeInSeconds, text: text });
                console.log(`Parsed: ${timeInSeconds.toFixed(2)}s - "${text}"`); // Debug log
            }
        }
    }
    
    return lyrics.sort((a, b) => a.time - b.time);
}

// Load lyrics from LRC file
async function loadLyrics(songName) {
    try {
        const lrcFileName = songName.replace('.mp3', '.lrc');
        const response = await fetch(`/lrc/${lrcFileName}`);
        
        if (response.ok) {
            const lrcContent = await response.text();
            const parsedLyrics = parseLRC(lrcContent);
            console.log(`Loaded ${parsedLyrics.length} lyrics lines for ${songName}`);
            return parsedLyrics;
        } else {
            console.log(`No lyrics file found for ${songName}`);
            return [];
        }
    } catch (error) {
        console.error(`Error loading lyrics for ${songName}:`, error);
        return [];
    }
}

// Setup lyrics for current song
async function setupLyrics(songIndex) {
    const songName = songs[songIndex];
    currentLyrics = await loadLyrics(songName);
    currentLyricIndex = 0;
    
    if (currentLyrics.length === 0) {
        lyricsDisplay.textContent = 'No lyrics available';
        lyricsDisplay.className = 'lyrics-display no-lyrics';
    } else {
        lyricsDisplay.className = 'lyrics-display';
        lyricsDisplay.textContent = ''; // Clear display, will be updated by timeupdate
    }
}

async function loadCdromModel() {
    return new Promise((resolve, reject) => {
        // Load textures manually first for better control
        const textureLoader = new THREE.TextureLoader();
        const basePath = '/models/cdrom01/';
        
        Promise.all([
            new Promise(res => textureLoader.load(basePath + 'CdUvMap.png', res)),
            new Promise(res => textureLoader.load(basePath + 'NormalMap (3).png', res)),
            new Promise(res => textureLoader.load(basePath + 'AmbientOcclusionMap.png', res))
        ]).then(([diffuseTexture, normalTexture, aoTexture]) => {
            console.log('All textures loaded successfully');
            
            const mtlLoader = new MTLLoader();
            mtlLoader.setPath(basePath);
            
            mtlLoader.load('cdrom01.mtl', (materials) => {
                materials.preload();
                
                // Enhance the materials with our loaded textures
                const cdMaterial = materials.materials.CdMaterial;
                if (cdMaterial) {
                    // Override with the proper diffuse texture (CdUvMap.png)
                    cdMaterial.map = diffuseTexture;
                    cdMaterial.normalMap = normalTexture;
                    cdMaterial.aoMap = aoTexture;
                    
                    // Enhance material properties for CD appearance
                    cdMaterial.metalness = 0.9;
                    cdMaterial.roughness = 0.1;
                    cdMaterial.transparent = false;
                    
                    // Ensure textures repeat correctly
                    diffuseTexture.wrapS = diffuseTexture.wrapT = THREE.RepeatWrapping;
                    normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping;
                    aoTexture.wrapS = aoTexture.wrapT = THREE.RepeatWrapping;
                    
                    console.log('Enhanced CdMaterial with all textures');
                }
                
                const objLoader = new OBJLoader();
                objLoader.setMaterials(materials);
                objLoader.setPath(basePath);
                
                objLoader.load('cdrom01.obj', (object) => {
                    // Scale and position the model appropriately
                    object.scale.setScalar(4); // Increased to see details better
                    object.position.set(0, 0, 0);
                    
                    // Apply additional material enhancements
                    object.traverse((child) => {
                        if (child instanceof THREE.Mesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            if (child.material) {
                                // Ensure the material is properly set up
                                child.material.needsUpdate = true;
                                
                                // If MTL didn't apply properly, create manual material
                                if (!child.material.map) {
                                    console.log('Applying manual material to mesh');
                                    child.material = new THREE.MeshPhysicalMaterial({
                                        map: diffuseTexture,
                                        normalMap: normalTexture,
                                        aoMap: aoTexture,
                                        metalness: 0.9,
                                        roughness: 0.1,
                                        clearcoat: 0.3,
                                        clearcoatRoughness: 0.1
                                    });
                                }
                            }
                        }
                    });
                    
                    console.log('CDROM model loaded with enhanced materials');
                    resolve(object);
                }, 
                // Progress callback
                (progress) => {
                    console.log('OBJ Loading progress:', (progress.loaded / progress.total * 100) + '%');
                },
                // Error callback
                (error) => {
                    console.error('Error loading OBJ:', error);
                    reject(error);
                });
            },
            // Progress callback for MTL
            (progress) => {
                console.log('MTL Loading progress:', (progress.loaded / progress.total * 100) + '%');
            },
            // Error callback for MTL
            (error) => {
                console.error('Error loading MTL:', error);
                reject(error);
            });
        }).catch((error) => {
            console.error('Error loading textures:', error);
            reject(error);
        });
    });
}

async function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = CAMERA_DISTANCE;

    // Enhanced lighting setup for CD material
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    // Main light for CD reflection
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Secondary light for better illumination
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight2.position.set(-5, -5, 5);
    scene.add(directionalLight2);
    
    // Fill light from below
    const directionalLight3 = new THREE.DirectionalLight(0x4444ff, 0.3);
    directionalLight3.position.set(0, -5, 0);
    scene.add(directionalLight3);

    // Load CDROM Model
    try {
        console.log('Starting CDROM model loading...');
        cdromModel = await loadCdromModel();
        scene.add(cdromModel);
        console.log('CDROM model added to scene successfully!');
    } catch (error) {
        console.error('Error loading CDROM model:', error);
        // Fallback to original red cube if model fails to load
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        cdromModel = new THREE.Mesh(geometry, material);
        scene.add(cdromModel);
        console.log('Fallback to red cube due to loading error');
    }

    // Renderer with enhanced settings
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    if (container) {
        container.appendChild(renderer.domElement);
    }

    // --- Soundwave Canvas Setup ---
    canvas = document.getElementById('soundwave-canvas');
    if (canvas) {
        canvasCtx = canvas.getContext('2d');
    }
    
    // --- Control Button Event Listeners ---
    document.getElementById('speed-up-btn')?.addEventListener('click', () => {
        rotationSpeed = 0.02; // Faster speed
    });
    document.getElementById('slow-down-btn')?.addEventListener('click', () => {
        rotationSpeed = 0.001; // Slower speed
    });
    document.getElementById('stop-btn')?.addEventListener('click', () => {
        rotationSpeed = 0; // Stop rotation
    });
    
    // --- Playlist Logic ---
    setupPlaylist();
    
    // --- Audio Control Logic ---
    setupAudioControls();

    // Initialize lyrics display
    lyricsDisplay = document.getElementById('lyrics-display');
    if (lyricsDisplay) {
        lyricsDisplay.textContent = 'Select a song to see lyrics';
        lyricsDisplay.className = 'lyrics-display no-lyrics';
    }

    // Event Listener for resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Set initial size
    onWindowResize();

    // Start animation
    animate();
}

function setupPlaylist() {
    const playlistElement = document.getElementById('playlist');
    if (!playlistElement) return;

    // Populate playlist
    playlistElement.innerHTML = ''; // Clear existing
    songs.forEach(song => {
        const li = document.createElement('li');
        li.className = 'playlist-item';
        li.textContent = song.replace('.mp3', '');
        playlistElement.appendChild(li);
    });
    playlistItems = playlistElement.querySelectorAll('.playlist-item');

    // Button Listeners
    document.getElementById('playlist-up')?.addEventListener('click', () => {
        currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
        updatePlaylistSelection();
    });

    document.getElementById('playlist-down')?.addEventListener('click', () => {
        currentSongIndex = (currentSongIndex + 1) % songs.length;
        updatePlaylistSelection();
    });

    document.getElementById('playlist-select')?.addEventListener('click', () => {
        playSong(currentSongIndex);
    });

    updatePlaylistSelection(); // Set initial selection
}

function setupAudioControls() {
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    const audioStopBtn = document.getElementById('audio-stop-btn');

    pauseResumeBtn?.addEventListener('click', () => {
        if (currentAudio) {
            if (isPlaying) {
                currentAudio.pause();
                isPlaying = false;
                pauseResumeBtn.textContent = '▶️';
            } else {
                currentAudio.play();
                isPlaying = true;
                pauseResumeBtn.textContent = '⏸️';
            }
        }
    });

    audioStopBtn?.addEventListener('click', () => {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            isPlaying = false;
            const pauseResumeBtn = document.getElementById('pause-resume-btn');
            if (pauseResumeBtn) {
                pauseResumeBtn.textContent = '▶️';
            }
            // Reset lyrics display
            if (currentLyrics.length > 0) {
                lyricsDisplay.textContent = '';
            }
        }
    });
}

function updatePlaylistSelection() {
    playlistItems.forEach((item, index) => {
        if (index === currentSongIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

async function playSong(index) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        // Remove previous event listener
        currentAudio.removeEventListener('timeupdate', updateLyricsDisplay);
    }
    
    const songSrc = `/audio/${songs[index]}`;
    currentAudio = new Audio(songSrc);
    currentAudio.crossOrigin = "anonymous";

    // Setup lyrics for this song (async)
    await setupLyrics(index);

    // Add time update listener for lyrics sync
    currentAudio.addEventListener('timeupdate', updateLyricsDisplay);

    // --- Setup Web Audio API for analysis ---
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.connect(audioContext.destination);
    }
    if (sourceNode) {
        sourceNode.disconnect();
    }
    sourceNode = audioContext.createMediaElementSource(currentAudio);
    sourceNode.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    currentAudio.play();
    isPlaying = true;
    
    // Update pause/resume button
    const pauseResumeBtn = document.getElementById('pause-resume-btn');
    if (pauseResumeBtn) {
        pauseResumeBtn.textContent = '⏸️';
    }

    // Trigger the camera animation
    if (!isCameraAnimating) {
        isCameraAnimating = true;
        cameraAnimationProgress = 0;
    }
}

// Calculate visible bounds for DVD-style movement
function calculateVisibleBounds() {
    if (!camera) return { width: 10, height: 10 };
    
    // Calculate visible area at z=0 based on camera position and FOV
    const distance = CAMERA_DISTANCE;
    const vFOV = camera.fov * Math.PI / 180; // Convert to radians
    const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
    const visibleWidth = visibleHeight * camera.aspect;
    
    return {
        width: visibleWidth,
        height: visibleHeight
    };
}

// Update CD-ROM position with DVD-style bouncing
function updateCdromPosition() {
    if (!cdromModel) return;
    
    // Cache bounds calculation for performance
    if (!boundsCache || Math.random() < 0.01) { // Recalculate occasionally
        boundsCache = calculateVisibleBounds();
    }
    
    const bounds = boundsCache;
    const margin = 4.5; // Margin from edges (adjust this value to change how far inside)
    const halfWidth = (bounds.width / 2) - margin;
    const halfHeight = (bounds.height / 2) - margin;
    
    // Update position
    cdromModel.position.x += cdromVelocity.x;
    cdromModel.position.y += cdromVelocity.y;
    
    // Check for collisions and bounce
    if (cdromModel.position.x >= halfWidth || cdromModel.position.x <= -halfWidth) {
        cdromVelocity.x = -cdromVelocity.x;
        // Clamp position to stay within bounds
        cdromModel.position.x = Math.max(-halfWidth, Math.min(halfWidth, cdromModel.position.x));
    }
    
    if (cdromModel.position.y >= halfHeight || cdromModel.position.y <= -halfHeight) {
        cdromVelocity.y = -cdromVelocity.y;
        // Clamp position to stay within bounds
        cdromModel.position.y = Math.max(-halfHeight, Math.min(halfHeight, cdromModel.position.y));
    }
}

function onWindowResize() {
    if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            
            // Invalidate bounds cache when window resizes
            boundsCache = null;
        }
    }
    
    if (canvas) {
        const oscilloscopeContainer = document.querySelector('.oscilloscope-container');
        if (oscilloscopeContainer) {
            canvas.width = oscilloscopeContainer.clientWidth;
            canvas.height = oscilloscopeContainer.clientHeight;
        }
    }
}

function drawSoundwave() {
    if (!analyser || !canvasCtx || !canvas) return;

    // Clear the canvas
    canvasCtx.fillStyle = '#1a1a1a';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Get time domain data for wave visualization
    analyser.getByteTimeDomainData(dataArray);
    
    // Draw the waveform
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'hotpink';
    canvasCtx.beginPath();
    
    const bufferLength = analyser.frequencyBinCount;
    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        
        if (i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    
    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
}

function animate() {
    requestAnimationFrame(animate);

    // Handle camera animation
    if (isCameraAnimating) {
        cameraAnimationProgress += 0.01; // Animation speed
        const angle = cameraAnimationProgress * Math.PI * 2;

        camera.position.x = Math.sin(angle) * CAMERA_DISTANCE;
        camera.position.z = Math.cos(angle) * CAMERA_DISTANCE;
        camera.lookAt(0, 0, 0); // Keep looking at the center

        if (cameraAnimationProgress >= 1) {
            isCameraAnimating = false;
            camera.position.x = 0; // Reset position
            camera.position.z = CAMERA_DISTANCE;
            camera.lookAt(0, 0, 0);
        }
    }

    if (cdromModel) {
        // Keep the rotation for visual appeal
        cdromModel.rotation.x += rotationSpeed;
        cdromModel.rotation.y += rotationSpeed;
        
        // Add DVD-style bouncing movement
        updateCdromPosition();
    }

    // Draw the soundwave
    drawSoundwave();

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Check if document is ready before starting
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
