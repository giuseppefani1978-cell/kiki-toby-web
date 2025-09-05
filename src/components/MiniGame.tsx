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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Mesure le conteneur (4/3 via style parent)
    const rect = host.getBoundingClientRect();
    const W = Math.max(240, Math.floor(rect.width));
    const H = Math.max(200, Math.floor(rect.height));

    // Crée / prépare le canvas
    let cvs = canvasRef.current;
    if (!cvs) {
      cvs = document.createElement('canvas');
      canvasRef.current = cvs;
      host.appendChild(cvs);
    }
    cvs.width = W;
    cvs.height = H;
    const ctx = cvs.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // --- State jeu ---
    const groundY = Math.floor(H * 0.8);
    const gravity = 1700;       // px/s²
    const jumpV = 620;          // px/s
    const worldSpeed = 260;     // px/s
    const colorBody = character === 'kiki' ? '#FFB84D' : '#5E93FF';

    let t0 = performance.now();
    let alive = true;
    let score = 0;
    let elapsed = 0;
    const duration = 20;        // secondes
    let slowFactor = 1;         // 1 → normal, <1 ralenti court

    // Joueur
    const player = { x: 80, y: groundY - 36, w: 36, h: 36, vy: 0, grounded: true };

    // Entités
    const obs: Obstacle[] = [];
    const coins: Collectible[] = [];

    // Input
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
    const onClick = () => jump();
    window.addEventListener('keydown', onKey);
    cvs.addEventListener('click', onClick);

    // Spawn helpers
    function spawnRat() {
      const w = 28, h = 22;
      obs.push({ x: W + 40, y: groundY - h, w, h, vx: -(worldSpeed + rand(20, 80)), type: 'rat' });
    }
    function spawnPoop() {
      const w = 18, h = 10;
      obs.push({ x: W + 40, y: groundY - h, w, h, vx: -(worldSpeed + rand(0, 50)), type: 'poop' });
    }
    function spawnCoin() {
      const r = 8;
      coins.push({ x: W + 40, y: groundY - rand(60, 140), r, vx: -(worldSpeed + rand(30, 90)) });
    }
    function rand(a: number, b: number) { return a + Math.random() * (b - a); }

    // Boucle de spawn
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

    // Collisions AABB / cercle
    function aabb(a: {x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }
    function rectCircle(px:number,py:number,pw:number,ph:number, cx:number,cy:number, r:number) {
      const rx = Math.max(px, Math.min(cx, px+pw));
      const ry = Math.max(py, Math.min(cy, py+ph));
      const dx = cx - rx, dy = cy - ry;
      return dx*dx + dy*dy < r*r;
    }

    // Render helpers
    function clear() {
      // fond
      ctx.fillStyle = '#F0F4F7';
      ctx.fillRect(0, 0, W, H);
      // titre / HUD
      ctx.fillStyle = '#141820';
      ctx.font = '20px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(title, 16, 24);
      ctx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillText(String(score), W - 160, 22);
      const remain = Math.max(0, duration - elapsed).toFixed(1);
      ctx.fillText(remain, W - 80, 22);

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
      // œil
      ctx.fillStyle = '#141820';
      ctx.fillRect(player.x + 10, player.y + 10, 8, 8);
    }

    function drawEntities() {
      // obstacles
      for (const o of obs) {
        if (o.type === 'rat') ctx.fillStyle = '#505050'; else ctx.fillStyle = '#B0B0B0';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = '#141820';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
      }
      // pièces
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

    // Fin
    function finish(won: boolean) {
      alive = false;
      // petit overlay
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

    // Boucle principale
    function frame(t: number) {
      const dt = Math.min(0.032, (t - t0) / 1000); // clamp
      t0 = t;
      if (alive) elapsed += dt;

      // MàJ joueur
      player.vy += gravity * dt;
      player.y += player.vy * dt;
      if (player.y >= groundY - player.h) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
      }

      // MàJ monde
      const spd = worldSpeed * dt * slowFactor;

      obs.forEach(o => { o.x += o.vx * dt; });
      coins.forEach(c => { c.x += c.vx * dt; });

      // collisions
      for (const o of obs) {
        if (aabb(player, { x: o.x, y: o.y, w: o.w, h: o.h })) {
          if (o.type === 'rat') {
            finish(false);
            break;
          } else {
            slowFactor = 0.4;
            // Ralentissement court
            setTimeout(() => { slowFactor = 1; }, 800);
            o.x = -9999; // « détruit »
          }
        }
      }
      for (const c of coins) {
        if (rectCircle(player.x, player.y, player.w, player.h, c.x, c.y, c.r)) {
          score += 1;
          c.x = -9999;
        }
      }

      // purge
      while (obs.length && obs[0].x < -60) obs.shift();
      while (coins.length && coins[0].x < -40) coins.shift();

      // spawn
      if (alive) trySpawn(dt);

      // rendu
      clear();
      drawEntities();
      drawPlayer();

      // condition de victoire
      if (alive && elapsed >= duration) finish(true);

      if (alive) rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    // Cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      window.removeEventListener('keydown', onKey);
      cvs?.removeEventListener('click', onClick);
      // retire le canvas pour être propre lors de l’unmount
      if (cvs && cvs.parentElement === host) host.removeChild(cvs);
      canvasRef.current = null;
    };
  }, [character, title, onDone]);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        maxWidth: 680,
        aspectRatio: '4 / 3',   // garde EXACTEMENT la même taille qu’aujourd’hui
        background: '#0b0d10',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative'
      }}
    />
  );
}
