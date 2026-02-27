import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ── Three.js core setup ──────────────────────────────────
const renderCanvas = document.getElementById('testCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: renderCanvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(0, 0, 0);

scene.add(new THREE.DirectionalLight(0xffffff, 1).translateZ(5));
scene.add(new THREE.AmbientLight(0x404040));

// ── Offscreen canvas for the visualization texture ───────
const vizWidth = 512;
const vizHeight = 256;
const vizCanvas = document.createElement('canvas');
vizCanvas.width = vizWidth;
vizCanvas.height = vizHeight;
const vizCtx = vizCanvas.getContext('2d');

// This texture wraps the offscreen canvas — Three.js reads its pixels each frame
const vizTexture = new THREE.CanvasTexture(vizCanvas);
vizTexture.wrapS = THREE.RepeatWrapping;
vizTexture.wrapT = THREE.RepeatWrapping;

// ── Web Audio API state ──────────────────────────────────
let analyser = null;
let dataArray = null;

// ── Load the dome model ──────────────────────────────────
let model = null;
let skyMaterial = null;

const loader = new GLTFLoader();
loader.load('/models/dome.glb', (gltf) => {
    model = gltf.scene;
    scene.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    camera.lookAt(0, 0, 0);

    // Walk the scene graph and find the "Sky_Blue" material
    model.traverse((child) => {
        if (!child.isMesh) return;

        const mat = child.material;
        if (mat && mat.name === 'Sky_Blue') {
            skyMaterial = mat;

            // Replace the solid color with our visualization texture.
            // Using emissiveMap so it glows without needing scene lights.
            mat.emissive = new THREE.Color(0xffffff);
            mat.emissiveMap = vizTexture;
            mat.emissiveIntensity = 1.0;

            // Also set the base map if you want it fully texture-driven
            mat.map = vizTexture;

            // Disable tone-mapping influence so colors stay vivid
            mat.toneMapped = false;
            mat.needsUpdate = true;
        }
    });
});

// ── Start button — initializes audio ─────────────────────
document.getElementById('startBtn').addEventListener('click', async () => {
    document.getElementById('startBtn').style.display = 'none';

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Load an audio file from your public/audio/ folder
    const audio = new Audio('/audio/cancionprincipal.mp3');
    audio.crossOrigin = 'anonymous';
    audio.loop = true;
    await audio.play();

    const source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; // gives 128 frequency bins
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    source.connect(analyser);
    analyser.connect(audioCtx.destination);
});

// ── Visualization drawing — called every frame ───────────
function drawVisualization() {
    if (!analyser || !dataArray) {
        // No audio yet — draw a dark idle state
        vizCtx.fillStyle = '#0a001a';
        vizCtx.fillRect(0, 0, vizWidth, vizHeight);
        return;
    }

    analyser.getByteFrequencyData(dataArray);
    const bufferLength = dataArray.length; // 128 bins

    // Fade the previous frame instead of clearing (creates trails)
    vizCtx.fillStyle = 'rgba(0, 0, 10, 0.3)';
    vizCtx.fillRect(0, 0, vizWidth, vizHeight);

    const barWidth = vizWidth / bufferLength;
    const time = performance.now() * 0.001;

    for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i]; // 0–255
        const percent = value / 255;
        const barHeight = percent * vizHeight;

        // Winamp-style color: hue shifts across the bar spectrum + time
        const hue = (i / bufferLength) * 360 + time * 30;
        const lightness = 40 + percent * 30;
        vizCtx.fillStyle = `hsl(${hue % 360}, 100%, ${lightness}%)`;

        const x = i * barWidth;
        const y = vizHeight - barHeight;
        vizCtx.fillRect(x, y, barWidth - 1, barHeight);

        // Mirror: small bars from the top for a symmetric look
        vizCtx.fillStyle = `hsla(${(hue + 180) % 360}, 80%, ${lightness}%, 0.4)`;
        vizCtx.fillRect(x, 0, barWidth - 1, barHeight * 0.3);
    }

    // Waveform overlay (the "oscilloscope" line)
    analyser.getByteTimeDomainData(dataArray);
    vizCtx.beginPath();
    vizCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    vizCtx.lineWidth = 2;
    const sliceWidth = vizWidth / bufferLength;
    let xPos = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const yPos = (v * vizHeight) / 2;
        if (i === 0) vizCtx.moveTo(xPos, yPos);
        else vizCtx.lineTo(xPos, yPos);
        xPos += sliceWidth;
    }
    vizCtx.stroke();
}

// ── Resize handler ───────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Render loop ──────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    drawVisualization();
    vizTexture.needsUpdate = true; // tell Three.js to re-upload the canvas pixels

    renderer.render(scene, camera);
}

animate();