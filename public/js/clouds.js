(function () {
    const images = ['/images/nubes0.png', '/images/nubes01.png'];
    let index = 0;

    function spawn() {
        const el = document.createElement('div');
        el.className = 'cloud-layer';
        el.style.backgroundImage = `url('${images[index]}')`;
        index = (index + 1) % images.length;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        spawn();
        setInterval(spawn, 8000);
    }
})();
