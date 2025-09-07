// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';

type Props = {
  character: 'kiki' | 'toby';
  title?: string;
  onDone: (res: { won: boolean; score: number; time: number }) => void;
};

type Obstacle = { x: number; y: number; w: number; h: number; vx: number; type: 'rat' | 'poop' };
type Collectible = { x: number; y: number; r: number; vx: number };

// Helper image (fond)
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

  // 🔒 Empêche une double initialisation (StrictMode / re-render parent)
  const initedRef = useRef(false);

  useEffect(() => {
    if (initedRef.current) return; // déjà lancé
    initedRef.current = true;

    const host = hostRef.current;
    if (!host) return;

    // --- Canvas HiDPI ---
    const rect = host.getBoundingClientRect();
    const cssW = Math.max(240, Math.floor(rect.width));
    const cssH = Math.max(200, Math.floor(rect.height));
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    const cvs = document.createElement('canvas');
    cvsRef.current = cvs;
    cvs.width = Math.floor(cssW * dpr);
    cvs.height = Math.floor(cssH * dpr);
    Object.assign(cvs.style, {
      display: 'block',
      width: `${cssW}px`,
      height: `${cssH}px`,
      position: 'absolute',
      inset: '0',
      touchAction: 'none',
    } as CSSStyleDeclaration);
    host.appendChild(cvs);

    const ctx = cvs.getContext('2d');
    if (!ctx) { host.textContent = 'Canvas non supporté'; return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    (ctx as any).imageSmoothingEnabled = true;

    // --- Fond (Panthéon si titre contient “panthéon”) ---
    const base = import.meta.env.BASE_URL || '/';
    const wantsPantheon = title.toLowerCase().includes('panthéon');
    const bgURL = wantsPantheon ? `${base}img/bg/pantheon.PNG` : '';
    let bgImage: HTMLImageElement | null = null;
    if (bgURL) loadImage(bgURL).then(img => { bgImage = img; }).catch(() => { bgImage = null; });

    // --- Paramètres adoucis ---
    const groundY = Math.floor(cssH * 0.8);
    const gravity = 1500;
    const jumpV = 540;
    const playerAccel = 1200;      // accélération horizontale
    const friction = 900;          // frottement quand aucune entrée
    const maxSpeed = 220;          // vitesse max horizontale
    const worldSpeed = 180;
    const bodyColor = character === 'kiki' ? '#FFB84D' : '#5E93FF';

    const DURATION = 20;
    let elapsed = 0;
    let score = 0;
    let alive = true;
    let slowFactor = 1;

    const player = { x: 80, y: groundY - 36, w: 36, h: 36, vx: 0, vy: 0, grounded: true };

    const obs: Obstacle[] = [];
    const coins: Collectible[] = [];

    // --- Entrées clavier ---
    const keys = { left: false, right: false, jump: false };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') keys.left = true;
      else if (e.code === 'ArrowRight') keys.right = true;
      else if (e.code === 'Space' || e.code === 'ArrowUp') keys.jump = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft') keys.left = false;
      else if (e.code === 'ArrowRight') keys.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const onPointer = () => { keys.jump = true; };
    cvs.addEventListener('pointerdown', onPointer, { passive: true });

    // --- Spawns ---
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    let spawnAcc = 0;
    const trySpawn = (dt: number) => {
      spawnAcc += dt;
      if (spawnAcc >= 1.1) {
        spawnAcc = 0;
        const r = Math.random();
        if (r < 0.40) {
          const w = 28, h = 22;
          obs.push({ x: cssW + 40, y: groundY - h, w, h, vx: -(worldSpeed + rnd(10, 50)), type: 'rat' });
        } else if (r < 0.70) {
          const w = 18, h = 10;
          obs.push({ x: cssW + 40, y: groundY - h, w, h, vx: -(worldSpeed + rnd(0, 30)), type: 'poop' });
        } else {
          const r = 8;
          coins.push({ x: cssW + 40, y: groundY - rnd(60, 140), r, vx: -(worldSpeed + rnd(10, 60)) });
        }
      }
      if (obs.length > 12) obs.splice(0, obs.length - 12);
      if (coins.length > 10) coins.splice(0, coins.length - 10);
    };

    // --- Collisions ---
    const aabb = (a:{x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    const rectCircle = (px:number,py:number,pw:number,ph:number, cx:number,cy:number, r:number) => {
      const rx = Math.max(px, Math.min(cx, px+pw));
      const ry = Math.max(py, Math.min(cy, py+ph));
      const dx = cx - rx, dy = cy - ry;
      return dx*dx + dy*dy < r*r;
    };

    // --- Rendu ---
    const draw = () => {
      // fond
      if (bgImage) {
        const cw = cssW, ch = cssH;
        const iw = bgImage.width, ih = bgImage.height;
        const cr = cw / ch, ir = iw / ih;
        let dw = cw, dh = ch, dx = 0, dy = 0;
        if (ir > cr) { dh = ch; dw = dh * ir; dx = (cw - dw) / 2; dy = 0; }
        else { dw = cw; dh = dw / ir; dx = 0; dy = (ch - dh) / 2; }
        ctx.drawImage(bgImage, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = '#0e1320';
        ctx.fillRect(0, 0, cssW, cssH);
      }

      // sol
      ctx.fillStyle = 'rgba(31,41,55,.85)';
      ctx.fillRect(0, groundY, cssW, cssH - groundY);

      // entités
      for (const o of obs) {
        ctx.fillStyle = o.type === 'rat' ? '#ef4444' : '#bdbdbd';
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
      for (const c of coins) {
        ctx.beginPath();
        ctx.fillStyle = character === 'kiki' ? '#ff9500' : '#007aff';
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // joueur
      ctx.fillStyle = bodyColor;
      ctx.fillRect(player.x, player.y, player.w, player.h);
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(player.x + 10, player.y + 10, 8, 8);

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = '20px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(title, 16, 28);
      ctx.font = '16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(String(score), cssW - 160, 26);
      ctx.fillText(Math.max(0, DURATION - elapsed).toFixed(1), cssW - 80, 26);
    };

    // --- Step (60 FPS fixe)
    const STEP = 1 / 60;
    const MAX_FRAME = 0.10;
    let acc = 0;
    let t0 = performance.now() / 1000;

    const finish = (won: boolean) => {
      alive = false;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = '#fff';
      ctx.font = '28px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(won ? 'BRAVO !' : 'Aïe !', cssW / 2, cssH / 2 - 12);
      ctx.font = '20px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(`Score: ${score}`, cssW / 2, cssH / 2 + 20);
      ctx.textAlign = 'start';
      setTimeout(() => onDone({ won, score, time: Math.min(DURATION, elapsed) }), 700);
    };

    const stepOnce = () => {
      // saut
      if (keys.jump && player.grounded) {
        player.vy = -jumpV;
        player.grounded = false;
      }
      keys.jump = false;

      // vertical
      player.vy += gravity * STEP;
      player.y += player.vy * STEP;
      if (player.y >= groundY - player.h) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
      }

      // horizontal → accélération + friction (ne ramène PAS à x=80)
      let ax = 0;
      if (keys.left) ax -= playerAccel;
      if (keys.right) ax += playerAccel;
      if (!keys.left && !keys.right) {
        // friction vers 0
        if (player.vx > 0) { player.vx = Math.max(0, player.vx - friction * STEP); }
        else if (player.vx < 0) { player.vx = Math.min(0, player.vx + friction * STEP); }
      } else {
        player.vx += ax * STEP;
      }
      // bornage vitesse
      if (player.vx > maxSpeed) player.vx = maxSpeed;
      if (player.vx < -maxSpeed) player.vx = -maxSpeed;

      player.x += player.vx * STEP;

      // limites écran
      if (player.x < 8) { player.x = 8; player.vx = 0; }
      if (player.x > cssW - player.w - 8) { player.x = cssW - player.w - 8; player.vx = 0; }

      // monde
      for (const o of obs) o.x += o.vx * STEP;
      for (const c of coins) c.x += c.vx * STEP;

      // collisions
      for (const o of obs) {
        if (aabb(player, { x: o.x, y: o.y, w: o.w, h: o.h })) {
          if (o.type === 'rat') { finish(false); return; }
          slowFactor = 0.5; setTimeout(() => (slowFactor = 1), 600);
          o.x = -9999;
        }
      }
      for (const c of coins) {
        if (rectCircle(player.x, player.y, player.w, player.h, c.x, c.y, c.r)) {
          score += 1; c.x = -9999;
        }
      }

      while (obs.length && obs[0].x < -80) obs.shift();
      while (coins.length && coins[0].x < -60) coins.shift();

      trySpawn(STEP);
      elapsed += STEP * slowFactor;
      if (elapsed >= DURATION) finish(true);
    };

    const loop = (nowMs: number) => {
      const now = nowMs / 1000;
      let dt = now - t0;
      t0 = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;

      acc += dt * slowFactor;
      let guard = 0;
      while (acc >= STEP && guard < 6) {
        stepOnce();
        acc -= STEP;
        guard++;
        if (!alive) break;
      }

      draw();
      if (alive) requestAnimationFrame(loop);
    };

    draw();
    requestAnimationFrame(loop);

    // Cleanup à la fermeture de l’overlay
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cvs.removeEventListener('pointerdown', onPointer);
      if (cvs.parentElement === host) host.removeChild(cvs);
      cvsRef.current = null;
    };
  }, [character, title, onDone]); // on ne relance pas à chaque re-render

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
