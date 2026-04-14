(() => {
  const root = document.documentElement;
  const glow = document.querySelector('.cursor-glow');
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;

  function onMove(event) {
    const x = (event.clientX / window.innerWidth - 0.5) * 2;
    const y = (event.clientY / window.innerHeight - 0.5) * 2;
    targetX = x;
    targetY = y;
  }

  function animate() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    root.style.setProperty('--pointer-x', currentX.toFixed(4));
    root.style.setProperty('--pointer-y', currentY.toFixed(4));
    if (glow) {
      const x = (currentX * 0.5 + 0.5) * window.innerWidth;
      const y = (currentY * 0.5 + 0.5) * window.innerHeight;
      glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    requestAnimationFrame(animate);
  }

  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', (event) => {
    if (!event.touches || !event.touches.length) return;
    onMove(event.touches[0]);
  }, { passive: true });

  animate();
})();
