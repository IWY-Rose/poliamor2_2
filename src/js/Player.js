import * as THREE from 'three';

let scene, camera, renderer, cube;
const container = document.getElementById('three-container');
let rotationSpeed = 0.005; // Control the cube's rotation speed

// --- Camera Animation State ---
let isCameraAnimating = false;
let cameraAnimationProgress = 0;
const CAMERA_DISTANCE = 5;

// --- Audio Visualizer State ---
let audioContext, analyser, sourceNode, dataArray;
let canvas, canvasCtx;
let visualizerMode = 'bars'; // 'bars', 'circle', or 'wave'

// --- Playlist State ---
const songs = [
    'cancionprincipal.mp3',
    'pistacreepy.mp3',
    'pajaro.mp3',
    'caminata.mp3',
    'salto.mp3',
    'caida.mp3'
];
let currentSongIndex = 0;
let currentAudio = null;
let playlistItems = [];

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = CAMERA_DISTANCE;

    // Red Cube
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
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

    // --- Visualizer Control Logic ---
    setupVisualizerControls();

    // Event Listener for resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Set initial size
    onWindowResize();

    // Start animation
    animate();
}

function setupVisualizerControls() {
    const visButtons = {
        bars: document.getElementById('vis-bars'),
        circle: document.getElementById('vis-circle'),
        wave: document.getElementById('vis-wave')
    };

    function setActiveButton(mode) {
        visualizerMode = mode;
        Object.values(visButtons).forEach(btn => btn?.classList.remove('active'));
        visButtons[mode]?.classList.add('active');
    }

    visButtons.bars?.addEventListener('click', () => setActiveButton('bars'));
    visButtons.circle?.addEventListener('click', () => setActiveButton('circle'));
    visButtons.wave?.addEventListener('click', () => setActiveButton('wave'));

    // Set initial active button
    setActiveButton('bars');
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

function updatePlaylistSelection() {
    playlistItems.forEach((item, index) => {
        if (index === currentSongIndex) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

function playSong(index) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
    const songSrc = `/audio/${songs[index]}`;
    currentAudio = new Audio(songSrc);
    currentAudio.crossOrigin = "anonymous";

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

    // Trigger the camera animation
    if (!isCameraAnimating) {
        isCameraAnimating = true;
        cameraAnimationProgress = 0;
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
        }
    }
    
    if (canvas) {
        const rightPanel = document.querySelector('.player-side-panel.right');
        if (rightPanel) {
            canvas.width = rightPanel.clientWidth;
            canvas.height = rightPanel.clientHeight;
        }
    }
}

// --- Visualizer Drawing Functions ---

function drawBars() {
    canvasCtx.fillStyle = '#1a1a1a';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    const bufferLength = analyser.frequencyBinCount;
    const barWidth = (canvas.width / bufferLength) * 1.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] * (canvas.height / 256);
        canvasCtx.fillStyle = 'hotpink';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
    }
}

function drawCircle() {
    canvasCtx.fillStyle = '#1a1a1a';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    const bufferLength = analyser.frequencyBinCount;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.5;
    let angle = 0;
    const sliceAngle = (Math.PI * 2) / bufferLength;
    for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] * 0.5;
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barHeight);
        const y2 = centerY + Math.sin(angle) * (radius + barHeight);
        canvasCtx.beginPath();
        canvasCtx.moveTo(x1, y1);
        canvasCtx.lineTo(x2, y2);
        canvasCtx.strokeStyle = `hsl(${i / bufferLength * 360}, 100%, 70%)`;
        canvasCtx.lineWidth = 2;
        canvasCtx.stroke();
        angle += sliceAngle;
    }
}

function drawWave() {
    canvasCtx.fillStyle = '#1a1a1a';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
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

function drawSoundwave() {
    if (!analyser || !canvasCtx || !canvas) return;

    switch(visualizerMode) {
        case 'bars':
            analyser.getByteFrequencyData(dataArray);
            drawBars();
            break;
        case 'circle':
            analyser.getByteFrequencyData(dataArray);
            drawCircle();
            break;
        case 'wave':
            analyser.getByteTimeDomainData(dataArray);
            drawWave();
            break;
    }
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

    if (cube) {
        cube.rotation.x += rotationSpeed;
        cube.rotation.y += rotationSpeed;
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
