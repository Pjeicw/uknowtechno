import { useEffect, useRef } from 'react';

export default function CanvasBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const createCanvas = (id: string, className: string) => {
      const canvas = document.createElement('canvas');
      canvas.id = id;
      canvas.className = className;
      containerRef.current?.appendChild(canvas);
      return canvas;
    };

    const starfieldCanvas = createCanvas('starfieldCanvas', 'starfield-canvas');
    const matrixCanvas = createCanvas('matrixCanvas', 'matrix-rain');
    const particleCanvas = createCanvas('particleCanvas', 'particle-canvas');
    const dataStreamCanvas = createCanvas('dataStreamCanvas', 'data-stream-canvas');
    const neuralCanvas = createCanvas('neuralCanvas', 'neural-network');

    particleCanvas.style.filter = 'none';
    matrixCanvas.style.filter = 'blur(2px)';
    neuralCanvas.style.filter = 'none';

    let animationIds: number[] = [];
    let intervals: ReturnType<typeof setTimeout>[] = [];

    const resizeCanvases = () => {
      [starfieldCanvas, matrixCanvas, particleCanvas, dataStreamCanvas, neuralCanvas].forEach(c => {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
      });
    };
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    // --- Starfield (Space) ---
    // Slower drift, fewer/softer points, and a gentle per-star twinkle so it
    // reads as a distant galaxy instead of a fast field of uniform white
    // dots (previous: 300 fully-opaque dots at 0.05-0.25px/frame).
    const starfieldCtx = starfieldCanvas.getContext('2d')!;
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 1.3 + 0.4,
      speed: (Math.random() * 0.05) + 0.015,
      baseOpacity: Math.random() * 0.4 + 0.3,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.015 + 0.005,
    }));

    // --- Occasional shooting star ("star fall") ---
    type ShootingStar = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number };
    let shootingStars: ShootingStar[] = [];
    const maybeSpawnShootingStar = () => {
      // Rare per frame -> reads as "sometimes", not constant rain.
      if (Math.random() < 0.0025 && shootingStars.length < 2) {
        const angle = (Math.PI / 4) + (Math.random() * 0.4 - 0.2); // ~45deg +/- jitter
        const speed = 9 + Math.random() * 5;
        shootingStars.push({
          x: Math.random() * starfieldCanvas.width * 0.7,
          y: Math.random() * starfieldCanvas.height * 0.3,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 40 + Math.random() * 20,
        });
      }
    };

    const animateStars = () => {
      starfieldCtx.clearRect(0, 0, starfieldCanvas.width, starfieldCanvas.height);
      stars.forEach(star => {
        star.y -= star.speed; // moving upwards, slowly
        if (star.y < 0) {
          star.y = starfieldCanvas.height;
          star.x = Math.random() * starfieldCanvas.width;
        }
        star.twinklePhase += star.twinkleSpeed;
        const twinkle = (Math.sin(star.twinklePhase) + 1) / 2; // 0..1
        const opacity = star.baseOpacity + twinkle * 0.35;
        starfieldCtx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        starfieldCtx.beginPath();
        starfieldCtx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        starfieldCtx.fill();
      });

      maybeSpawnShootingStar();
      shootingStars.forEach(s => {
        const fade = 1 - s.life / s.maxLife;
        const tailX = s.x - s.vx * 6;
        const tailY = s.y - s.vy * 6;
        const grad = starfieldCtx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
        grad.addColorStop(1, 'rgba(100, 255, 218, 0)');
        starfieldCtx.strokeStyle = grad;
        starfieldCtx.lineWidth = 2;
        starfieldCtx.beginPath();
        starfieldCtx.moveTo(s.x, s.y);
        starfieldCtx.lineTo(tailX, tailY);
        starfieldCtx.stroke();
        s.x += s.vx;
        s.y += s.vy;
        s.life += 1;
      });
      shootingStars = shootingStars.filter(s => s.life < s.maxLife);

      animationIds.push(requestAnimationFrame(animateStars));
    };
    animateStars();

    // --- Matrix ---
    const matrixCtx = matrixCanvas.getContext('2d')!;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()_+-=[]{}|;:,.<>?';
    const fontSize = 14;
    let columns = Math.floor(window.innerWidth / fontSize);
    let drops = Array(columns).fill(1);
    const drawMatrix = () => {
      matrixCtx.fillStyle = 'rgba(10, 25, 47, 0.2)';
      matrixCtx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
      matrixCtx.fillStyle = 'rgba(100, 180, 255, 0.5)';
      matrixCtx.font = `${fontSize}px JetBrains Mono`;
      drops.forEach((y, i) => {
        const char = chars.charAt(Math.floor(Math.random() * chars.length));
        matrixCtx.fillText(char, i * fontSize, y * fontSize);
        if (y * fontSize > matrixCanvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    };
    intervals.push(setInterval(drawMatrix, 50));

    // --- 3D Globe Network (Planet + Space) ---
    const globeCtx = particleCanvas.getContext('2d')!;
    const numNodes = 250;
    const globeNodes: {x: number, y: number, z: number}[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < numNodes; i++) {
        const y = 1 - (i / (numNodes - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = phi * i;
        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;
        globeNodes.push({x, y, z});
    }

    let globeRotationX = 0;
    let globeRotationY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (e: MouseEvent) => {
        targetRotationY = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
        targetRotationX = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1
    };
    window.addEventListener('mousemove', handleMouseMove);

    const animateGlobe = () => {
        globeCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        
        // Auto rotate slowly + mouse parallax
        globeRotationY += 0.002 + (targetRotationY * 0.01 - globeRotationY * 0.01);
        globeRotationX += (targetRotationX * 0.2 - globeRotationX) * 0.05;
        
        const cx = particleCanvas.width / 2;
        const cy = particleCanvas.height / 2;
        const globeRadius = Math.min(particleCanvas.width, particleCanvas.height) * 0.45;
        
        const projectedNodes = [];
        
        for (let i = 0; i < numNodes; i++) {
            const node = globeNodes[i];
            
            // Rotate around X axis
            const y1 = node.y * Math.cos(globeRotationX) - node.z * Math.sin(globeRotationX);
            const z1 = node.y * Math.sin(globeRotationX) + node.z * Math.cos(globeRotationX);
            
            // Rotate around Y axis
            const x2 = node.x * Math.cos(globeRotationY) - z1 * Math.sin(globeRotationY);
            const z2 = node.x * Math.sin(globeRotationY) + z1 * Math.cos(globeRotationY);
            const y2 = y1;
            
            const fov = 1000;
            const z = z2 * globeRadius + fov;
            const scale = fov / z;
            
            const px = cx + (x2 * globeRadius) * scale;
            const py = cy + (y2 * globeRadius) * scale;
            
            projectedNodes.push({px, py, scale, z: z2});
            
            // Draw node
            globeCtx.beginPath();
            // Dim nodes on the back of the globe
            const opacity = z2 > 0 ? scale * 0.8 : scale * 0.2;
            globeCtx.fillStyle = `rgba(100, 255, 218, ${opacity})`;
            globeCtx.arc(px, py, scale * 2, 0, Math.PI * 2);
            globeCtx.fill();
        }
        
        // Draw connections
        globeCtx.lineWidth = 0.5;
        for (let i = 0; i < numNodes; i++) {
            for (let j = i + 1; j < numNodes; j++) {
                const dx = globeNodes[i].x - globeNodes[j].x;
                const dy = globeNodes[i].y - globeNodes[j].y;
                const dz = globeNodes[i].z - globeNodes[j].z;
                const dist3d = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (dist3d < 0.25) {
                    const p1 = projectedNodes[i];
                    const p2 = projectedNodes[j];
                    if (p1.z > -0.2 && p2.z > -0.2) {
                        globeCtx.beginPath();
                        globeCtx.strokeStyle = `rgba(100, 255, 218, ${Math.min(p1.scale, p2.scale) * 0.3})`;
                        globeCtx.moveTo(p1.px, p1.py);
                        globeCtx.lineTo(p2.px, p2.py);
                        globeCtx.stroke();
                    }
                }
            }
        }
        
        animationIds.push(requestAnimationFrame(animateGlobe));
    };
    animateGlobe();

    // --- Neural ---
    const neuralCtx = neuralCanvas.getContext('2d')!;
    const nodes = Array.from({ length: 50 }, () => ({
      x: Math.random() * neuralCanvas.width,
      y: Math.random() * neuralCanvas.height,
      size: Math.random() * 3 + 1,
      speedX: Math.random() * 0.5 - 0.25,
      speedY: Math.random() * 0.5 - 0.25
    }));
    const animateNeural = () => {
      neuralCtx.clearRect(0, 0, neuralCanvas.width, neuralCanvas.height);
      nodes.forEach(node => {
        node.x += node.speedX; node.y += node.speedY;
        if (node.x < 0 || node.x > neuralCanvas.width) node.speedX *= -1;
        if (node.y < 0 || node.y > neuralCanvas.height) node.speedY *= -1;
        
        neuralCtx.fillStyle = 'rgba(100, 180, 255, 0.5)';
        neuralCtx.beginPath();
        neuralCtx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        neuralCtx.fill();
        
        nodes.forEach(other => {
          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          if (dist < 100) {
            neuralCtx.beginPath();
            neuralCtx.moveTo(node.x, node.y);
            neuralCtx.lineTo(other.x, other.y);
            neuralCtx.strokeStyle = 'rgba(100, 255, 218, 0.2)';
            neuralCtx.stroke();
          }
        });
      });
      animationIds.push(requestAnimationFrame(animateNeural));
    };
    animateNeural();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvases);
      window.removeEventListener('mousemove', handleMouseMove);
      animationIds.forEach(cancelAnimationFrame);
      intervals.forEach(clearInterval);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[-2]" />;
}
