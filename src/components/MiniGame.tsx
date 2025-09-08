// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';

type Result = { won: boolean; score: number; time: number };

type Props = {
  character: 'kiki' | 'toby';
  title?: string;
  onDone: (res: Result) => void;

  // commandes externes (depuis l’overlay)
  moveLeft?: boolean;
  moveRight?: boolean;
  /** incrémenté à chaque appui Saut (edge trigger) */
  jumpTick?: number;

  /** autoriser le “tap to jump” directement sur le canvas (par défaut true) */
  enableTouchJump?: boolean;
};

type Obstacle    = { x: number; y: number; w: number; h: number; vx: number; type: 'rat' | 'poop' };
type Collectible = { x: number; y: number; r: number; vx: number };

// ---- utils
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
  enableTouchJump = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cvsRef  = useRef<HTMLCanvasElement | null>(null);

  // garder la dernière version de onDone sans relancer l’effet principal
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // commandes externes visibles dans la boucle
  const controlsRef   = useRef({ left: !!moveLeft, right: !!moveRight, jumpTick: jumpTick ?? 0 });
  const wantJumpRef   = useRef(false);
  const invulnBumpRef = useRef(0);

  useEffect(() => {
    controlsRef.current.left  = !!moveLeft;
    controlsRef.current.right = !!moveRight;
    const jt = jumpTick ?? 0;
    if (jt !== controlsRef.current.jumpTick) {
      controlsRef.current.jumpTick = jt;
      wantJumpRef.current = true;
      invulnBumpRef.current = Math.max(invulnBumpRef.current, 0.35);
    }
  }, [moveLeft, moveRight, jumpTick]);

  useEffect(() => {
    // ---------- run once ----------
    const host = hostRef.current;
    if (!host) return;

    // Canvas HiDPI
    const rect  = host.getBoundingClientRect();
    const CSS_W = Math.max(240, Math.floor(rect.width));
    const CSS_H = Math.max(200, Math.floor(rect.height));
    const DPR   = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

    const cvs = document.createElement('canvas');
    cvsRef.current = cvs;
    cvs.width  = Math.floor(CSS_W * DPR);
    cvs.height = Math.floor(CSS_H * DPR);
    Object.assign(cvs.style, {
      display: 'block',
      width:  `${CSS_W}px`,
      height: `${CSS_H}px`,
      position: 'absolute',
      inset: '0',
      touchAction: 'none',
      background: '#0b0d10',
    } as CSSStyleDeclaration);
    host.appendChild(cvs);

    const ctx = cvs.getContext('2d');
    if (!ctx) { host.textContent = 'Canvas non supporté'; return; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    (ctx as any).imageSmoothingEnabled = true;

    // Fond image (Panthéon si demandé)
    const base = import.meta.env.BASE_URL || '/';
    const wantsPantheon = title.toLowerCase().includes('panthéon');
    const bgURL = wantsPantheon ? `${base}img/bg/pantheon.PNG` : '';
    let bgImage: HTMLImageElement | null = null;
    if (bgURL) loadImage(bgURL).then(i => (bgImage = i)).catch(() => (bgImage = null));

    // Constantes gameplay
    const groundY     = Math.floor(CSS_H * 0.80);
    const gravity     = 1500;
    const jumpV       = 540;
    const accelX      = 1200;
    const frictionX   = 900;
    const maxVx       = 220;
    const worldSpeed  = 170;
    const DURATION    = 20;      // durée du run (en s)
    const START_DELAY = 0.8;     // protection départ
    const MAX_HP      = 3;       // ❤❤❤
    const HIT_IFRAMES = 1.0;     // invulnérabilité après un coup (s)

    const bodyColor = character === 'kiki' ? '#FFB84D' : '#5E93FF';

    // État
    const player = { x: 80, y: groundY - 36, w: 36, h: 36, vx: 0, vy: 0, grounded: true };
    const obs: Obstacle[] = [];
    const coins: Collectible[] = [];

    let score = 0;
    let elapsed = 0;
    let alive = true;
    let slow = 1;
    let startCountdown = START_DELAY;
    let invuln = START_DELAY; // invuln au départ
    let hp = MAX_HP;
    let finishReason: 'rat' | 'time' | null = null;

    // Clavier (desktop)
    const keys = { left: false, right: false };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft')  keys.left = true;
      if (e.code === 'ArrowRight') keys.right = true;
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        wantJumpRef.current = true;
        invulnBumpRef.current = Math.max(invulnBumpRef.current, 0.35);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft')  keys.left = false;
      if (e.code === 'ArrowRight') keys.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Tap-to-jump optionnel
    const onPointer = (e: PointerEvent) => {
      if (!enableTouchJump) return;
      e.preventDefault();
      wantJumpRef.current = true;
      invulnBumpRef.current = Math.max(invulnBumpRef.current, 0.35);
    };
    cvs.addEventListener('pointerdown', onPointer, { passive: false });

    // Spawns
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
        const w = 28, h = 22, x = CSS_W + 40, y = groundY - h;
        if (x > safeSpawnX() + 40) obs.push({ x, y, w, h, vx: -(worldSpeed + rnd(10, 50)), type: 'rat' });
      } else if (r < 0.70) {
        const w = 18, h = 10, x = CSS_W + 40, y = groundY - h;
        if (x > safeSpawnX() + 40) obs.push({ x, y, w, h, vx: -(worldSpeed + rnd(0, 30)), type: 'poop' });
      } else {
        const r2 = 8, x = CSS_W + 40, y = groundY - rnd(60, 140);
        if (x > safeSpawnX() + 40) coins.push({ x, y, r: r2, vx: -(worldSpeed + rnd(10, 60)) });
      }

      if (obs.length > 12)   obs.splice(0, obs.length - 12);
      if (coins.length > 10) coins.splice(0, coins.length - 10);
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
    function draw() {
      // fond
      if (bgImage) {
        const cw = CSS_W, ch = CSS_H;
        const iw = bgImage.width, ih = bgImage.height;
        const cr = cw / ch, ir = iw / ih;
        let dw = cw, dh = ch, dx = 0, dy = 0;
        if (ir > cr) { dh = ch; dw = dh * ir; dx = (cw - dw) / 2; }
        else { dw = cw; dh = dw / ir; dy = (ch - dh) / 2; }
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

      // joueur (petit clignotement si invuln)
      if (invuln === 0 || Math.floor(performance.now() / 100) % 2 === 0) {
        ctx.fillStyle = bodyColor;
        ctx.fillRect(player.x, player.y, player.w, player.h);
        ctx.fillStyle = '#0b0b0b';
        ctx.fillRect(player.x + 10, player.y + 10, 8, 8);
      }

      // HUD (titre, score, timer)
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      ctx.font = '20px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(title, 16, 28);
      ctx.font = '16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(String(score), CSS_W - 160, 26);
      ctx.fillText(Math.max(0, DURATION - elapsed).toFixed(1), CSS_W - 80, 26);

      // PV (cœurs)
      ctx.font = '18px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText('❤'.repeat(hp), 16, 52);

      // messages
      if (startCountdown > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, CSS_W, CSS_H);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.font = '22px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
        ctx.fillText('Prêt ? Appuie pour sauter !', CSS_W / 2, CSS_H / 2);
        ctx.textAlign = 'start';
      }
      if (!alive) {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, CSS_W, CSS_H);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.font = '28px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
        ctx.fillText(finishReason === 'rat' ? 'Aïe !' : 'BRAVO !', CSS_W / 2, CSS_H / 2 - 12);
        ctx.font = '18px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
        ctx.fillText(`Score: ${score}`, CSS_W / 2, CSS_H / 2 + 18);
        ctx.textAlign = 'start';
      }
    }

    // Boucle fixe
    const STEP = 1 / 60;
    const MAX_FRAME = 0.10;
    let acc = 0;
    let t0 = performance.now() / 1000;

    function finish(reason: 'rat' | 'time') {
      if (!alive) return;
      alive = false;
      finishReason = reason;
      setTimeout(() => onDoneRef.current({ won: reason === 'time', score, time: Math.min(DURATION, elapsed) }), 650);
    }

    function stepOnce() {
      if (startCountdown > 0) startCountdown = Math.max(0, startCountdown - STEP);
      if (invulnBumpRef.current > 0) { invuln += invulnBumpRef.current; invulnBumpRef.current = 0; }
      if (invuln > 0) invuln = Math.max(0, invuln - STEP);

      const left  = controlsRef.current.left  || keys.left;
      const right = controlsRef.current.right || keys.right;

      // saut (edge)
      if (wantJumpRef.current && player.grounded) {
        player.vy = -jumpV;
        player.grounded = false;
      }
      wantJumpRef.current = false;

      // vertical
      player.vy += gravity * STEP;
      player.y  += player.vy * STEP;
      if (player.y >= groundY - player.h) {
        player.y = groundY - player.h;
        player.vy = 0;
        player.grounded = true;
      }

      // horizontal
      let ax = 0;
      if (left)  ax -= accelX;
      if (right) ax += accelX;
      if (ax === 0) {
        if (player.vx > 0) player.vx = Math.max(0, player.vx - frictionX * STEP);
        if (player.vx < 0) player.vx = Math.min(0, player.vx + frictionX * STEP);
      } else {
        player.vx += ax * STEP;
      }
      if (player.vx >  maxVx) player.vx =  maxVx;
      if (player.vx < -maxVx) player.vx = -maxVx;
      player.x += player.vx * STEP;

      // limites
      if (player.x < 8) { player.x = 8; player.vx = 0; }
      if (player.x > CSS_W - player.w - 8) { player.x = CSS_W - player.w - 8; player.vx = 0; }

      // monde (défilement simple)
      for (const o of obs)   o.x += o.vx * STEP;
      for (const c of coins) c.x += c.vx * STEP;

      // collisions
      if (startCountdown === 0) {
        for (const o of obs) {
          if (aabb(player, { x: o.x, y: o.y, w: o.w, h: o.h })) {
            if (o.type === 'rat') {
              // touche un rat → on perd 1 PV, i-frames, knockback léger
              if (invuln === 0) {
                hp -= 1;
                invuln = HIT_IFRAMES;
                player.vx = -120; // petit recul
                if (hp <= 0) { finish('rat'); return; }
              }
            } else {
              // caca → on ralentit un peu mais on ne perd pas de PV
              slow = 0.55; setTimeout(() => (slow = 1), 650);
              o.x = -9999;
            }
          }
        }
      }
      for (const c of coins) {
        if (rectCircle(player.x, player.y, player.w, player.h, c.x, c.y, c.r)) { score += 1; c.x = -9999; }
      }

      // purge
      while (obs.length && obs[0].x < -100)   obs.shift();
      while (coins.length && coins[0].x < -80) coins.shift();

      // spawns
      trySpawn(STEP);

      // temps
      elapsed += STEP;
      if (elapsed >= DURATION) { finish('time'); return; }
    }

    function loop(nowMs: number) {
      const now = nowMs / 1000;
      let dt = now - t0;
      t0 = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;

      acc += dt * slow; // “caca” ralentit légèrement la boucle de jeu
      let guard = 0;
      while (acc >= STEP && guard < 6 && alive) {
        stepOnce();
        acc -= STEP;
        guard++;
      }

      draw();
      if (alive) requestAnimationFrame(loop);
    }

    // start
    draw();
    requestAnimationFrame(loop);

    // cleanup
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cvs.removeEventListener('pointerdown', onPointer);
      if (cvs.parentElement === host) host.removeChild(cvs);
      cvsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

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
