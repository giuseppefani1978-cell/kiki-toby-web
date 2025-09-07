// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';

type Props = {
  character: 'kiki' | 'toby';
  title?: string;
  onDone: (res: { won: boolean; score: number; time: number }) => void;
  moveLeft?: boolean;
  moveRight?: boolean;
  /** Incrémente ce nombre pour déclencher un saut (0→1→2…) */
  jumpTick?: number;
};

type Obstacle = { x: number; y: number; w: number; h: number; vx: number; type: 'rat' | 'poop' };
type Collectible = { x: number; y: number; r: number; vx: number };

// --- Helper image (fond)
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function MiniGame({
  character,
  title = 'Paris Run',
  onDone,
  moveLeft,
  moveRight,
  jumpTick,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cvsRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const watchdogRef = useRef<number | null>(null);

  // contrôles externes
  const moveLeftRef = useRef<boolean>(!!moveLeft);
  const moveRightRef = useRef<boolean>(!!moveRight);
  const lastJumpTickRef = useRef<number>(jumpTick ?? 0);
  const requestJumpRef = useRef<boolean>(false);

  useEffect(() => { moveLeftRef.current = !!moveLeft; }, [moveLeft]);
  useEffect(() => { moveRightRef.current = !!moveRight; }, [moveRight]);
  useEffect(() => {
    if (jumpTick === undefined) return;
    if (jumpTick !== lastJumpTickRef.current) {
      lastJumpTickRef.current = jumpTick;
      requestJumpRef.current = true;
    }
  }, [jumpTick]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Nettoyage DOM / ancien canvas
    try { if (cvsRef.current?.parentElement === host) host.removeChild(cvsRef.current); } catch {}
    host.innerHTML = '';

    // --- Mesure + DPR (retina)
    const rect = host.getBoundingClientRect();
    const cssW = Math.max(240, Math.floor(rect.width));
    const cssH = Math.max(200, Math.floor(rect.height));
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); // clamp pour éviter des textures énormes

    // --- Canvas
    const cvs = document.createElement('canvas');
    cvsRef.current = cvs;
    // Backing store en pixels réels
    cvs.width = Math.floor(cssW * dpr);
    cvs.height = Math.floor(cssH * dpr);
    // Taille CSS (mise à l’échelle par le navigateur)
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
    // mise à l’échelle du contexte (toutes les coords sont en “unités CSS”)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // on veut un fond lisse (image) + formes nettes
    (ctx as any).imageSmoothingEnabled = true;

    // --- Fond image (Panthéon)
    const base = import.meta.env.BASE_URL || '/';
    const wantsPantheon = title.toLowerCase().includes('panthéon');
    const bgURL = wantsPantheon ? `${base}img/bg/pantheon.PNG` : '';
    let bgImage: HTMLImageElement | null = null;
    if (bgURL) loadImage(bgURL).then(img => { bgImage = img; }).catch(() => { bgImage = null; });

    // --- Paramètres jeu (adoucis)
    const groundY = Math.floor(cssH * 0.8);
    const gravity = 1500;           // ↓ un peu
    const jumpV = 540;              // ↓ un peu
    const playerSpeed = 180;        // ↓
    const worldSpeed = 180;         // ↓ scroll obstacles
    const bodyColor = character === 'kiki' ? '#FFB84D' : '#5E93FF';

    const DURATION = 20;
    let elapsed = 0;
    let score = 0;
    let alive = true;
    let slowFactor = 1;

    const player = { x: 80, y: groundY - 36, w: 36, h: 36, vx: 0, vy: 0, grounded: true };

    const obs: Obstacle[] = [];
    const coins: Collectible[] = [];

    // --- Entrées clavier (desktop)
    const onKey = (e: KeyboardEvent) => {
      const down = e.type === 'keydown';
      switch (e.code) {
        case 'ArrowLeft': moveLeftRef.current = down; break;
        case 'ArrowRight': moveRightRef.current = down; break;
        case 'Space':
        case 'ArrowUp':
          if (down) requestJumpRef.current = true;
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    // --- Tap = saut (mobile)
    const onPointer = () => { requestJumpRef.current = true; };
    cvs.addEventListener('pointerdown', onPointer, { passive: true });

    // --- Spawns (un peu moins fréquents)
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    let spawnAcc = 0;
    const trySpawn = (dt: number) => {
      spawnAcc += dt;
      const interval = 1.1; // ↑ plus long → moins d’objets
      if (spawnAcc >= interval) {
        spawnAcc = 0;
        const r = Math.random();
        if (r < 0.40) { // rat
          const w = 28, h = 22;
          obs.push({ x: cssW + 40, y: groundY - h, w, h, vx: -(worldSpeed + rnd(10, 50)), type: 'rat' });
        } else if (r < 0.70) { // caca
          const w = 18, h = 10;
          obs.push({ x: cssW + 40, y: groundY - h, w, h, vx: -(worldSpeed + rnd(0, 30)), type: 'poop' });
        } else { // pièce
          const r = 8;
          coins.push({ x: cssW + 40, y: groundY - rnd(60, 140), r, vx: -(worldSpeed + rnd(10, 60)) });
        }
      }
      // bornage max d’objets à l’écran pour éviter les pics
      if (obs.length > 12) obs.splice(0, obs.length - 12);
      if (coins.length > 10) coins.splice(0, coins.length - 10);
    };

    // --- Collisions
    const aabb = (a:{x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    const rectCircle = (px:number,py:number,pw:number,ph:number, cx:number,cy:number, r:number) => {
      const rx = Math.max(px, Math.min(cx, px+pw));
      const ry = Math.max(py, Math.min(cy, py+ph));
      const dx = cx - rx, dy = cy - ry;
      return dx*dx + dy*dy < r*r;
    };

    // --- Rendu
    const draw = () => {
      // Fond
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

      // Sol
      ctx.fillStyle = 'rgba(31,41,55,.85)';
      ctx.fillRect(0, groundY, cssW, cssH - groundY);

      // Entités
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

      // Joueur
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

    // --- Simulation (pas fixe 60 FPS)
    const STEP = 1 / 60;
    const MAX_FRAME = 0.10; // clamp anti-sauts (100ms)
    let acc = 0;
    let t0 = performance.now() / 1000;
    let gotRafRecently = true;

    const finish = (won: boolean) => {
      alive = false;
      // petit overlay de fin
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
      // saut demandé ?
      if (requestJumpRef.current && player.grounded) {
        requestJumpRef.current = false;
        player.vy = -jumpV;
        player.grounded = false;
      }

      // physique verticale
      player.vy += gravity * STEP;
      player.y += player.vy * STEP;
      if (player.y >= groundY - player.h) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
      }

      // horizontal (overlay/clavier)
      const left = moveLeftRef.current ? 1 : 0;
      const right = moveRightRef.current ? 1 : 0;
      const targetVx = (right - left) * playerSpeed;
      // petit amorti pour la fluidité
      player.vx += (targetVx - player.vx) * 0.25;
      player.x += player.vx * STEP;

      // limites
      if (player.x < 8) player.x = 8;
      if (player.x > cssW - player.w - 8) player.x = cssW - player.w - 8;

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

      // purge
      while (obs.length && obs[0].x < -80) obs.shift();
      while (coins.length && coins[0].x < -60) coins.shift();

      // spawns
      trySpawn(STEP);

      elapsed += STEP * slowFactor;
      if (elapsed >= DURATION) finish(true);
    };

    const loop = (nowMs: number) => {
      gotRafRecently = true;
      const now = nowMs / 1000;
      let dt = now - t0;
      t0 = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;

      acc += dt * slowFactor;
      // au cas où la page lag, bornage du nombre de steps
      let guard = 0;
      while (acc >= STEP && guard < 6) {
        stepOnce();
        acc -= STEP;
        guard++;
        if (!alive) break;
      }

      draw();
      if (alive) rafRef.current = requestAnimationFrame(loop);
    };

    // --- Watchdog : active le fallback timer SEULEMENT si rAF n’a pas pulsé depuis 300ms
    const pingWatchdog = () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      watchdogRef.current = window.setTimeout(() => {
        if (!gotRafRecently && !timerRef.current) {
          // Fallback 30 FPS
          timerRef.current = window.setInterval(() => {
            // simule une frame ~33ms
            const fakeNow = performance.now();
            loop(fakeNow);
          }, 33) as unknown as number;
        }
        gotRafRecently = false;
        pingWatchdog(); // relance
      }, 300) as unknown as number;
    };

    draw(); // premier rendu
    rafRef.current = requestAnimationFrame(loop);
    pingWatchdog();

    // Cleanup
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      cvs.removeEventListener('pointerdown', onPointer);
      if (cvs.parentElement === host) host.removeChild(cvs);
      cvsRef.current = null;
    };
  }, [character, title, onDone]); // commandes externes via refs

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
