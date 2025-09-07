// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';

type Props = {
  character: 'kiki' | 'toby';
  title?: string;
  onDone: (res: { won: boolean; score: number; time: number }) => void;
};

type Obstacle = { x: number; y: number; w: number; h: number; vx: number; type: 'rat' | 'poop' };
type Collectible = { x: number; y: number; r: number; vx: number };

// --- Helper pour charger une image (fond Panthéon, etc.) ---
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function MiniGame({ character, title = 'Paris Run', onDone }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const intRef = useRef<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Nettoyage DOM et ancien canvas
    try {
      if (cvsRef.current?.parentElement === host) host.removeChild(cvsRef.current);
    } catch {}
    host.innerHTML = '';

    // Mesure du conteneur visible
    const rect = host.getBoundingClientRect();
    const W = Math.max(240, Math.floor(rect.width));
    const H = Math.max(200, Math.floor(rect.height));

    // Canvas + styles
    const cvs = document.createElement('canvas');
    cvsRef.current = cvs;
    cvs.width = W;
    cvs.height = H;
    Object.assign(cvs.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      position: 'absolute',
      inset: '0',
    } as CSSStyleDeclaration);
    host.appendChild(cvs);

    const ctx = cvs.getContext('2d');
    if (!ctx) {
      host.textContent = 'Canvas non supporté';
      return;
    }
    (ctx as any).imageSmoothingEnabled = false;

    // --- FOND IMAGE (Panthéon) ---
    const base = import.meta.env.BASE_URL || '/';
    const wantsPantheon = title.toLowerCase().includes('panthéon');
    const bgURL = wantsPantheon ? `${base}img/bg/pantheon.png` : '';
    let bgImage: HTMLImageElement | null = null;
    if (bgURL) {
      loadImage(bgURL).then(img => { bgImage = img; }).catch(() => { bgImage = null; });
    }

    // --- Paramètres jeu ---
    const groundY = Math.floor(H * 0.8);
    const gravity = 1700;
    const jumpV = 620;
    const worldSpeed = 260;
    const bodyColor = character === 'kiki' ? '#FFB84D' : '#5E93FF';

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
    cvs.addEventListener('pointerdown', onPointer, { passive: true });

    // Spawns
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const spawnRat = () => {
      const w = 28, h = 22;
      obs.push({ x: W + 40, y: groundY - h, w, h, vx: -(worldSpeed + rnd(20, 80)), type: 'rat' });
    };
    const spawnPoop = () => {
      const w = 18, h = 10;
      obs.push({ x: W + 40, y: groundY - h, w, h, vx: -(worldSpeed + rnd(0, 50)), type: 'poop' });
    };
    const spawnCoin = () => {
      const r = 8;
      coins.push({ x: W + 40, y: groundY - rnd(60, 140), r, vx: -(worldSpeed + rnd(30, 90)) });
    };

    let spawnAcc = 0;
    const trySpawn = (dt: number) => {
      spawnAcc += dt;
      if (spawnAcc >= 0.9) {
        spawnAcc = 0;
        const roll = Math.random();
        if (roll < 0.45) spawnRat();
        else if (roll < 0.75) spawnPoop();
        else spawnCoin();
      }
    };

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
    const clear = () => {
      // Fond image si dispo (cover)
      if (bgImage) {
        const cw = W, ch = H;
        const iw = bgImage.width, ih = bgImage.height;
        const cr = cw / ch, ir = iw / ih;
        let dw = cw, dh = ch, dx = 0, dy = 0;
        if (ir > cr) { dh = ch; dw = dh * ir; dx = (cw - dw) / 2; dy = 0; }
        else { dw = cw; dh = dw / ir; dx = 0; dy = (ch - dh) / 2; }
        ctx.drawImage(bgImage, dx, dy, dw, dh);
      } else {
        // fallback
        ctx.fillStyle = '#0e1320'; ctx.fillRect(0, 0, W, H);
      }

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = '20px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(title, 16, 28);
      ctx.font = '16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(String(score), W - 160, 26);
      ctx.fillText(Math.max(0, duration - elapsed).toFixed(1), W - 80, 26);

      // décor léger par-dessus le fond
      ctx.fillStyle = 'rgba(42,54,80,.65)';
      for (let i = 0; i < 6; i++) {
        const bw = 60 + (i*13 % 60);
        const bh = 60 + (i*29 % 120);
        const bx = i * (W / 6) + ((i*31)%40) - 20;
        ctx.fillRect(bx, groundY - bh - 40, bw, bh);
      }

      // sol
      ctx.fillStyle = 'rgba(31,41,55,.8)';
      ctx.fillRect(0, groundY, W, H - groundY);
    };

    const drawPlayer = () => {
      ctx.fillStyle = bodyColor;
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(player.x + 10, player.y + 10, 8, 8);
    };

    const drawEntities = () => {
      for (const o of obs) {
        ctx.fillStyle = o.type === 'rat' ? '#ef4444' : '#bdbdbd';
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
      for (const c of coins) {
        ctx.beginPath();
        ctx.fillStyle = character === 'kiki' ? '#ff9500' : '#007aff';
        ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
        ctx.fill();
      }
    };

    const finish = (won: boolean) => {
      alive = false;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = '28px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(won ? 'BRAVO !' : 'Aïe !', W/2, H/2 - 12);
      ctx.font = '20px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(`Score: ${score}`, W/2, H/2 + 20);
      ctx.textAlign = 'start';
      setTimeout(() => onDone({ won, score, time: Math.min(duration, elapsed) }), 800);
    };

    const step = (dt: number) => {
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
      for (const o of obs) o.x += o.vx * dt;
      for (const c of coins) c.x += c.vx * dt;

      // Collisions
      for (const o of obs) {
        if (aabb(player, { x: o.x, y: o.y, w: o.w, h: o.h })) {
          if (o.type === 'rat') { finish(false); return; }
          slowFactor = 0.4; setTimeout(() => (slowFactor = 1), 800); o.x = -9999;
        }
      }
      for (const c of coins) {
        if (rectCircle(player.x, player.y, player.w, player.h, c.x, c.y, c.r)) { score += 1; c.x = -9999; }
      }

      // Purge
      while (obs.length && obs[0].x < -60) obs.shift();
      while (coins.length && coins[0].x < -40) coins.shift();

      // Spawns + rendu
      trySpawn(dt);
      clear();
      drawEntities();
      drawPlayer();

      if (elapsed >= duration) finish(true);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.032, (now - t0) / 1000) * slowFactor;
      t0 = now;
      step(dt);
      if (alive) rafRef.current = requestAnimationFrame(frame);
    };

    // Démarrage
    clear(); drawPlayer();
    t0 = performance.now();
    rafRef.current = requestAnimationFrame(frame);

    // Fallback en cas de throttle iOS (onglet inactif)
    intRef.current = window.setInterval(() => { if (alive) step((1/60) * slowFactor); }, 1000/60) as unknown as number;

    // Cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (intRef.current) clearInterval(intRef.current);
      window.removeEventListener('keydown', onKey);
      cvs.removeEventListener('pointerdown', onPointer);
      if (cvs.parentElement === host) host.removeChild(cvs);
      cvsRef.current = null;
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
        background: '#0b0d10',
      }}
    />
  );
}
