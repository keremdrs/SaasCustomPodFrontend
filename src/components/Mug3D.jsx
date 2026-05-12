import { useState, useEffect } from 'react';
import * as THREE from 'three';

const PRODUCT_CONFIGS = {
  '11oz': { printWidth: 2475, printHeight: 1155, radius: 1.5,  height: 3.0 },
  '12oz': { printWidth: 2600, printHeight: 1200, radius: 1.55, height: 3.2 },
  '15oz': { printWidth: 2700, printHeight: 1275, radius: 1.6,  height: 3.5 },
};

export default function Mug3D({ imageUrl, backgroundUrl, offsetX, offsetY, scale, productId = '11oz' }) {
  const config = PRODUCT_CONFIGS[productId] || PRODUCT_CONFIGS['11oz'];
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (!imageUrl) return;

    const canvas = document.createElement('canvas');
    canvas.width  = 2048;
    canvas.height = Math.round(canvas.width / (config.printWidth / config.printHeight));
    const ctx = canvas.getContext('2d');

    const drawFg = () => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageUrl;
      img.onload = () => {
        const aspect = img.width / img.height;
        const tH = scale * canvas.height;
        const tW = tH * aspect;
        ctx.drawImage(
          img,
          offsetX * canvas.width  - tW / 2,
          offsetY * canvas.height - tH / 2,
          tW, tH
        );
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        setTexture(tex);
      };
    };

    if (backgroundUrl) {
      const bg = new Image();
      bg.crossOrigin = 'Anonymous';
      bg.src = backgroundUrl;
      bg.onload  = () => { ctx.drawImage(bg, 0, 0, canvas.width, canvas.height); drawFg(); };
      bg.onerror = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); drawFg(); };
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawFg();
    }
  }, [imageUrl, backgroundUrl, offsetX, offsetY, scale, productId]);

  return (
    <group>
      {/* Kupa gövdesi */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[config.radius, config.radius, config.height, 64]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </mesh>

      {/* Baskı alanı */}
      {texture && (
        <mesh>
          <cylinderGeometry args={[
            config.radius + 0.005,
            config.radius + 0.005,
            config.height,
            64, 1, true,
            (Math.PI / 2) + (0.12 * Math.PI),
            (1 - 0.12) * Math.PI * 2
          ]} />
          <meshStandardMaterial map={texture} roughness={0.4} transparent={false} />
        </mesh>
      )}

      {/* Kulp */}
      <mesh position={[config.radius, 0, 0]} castShadow>
        <torusGeometry args={[config.height * 0.25, 0.25, 16, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
