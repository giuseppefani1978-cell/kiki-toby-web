// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';

type Props = {
  character: 'kiki' | 'toby';
  title?: string;
  onDone: (res: { won: boolean; score: number; time: number }) => void;

  // Commandes tactiles (venues de MiniGameOverlay)
  moveLeft?: boolean;
  moveRight?: boolean;
  /** Incrémente de +1 à chaque appui sur le bouton Saut */
  jumpTick?: number;
};

type Obstacle = { x: number; y: number; w: number; h: number; vx: number; type: 'rat' | 'poop' };
type Collectible = { x: number; y: number; r: number; vx: number };

// --- util: chargement d’image
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
  const initedRef = useRef(false);

  // Refs pour lire les props “live” dans la boucle
  const leftRef = useRef(moveLeft);
  const rightRef = useRef(moveRight);
  const jumpTickRef = useRef(jumpTick);
  const lastJumpSeen = useRef(-1);

  useEffect(() => { leftRef.current = moveLeft; }, [moveLeft]);
  useEffect(() => { rightRef.current = moveRight; }, [moveRight]);
  useEffect(() => { jumpTickRef.current = jumpTick; }, [jumpTick]);

  useEffect(() => {
    if (initedRef.current) return; // évite double init (StrictMode)
    initedRef.current = true;

    const host = hostRef.current;
    if (!host) return;

    // --- Canvas HiDPI
    const rect = host.getBoundingClientRect();
    const CSS_W = Math.max(240, Math.floor(rect.width));
    const CSS_H = Math.max(200, Math.floor(rect.height));
    const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    const cvs = document.createElement('canvas');
    cvsRef.current = cvs;
    cvs.width = Math.floor(CSS_W * DPR);
    cvs.height = Math.floor(CSS_H * DPR);
    Object.assign(cvs.style, {
      display: 'block',
      width: `${CSS_W}px`,
      height: `${CSS_H}px`,
      position: 'absolute',
      inset: '0',
      touchAction: 'none',
    } as CSSStyleDeclaration);
    host.appendChild(cvs);

    const ctx = cvs.getContext('2d');
    if (!ctx) { host.textContent = 'Canvas non supporté'; return; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    (ctx as any).imageSmoothingEnabled = true;

    // --- Fond image
    const base = import.meta.env.BASE_URL || '/';
    const wantsPantheon = title.toLowerCase().includes('panthéon');
    const bgURL = wantsPantheon ? `${base}img/bg/pantheon.PNG` : '';
    let bgImage: HTMLImageElement | null = null;
    if (bgURL) loadImage(bgURL).then(i => (bgImage = i)).catch(() => (bgImage = null));

    // --- Constantes gameplay
    const groundY     = Math.floor(CSS_H * 0.80);
    const gravity     = 1500;
    const jumpV       = 540;
    const accelX      = 1000;
    const frictionX   = 800;
    const maxVx       = 210;
    const worldSpeed  = 160;
    const DURATION    = 20;
    const START_DELAY = 0.8;     // pas de mouvement monde / pas de collision au départ
    const INVINCIBLE_AFTER_START = 1.0; // invincibilité supplémentaire (sécurité)
    const DEBUG = false;         // passe à true pour voir les chiffres

    const bodyColor = character === 'kiki' ? '#FFB84D' : '#5E93FF';

    // --- État
    const player = { x: 80, y: groundY - 36, w: 36, h: 36, vx: 0, vy: 0, grounded: true };
    const obs: Obstacle[] = [];
    const coins: Collectible[] = [];

    let score = 0;
    let elapsed = 0;
    let alive = true;
    let slow = 1;
    let startCountdown = START_DELAY;
    let noFailTimer = START_DELAY + INVINCIBLE_AFTER_START; // invincibilité de confort
    let finishReason: 'rat' | 'time' | null = null;

    // --- Entrées (clavier)
    const keys = { left: false, right: false, wantJump: false };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft')  keys.left = true;
      if (e.code === 'ArrowRight') keys.right = true;
      if (e.code === 'Space' || e.code === 'ArrowUp') keys.wantJump = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft')  keys.left = false;
      if (e.code === 'ArrowRight') keys.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ⚠️ On NE met plus de pointerdown sur le canvas.
    // Le saut sur mobile vient du bouton overlay (jumpTick).

    // Fusionne clavier + overlay
    function readInputs() {
      const input = { left: keys.left, right: keys.right, jump: false };

      if (typeof leftRef.current === 'boolean')  input.left  = !!leftRef.current;
      if (typeof rightRef.current === 'boolean') input.right = !!rightRef.current;

      // saut “edge triggered” via jumpTick
      if (typeof jumpTickRef.current === 'number' && jumpTickRef.current !== lastJumpSeen.current) {
        input.jump = true;
        lastJumpSeen.current = jumpTickRef.current;
      }

      // petit bonus: si on commence à bouger pour la 1ère fois, prolonge l’invincibilité un peu
      if ((input.left || input.right || input.jump) && elapsed < 2) {
        noFailTimer = Math.max(noFailTimer, 0.4);
      }

      return input;
    }

    // --- Spawns
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    let spawnAcc = 0;
    const safeSpawnX = () => player.x + player.w + 24;

    function trySpawn(dt: number) {
      if (startCountdown > 0) return;

      spawnAcc += dt;
      if (spawnAcc < 1.1) return;
      spawnAcc = 0;

      const r = Math.random();
      if (r < 0.40) {
        const w = 28, h = 22;
        const x = CSS_W + 40, y = groundY - h;
        if (x > safeSpawnX() + 40) obs.push({ x, y, w, h, vx: -(worldSpeed + rnd(10, 50)), type: 'rat' });
      } else if (r < 0.70) {
        const w = 18, h = 10;
        const x = CSS_W + 40, y = groundY - h;
        if (x > safeSpawnX() + 40) obs.push({ x, y, w, h, vx: -(worldSpeed + rnd(0, 30)), type: 'poop' });
      } else {
        const r2 = 8;
        const x = CSS_W + 40, y = groundY - rnd(60, 140);
        if (x > safeSpawnX() + 40) coins.push({ x, y, r: r2, vx: -(worldSpeed + rnd(10, 60)) });
      }

      if (obs.length > 12)   obs.splice(0, obs.length - 12);
      if (coins.length > 10) coins.splice(0, coins.length - 10);
    }

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
    function draw() {
      // fond
      if (bgImage) {
        const cw = CSS_W, ch = CSS_H;
        const iw = bgImage.width, ih = bgImage.height;
        const cr = cw / ch, ir = iw / ih;
        let dw = cw, dh = ch, dx = 0, dy = 0;
        if (ir > cr) { dh = ch; dw = dh * ir; dx = (cw - dw) / 2; dy = 0; }
        else { dw = cw; dh = dw / ir; dx = 0; dy = (ch - dh) / 2; }
        ctx.drawImage(bgImage, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = '#0e1320';
        ctx.fillRect(0, 0, CSS_W, CSS_H);
      }

      // sol
      ctx.fillStyle = 'rgba(31,41,55,.85)';
      ctx.fillRect(0, groundY, CSS_W, CSS_H - groundY);

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
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      ctx.font = '20px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(title, 16, 28);
      ctx.font = '16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(String(score), CSS_W - 160, 26);
      ctx.fillText(Math.max(0, DURATION - elapsed).toFixed(1), CSS_W - 80, 26);

      if (DEBUG) {
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(10, 40, 170, 58);
        ctx.fillStyle = '#fff';
        ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
        ctx.fillText(`obs:${obs.length} coins:${coins.length}`, 16, 58);
        ctx.fillText(`noFail:${noFailTimer.toFixed(2)}s`, 16, 74);
        ctx.fillText(`vx:${player.vx.toFixed(1)}`, 16, 90);
      }

      // overlay départ
      if (startCountdown > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(0, 0, CSS_W, CSS_H);
        ctx.fillStyle = '#fff';
        ctx.font = '22px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Prêt ? Appuie pour sauter !', CSS_W / 2, CSS_H / 2);
        ctx.textAlign = 'start';
      }

      // écran fin
      if (!alive) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, 0, CSS_W, CSS_H);
        ctx.fillStyle = '#fff';
        ctx.font = '28px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(finishReason === 'rat' ? 'Aïe !' : 'BRAVO !', CSS_W / 2, CSS_H / 2 - 12);
        ctx.font = '18px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
        ctx.fillText(`Score: ${score}`, CSS_W / 2, CSS_H / 2 + 18);
        ctx.textAlign = 'start';
      }
    }

    // --- Boucle fixe 60 FPS
    const STEP = 1 / 60;
    const MAX_FRAME = 0.10;
    let acc = 0;
    let t0 = performance.now() / 1000;

    function finish(reason: 'rat' | 'time') {
      alive = false;
      finishReason = reason;
      setTimeout(() => onDone({ won: reason === 'time', score, time: Math.min(DURATION, elapsed) }), 650);
    }

    function stepOnce() {
      // timers de protection
      if (startCountdown > 0) startCountdown = Math.max(0, startCountdown - STEP);
      if (noFailTimer > 0)   noFailTimer   = Math.max(0, noFailTimer   - STEP);

      // Entrées fusionnées
      const inputs = readInputs();

      // saut
      if ((inputs.jump || keys.wantJump) && player.grounded && startCountdown <= 0) {
        player.vy = -jumpV;
        player.grounded = false;
      }
      keys.wantJump = false;

      // vertical
      player.vy += gravity * STEP;
      player.y  += player.vy * STEP;
      if (player.y >= groundY - player.h) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
      }

      // horizontal (adouci)
      let ax = 0;
      if (inputs.left)  ax -= accelX;
      if (inputs.right) ax += accelX;

      if (ax === 0) {
        if (player.vx > 0) player.vx = Math.max(0, player.vx - frictionX * STEP);
        if (player.vx < 0) player.vx = Math.min(0, player.vx + frictionX * STEP);
      } else {
        player.vx += ax * STEP;
      }

      if (player.vx >  maxVx) player.vx =  maxVx;
      if (player.vx < -maxVx) player.vx = -maxVx;

      player.x += (player.vx * (slow)) * STEP;

      // limites écran
      if (player.x < 8) { player.x = 8; player.vx = 0; }
      if (player.x > CSS_W - player.w - 8) { player.x = CSS_W - player.w - 8; player.vx = 0; }

      // monde
      if (startCountdown <= 0) {
        for (const o of obs)   o.x += (o.vx * slow) * STEP;
        for (const c of coins) c.x += (c.vx * slow) * STEP;
      }

      // collisions (ignorées tant que noFailTimer > 0)
      if (startCountdown <= 0) {
        for (const o of obs) {
          if (aabb(player, { x: o.x, y: o.y, w: o.w, h: o.h })) {
            if (noFailTimer <= 0 && o.type === 'rat') { finish('rat'); return; }
            if (o.type !== 'rat') {
              slow = 0.6; setTimeout(() => (slow = 1), 600);
              o.x = -9999;
            }
          }
        }
        for (const c of coins) {
          if (rectCircle(player.x, player.y, player.w, player.h, c.x, c.y, c.r)) { score += 1; c.x = -9999; }
        }
      }

      // purge
      while (obs.length && obs[0].x < -100)   obs.shift();
      while (coins.length && coins[0].x < -80) coins.shift();

      trySpawn(STEP);

      // temps réel
      elapsed += STEP;
      if (elapsed >= DURATION) { finish('time'); return; }
    }

    function loop(nowMs: number) {
      const now = nowMs / 1000;
      let dt = now - t0;
      t0 = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;

      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard < 6 && alive) {
        stepOnce();
        acc -= STEP;
        guard++;
      }

      draw();
      if (alive) requestAnimationFrame(loop);
    }

    draw();
    requestAnimationFrame(loop);

    // --- Cleanup
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (cvs.parentElement === host) host.removeChild(cvs);
      cvsRef.current = null;
    };
  // on ne redémarre pas sur moveLeft/moveRight/jumpTick (lus via refs)
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
