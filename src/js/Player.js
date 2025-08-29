import * as THREE from 'three';

let scene, camera, renderer, cube;
const container = document.getElementById('three-container');
let rotationSpeed = 0.005; // Control the cube's rotation speed

// --- Camera Animation State ---
let isCameraAnimating = false;
let cameraAnimationProgress = 0;
const CAMERA_DISTANCE = 5;

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
    currentAudio.play();

    // Trigger the camera animation
    if (!isCameraAnimating) {
        isCameraAnimating = true;
        cameraAnimationProgress = 0;
    }
}

function onWindowResize() {
    if (!container) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (height === 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
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
