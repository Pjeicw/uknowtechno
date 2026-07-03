import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Hero3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;

    const scene = new THREE.Scene();
    
    // Fallback if dimensions are 0 initially
    const width = container.offsetWidth || window.innerWidth;
    const height = container.offsetHeight || window.innerHeight;
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    container.style.position = 'relative'; // Ensure absolute children are positioned relative to this
    container.style.cursor = 'grab';
    container.appendChild(renderer.domElement);

    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0x64FFDA,
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    const glowGeometry = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x64FFDA,
      transparent: true,
      opacity: 0.1
    });
    const glowCube = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowCube);

    // AI Robot Core inside the cube
    const coreGeometry = new THREE.OctahedronGeometry(0.6);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FFCC,
      wireframe: true
    });
    const aiCore = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(aiCore);
    
    const coreSolidMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FFCC,
      transparent: true,
      opacity: 0.8
    });
    const aiCoreSolid = new THREE.Mesh(coreGeometry, coreSolidMaterial);
    aiCoreSolid.scale.set(0.8, 0.8, 0.8);
    scene.add(aiCoreSolid);

    camera.position.z = 5;

    // AI Labels
    const labels = ['LLM', 'MoE', 'Transformers', 'Deep Learning', 'RLHF', 'RAG', 'Neural Networks', 'Self-Attention'];
    const labelElements: HTMLDivElement[] = [];
    labels.forEach(text => {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.position = 'absolute';
      el.style.color = '#64FFDA';
      el.style.fontSize = '12px';
      el.style.fontWeight = 'bold';
      el.style.textShadow = '0 0 5px rgba(100,255,218,0.5)';
      el.style.pointerEvents = 'none';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.whiteSpace = 'nowrap';
      el.style.transition = 'opacity 0.2s ease';
      el.style.zIndex = '10';
      container.appendChild(el);
      labelElements.push(el);
    });

    // Center AI Text
    const centerLabel = document.createElement('div');
    centerLabel.style.position = 'absolute';
    centerLabel.style.pointerEvents = 'none';
    centerLabel.style.transform = 'translate(-50%, -50%)';
    centerLabel.style.zIndex = '20';
    
    const innerText = document.createElement('div');
    innerText.textContent = 'AI';
    innerText.className = 'ai-text-3d';
    centerLabel.appendChild(innerText);

    container.appendChild(centerLabel);

    // 360 Rotation Controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let momentum = { x: 0.003, y: 0.003 };

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if ((e.target as HTMLElement).closest('button, a')) return;
      isDragging = true;
      container.style.cursor = 'grabbing';
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      previousMousePosition = { x: clientX, y: clientY };
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (isDragging) {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaMove = {
          x: clientX - previousMousePosition.x,
          y: clientY - previousMousePosition.y
        };
        momentum.x = deltaMove.y * 0.005; // Dragging horizontally rotates around Y axis
        momentum.y = deltaMove.x * 0.005;
        cube.rotation.x += momentum.x;
        cube.rotation.y += momentum.y;
        previousMousePosition = { x: clientX, y: clientY };
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      container.style.cursor = 'grab';
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (cube && glowCube) {
        if (!isDragging) {
          // Keep spinning slowly based on last momentum, or decay to a constant slow spin
          momentum.x = momentum.x * 0.95 + 0.003 * 0.05;
          momentum.y = momentum.y * 0.95 + 0.003 * 0.05;
          cube.rotation.x += momentum.x;
          cube.rotation.y += momentum.y;
        }
        glowCube.rotation.x = cube.rotation.x;
        glowCube.rotation.y = cube.rotation.y;
        
        aiCore.rotation.x -= momentum.x * 2.5;
        aiCore.rotation.y -= momentum.y * 2.5;
        aiCoreSolid.rotation.x -= momentum.x * 2.5;
        aiCoreSolid.rotation.y -= momentum.y * 2.5;
        
        // Update Labels
        cube.updateMatrixWorld();
        // BoxGeometry has many vertices, but the first 8 unique ones are usually the corners.
        // For a standard BoxGeometry(2,2,2), we can just use fixed corners:
        const corners = [
          new THREE.Vector3(1, 1, 1),
          new THREE.Vector3(1, 1, -1),
          new THREE.Vector3(1, -1, 1),
          new THREE.Vector3(1, -1, -1),
          new THREE.Vector3(-1, 1, 1),
          new THREE.Vector3(-1, 1, -1),
          new THREE.Vector3(-1, -1, 1),
          new THREE.Vector3(-1, -1, -1),
        ];

        corners.forEach((corner, i) => {
            corner.applyMatrix4(cube.matrixWorld);
            const zDistance = corner.z; // Store depth for opacity/scaling
            corner.project(camera);
            
            const el = labelElements[i];
            if (el) {
                const x = (corner.x * 0.5 + 0.5) * container.offsetWidth;
                const y = -(corner.y * 0.5 - 0.5) * container.offsetHeight;
                el.style.left = x + 'px';
                el.style.top = y + 'px';
                
                // Fade out labels that are on the back of the cube
                if (zDistance < 0) {
                   el.style.opacity = '0.1';
                   el.style.transform = 'translate(-50%, -50%) scale(0.8)';
                } else {
                   el.style.opacity = '0.9';
                   el.style.transform = 'translate(-50%, -50%) scale(1)';
                }
            }
        });

        // Update Center AI Text
        const centerPos = new THREE.Vector3(0, 0, 0);
        centerPos.applyMatrix4(cube.matrixWorld);
        centerPos.project(camera);
        centerLabel.style.left = (centerPos.x * 0.5 + 0.5) * container.offsetWidth + 'px';
        centerLabel.style.top = -(centerPos.y * 0.5 - 0.5) * container.offsetHeight + 'px';

      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (container) {
        const newWidth = container.offsetWidth;
        const newHeight = container.offsetHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      }
    };
    
    // Add small delay to handle initial layout shifts
    setTimeout(handleResize, 100);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('resize', handleResize);
      if (container) {
        if (renderer.domElement) container.removeChild(renderer.domElement);
        if (centerLabel.parentNode === container) container.removeChild(centerLabel);
        labelElements.forEach(el => {
           if(el.parentNode === container) container.removeChild(el);
        });
      }
      geometry.dispose();
      material.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      coreSolidMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', userSelect: 'none' }} />
  );
}
