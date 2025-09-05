// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';

type Props = {
  character: 'kiki' | 'toby';
  title?: string;
  onDone: (res: { won: boolean; score: number; time: number }) => void;
};

type Obstacle = { x: number; y: number; w: number; h: number; vx: number; type: 'rat' | 'poop' };
type Collectible = { x: number; y: number; r: number; vx: number };

export default function MiniGame({ character, title = 'Paris Run', onDone }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Nettoyage DOM et ancien canvas
    try {
      if (canvasRef.current?.parentElement === host) host.removeChild(canvasRef.current);
    } catch {}
    host.innerHTML = '';

    // Mesure du conteneur visible
    const rect = host.getBoundingClientRect();
    const W = Math.max(240, Math.floor(rect.width));
    const H = Math.max(200, Math.floor(rect.height));

    // Canvas + styles (remplit 100%)
    const cvs = document.createElement('canvas');
    canvasRef.current = cvs;
    cvs.width = W;
    cvs.height = H;
    cvs.style.display = 'block';
    cvs.style.width = '100%';
    cvs.style.height = '100%';
    cvs.style.position = 'absolute';
    cvs.style.inset = '0';
    host.appendChild(cvs);

    const ctx = cvs.getContext('2d');
    if (!ctx) {
      // Ultra rare, mais au cas où
      host.textContent = 'Canvas non supporté';
      return;
    }
    (ctx as any).imageSmoothingEnabled = false;

    // === Écran immédiat (diagnostic) ===
    ctx.fillStyle = '#F0F4F7';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#141820';
    ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText('Initialisation…', 14, 24);

    // --- State jeu ---
    const groundY = Math.floor(H * 0.8);
    const gravity = 1700;
    const jumpV = 620;
    const worldSpeed = 260;
    const colorBody = character === 'kiki' ? '#FFB84D' : '#5E93FF';

    let t0 = performance.now();
    let alive = true;
    let score = 0;
    let elapsed = 0;
    const duration = 20;
    let slowFactor = 1;

    const player = { x: 80, y: groundY - 36, w: 36, h: 36, vy: 0, grounded: true };
    const obs: Obstacle[] = [];
    const coins: Collectible[] = [];

    // Inputs
    const jump = () => {
      if (!alive) return;
      if (player.grounded) {
        player.vy = -jumpV;
        player.grounded = false;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') jump();
    };
    const onPointer = () => jump();
    window.addEventListener('keydown', onKey);
    // pointerdown marche mieux que click (mobile)
    cvs.addEventListener('pointerdown', onPointer, { passive: true });

    // Spawns
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const spawnRat = () => {
      const w = 28, h = 22;
      obs.push({ x: W + 40, y: groundY - h, w, h, vx: -(worldSpeed + rand(20, 80)), type: 'rat' });
    };
    const spawnPoop = () => {
      const w = 18, h = 10;
      obs.push({ x: W + 40, y: groundY - h, w, h, vx: -(worldSpeed + rand(0, 50)), type: 'poop' });
    };
    const spawnCoin = () => {
      const r = 8;
      coins.push({ x: W + 40, y: groundY - rand(60, 140), r, vx: -(worldSpeed + rand(30, 90)) });
    };

    let spawnAcc = 0;
    function trySpawn(dt: number) {
      spawnAcc += dt;
      if (spawnAcc >= 0.9) {
        spawnAcc = 0;
        const roll = Math.random();
        if (roll < 0.45) spawnRat();
        else if (roll < 0.75) spawnPoop();
        else spawnCoin();
      }
    }

    // Collisions
    const aabb = (a:{x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const rectCircle = (px:number,py:number,pw:number,ph:number, cx:number,cy:number, r:number) => {
      const rx = Math.max(px, Math.min(cx, px+pw));
      const ry = Math.max(py, Math.min(cy, py+ph));
      const dx = cx - rx, dy = cy - ry;
      return dx*dx + dy*dy < r*r;
    };

    // Rendu
    function clear() {
      ctx.fillStyle = '#F0F4F7'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#141820';
      ctx.font = '20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(title, 16, 24);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(String(score), W - 160, 22);
      ctx.fillText(Math.max(0, duration - elapsed).toFixed(1), W - 80, 22);

      // décor
      ctx.fillStyle = '#D2D6DC';
      for (let i = 0; i < 6; i++) {
        const bw = 60 + (i*13 % 60);
        const bh = 60 + (i*29 % 120);
        const bx = i * (W / 6) + ((i*31)%40) - 20;
        ctx.fillRect(bx, groundY - bh - 40, bw, bh);
      }

      // sol
      ctx.fillStyle = '#DCE0E4';
      ctx.fillRect(0, groundY, W, H - groundY);
      ctx.strokeStyle = '#BEC2C6';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, groundY, W, H - groundY);
    }

    function drawPlayer() {
      ctx.fillStyle = colorBody;
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.fillStyle = '#141820';
      ctx.fillRect(player.x + 10, player.y + 10, 8, 8);
    }

    function drawEntities() {
      for (const o of obs) {
        ctx.fillStyle = o.type === 'rat' ? '#505050' : '#B0B0B0';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = '#141820';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
      }
      for (const c of coins) {
        ctx.beginPath();
        ctx.fillStyle = character === 'kiki' ? '#FF9500' : '#007AFF';
        ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#141820';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    function finish(won: boolean) {
      alive = false;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '28px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(won ? 'BRAVO !' : 'Aïe !', W/2, H/2 - 12);
      ctx.font = '20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(`Score: ${score}`, W/2, H/2 + 20);
      setTimeout(() => onDone({ won, score, time: Math.min(duration, elapsed) }), 800);
    }

    // Boucle
    function step(dt: number) {
      if (!alive) return;

      elapsed += dt;

      // Joueur
      player.vy += gravity * dt;
      player.y += player.vy * dt;
      if (player.y >= groundY - player.h) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
      }

      // Monde
      obs.forEach(o => { o.x += o.vx * dt; });
      coins.forEach(c => { c.x += c.vx * dt; });

      // Collisions
      for (const o of obs) {
        if (aabb(player, { x: o.x, y: o.y, w: o.w, h: o.h })) {
          if (o.type === 'rat') { finish(false); break; }
          else { slowFactor = 0.4; setTimeout(() => (slowFactor = 1), 800); o.x = -9999; }
        }
      }
      for (const c of coins) {
        if (rectCircle(player.x, player.y, player.w, player.h, c.x, c.y, c.r)) {
          score += 1; c.x = -9999;
        }
      }

      // Purge
      while (obs.length && obs[0].x < -60) obs.shift();
      while (coins.length && coins[0].x < -40) coins.shift();

      // Spawns
      trySpawn(dt);

      // Rendu
      clear();
      drawEntities();
      drawPlayer();

      if (elapsed >= duration) finish(true);
    }

    function frame(now: number) {
      const dt = Math.min(0.032, (now - t0) / 1000) * slowFactor;
      t0 = now;
      step(dt);
      if (alive) rafRef.current = requestAnimationFrame(frame);
    }

    // Démarre tout de suite (rendu immédiat + raf)
    clear(); drawPlayer();
    t0 = performance.now();
    rafRef.current = requestAnimationFrame(frame);

    // Fallback si rAF est throttlé (certaines configs iOS)
    timerRef.current = window.setInterval(() => {
      if (!alive) return;
      step(1/60);
    }, 1000/60) as unknown as number;

    // Cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('keydown', onKey);
      cvs.removeEventListener('pointerdown', onPointer);
      if (cvs.parentElement === host) host.removeChild(cvs);
      canvasRef.current = null;
    };
  }, [character, title, onDone]);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        maxWidth: 680,
        aspectRatio: '4 / 3',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        background: '#0b0d10', // seulement si le canvas n’est pas rendu
      }}
    />
  );
}
