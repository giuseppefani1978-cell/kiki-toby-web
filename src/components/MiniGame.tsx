// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';

type Result = { won: boolean; score: number; time: number };

type Props = {
  character: 'kiki' | 'toby';
  title?: string;
  onDone: (res: Result) => void;

  moveLeft?: boolean;
  moveRight?: boolean;
  /** incrémenté à chaque appui Saut (edge trigger) */
  jumpTick?: number;

  /** autoriser le “tap to jump” directement sur le canvas (par défaut true) */
  enableTouchJump?: boolean;
};

// --- gameplay entities
type EnemyKind = 'rat' | 'pigeon';
type Enemy = { x: number; y: number; w: number; h: number; vx: number; kind: EnemyKind; alive: boolean };
type Hazard = { x: number; y: number; w: number; h: number; vx: number; kind: 'poop' };
type CollectibleKind = 'fish' | 'bone';
type Collectible = { x: number; y: number; w: number; h: number; vx: number; kind: CollectibleKind };

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

  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

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
    const host = hostRef.current;
    if (!host) return;

    // Canvas HiDPI
    const rect  = host.getBoundingClientRect();
    const CSS_W = Math.max(240, Math.floor(rect.width));
    const CSS_H = Math.max(200, Math.floor(rect.height));
    const DPR   = Math.max(1, Math.min(3, (window as any).devicePixelRatio || 1));

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

    // Fond(s) image(s)
    const base = import.meta.env.BASE_URL || '/';
    const wantsPantheon = title.toLowerCase().includes('panthéon');
    const bgURL = wantsPantheon ? `${base}img/bg/pantheon.PNG` : '';
    let bgImage: HTMLImageElement | null = null;
    if (bgURL) loadImage(bgURL).then(i => (bgImage = i)).catch(() => (bgImage = null));

    // Tuiles défilantes (PNG en MAJ)
    const tilesToLoad = [
      wantsPantheon ? `${base}img/bg/pantheon.PNG` : `${base}img/bg/street_A.PNG`,
      `${base}img/bg/street_A.PNG`,
      `${base}img/bg/street_B.PNG`,
    ];
    const bgTiles: HTMLImageElement[] = [];
    Promise.all(
      tilesToLoad.map(p => loadImage(p).then(img => { bgTiles.push(img); return img; }).catch(() => null))
    ).catch(() => { /* ignore */ });
    let bgScrollX = 0;

    // --- SPRITES
    // Joueur (.PNG en MAJ)
    const playerURL = `${base}img/sprites/${character}.PNG`;
    // Ennemis / items (.png en min)
    const ratURL       = `${base}img/sprites/rat.png`;
    const pigeonURL    = `${base}img/sprites/pigeon.png`;
    const fishURL      = `${base}img/sprites/fish.png`;
    const boneURL      = `${base}img/sprites/bone.png`;

    let playerSprite: HTMLImageElement | null = null;
    let ratSprite: HTMLImageElement | null = null;
    let pigeonSprite: HTMLImageElement | null = null;
    let fishSprite: HTMLImageElement | null = null;
    let boneSprite: HTMLImageElement | null = null;

    loadImage(playerURL).then(i => (playerSprite = i)).catch(()=>{});
    loadImage(ratURL).then(i => (ratSprite = i)).catch(()=>{});
    loadImage(pigeonURL).then(i => (pigeonSprite = i)).catch(()=>{});
    loadImage(fishURL).then(i => (fishSprite = i)).catch(()=>{});
    loadImage(boneURL).then(i => (boneSprite = i)).catch(()=>{});

    // Constantes gameplay
    const groundY     = Math.floor(CSS_H * 0.80);
    const gravity     = 1500;
    const jumpV       = 540;
    const accelX      = 1200;
    const frictionX   = 900;
    const maxVx       = 220;
    const worldSpeed  = 170;

    const DURATION    = 20;
    const START_DELAY = 0.45;   // plus court
    const MAX_HP      = 3;
    const HIT_IFRAMES = 1.0;

    // Visuel du joueur +20% sans changer la hitbox
    const PLAYER_VIS_SCALE = 1.2;

    // état
    const player = { x: 80, y: groundY - 48, w: 48, h: 48, vx: 0, vy: 0, grounded: true };
    let prevY = player.y;
    const enemies: Enemy[] = [];
    const hazards: Hazard[] = [];
    const items: Collectible[] = [];
    let facing: 1 | -1 = 1;

    let score = 0;
    let elapsed = 0;
    let alive = true;
    let slow = 1;
    let startCountdown = START_DELAY;
    let invuln = START_DELAY;
    let hp = MAX_HP;
    let finishReason: 'rat' | 'time' | null = null;

    // Clavier
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

    // Tap-to-jump
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
      if (spawnAcc < 0.6) return; // spawn plus tôt
      spawnAcc = 0;

      // --- SPAWN RATES (faciles à ajuster)
      // 0.45 rat, 0.20 pigeon, 0.15 poop, 0.20 item
      const r = Math.random();
      if (r < 0.45) {
        const w = 32, h = 24, x = CSS_W + 40, y = groundY - h;
        if (x > safeSpawnX() + 40) enemies.push({ x, y, w, h, vx: -(worldSpeed + rnd(10, 50)), kind: 'rat', alive: true });
      } else if (r < 0.65) {
        const w = 34, h = 22, x = CSS_W + 40, y = groundY - rnd(120, 180);
        if (x > safeSpawnX() + 40) enemies.push({ x, y, w, h, vx: -(worldSpeed + rnd(30, 70)), kind: 'pigeon', alive: true });
      } else if (r < 0.80) {
        const w = 18, h = 10, x = CSS_W + 40, y = groundY - h;
        if (x > safeSpawnX() + 40) hazards.push({ x, y, w, h, vx: -(worldSpeed + rnd(0, 30)), kind: 'poop' });
      } else {
        const kind: CollectibleKind = Math.random() < 0.5 ? 'fish' : 'bone';
        const w = 22, h = 22, x = CSS_W + 40, y = groundY - rnd(60, 140);
        if (x > safeSpawnX() + 40) items.push({ x, y, w, h, vx: -(worldSpeed + rnd(10, 60)), kind });
      }

      if (enemies.length > 16) enemies.splice(0, enemies.length - 16);
      if (hazards.length > 8)  hazards.splice(0, hazards.length - 8);
      if (items.length > 12)   items.splice(0, items.length - 12);
    }

    // Collisions
    const aabb = (a:{x:number;y:number;w:number;h:number}, b:{x:number;y:number;w:number;h:number}) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    // Fond défilant
    function drawScrollingBackground() {
      const h = groundY;
      const y = 0;
      if (!bgTiles.length) {
        if (bgImage) {
          const cw = CSS_W, ch = h;
          const iw = bgImage.width, ih = bgImage.height;
          const cr = cw / ch, ir = iw / ih;
          let dw = cw, dh = ch, dx = 0, dy = 0;
          if (ir > cr) { dh = ch; dw = dh * ir; dx = (cw - dw) / 2; }
          else { dw = cw; dh = dw / ir; dy = (ch - dh) / 2; }
          ctx.drawImage(bgImage, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = '#0e1320';
          ctx.fillRect(0, 0, CSS_W, h);
        }
        return;
      }
      const factor = 0.6;
      const tileH = h;
      const drawTile = (img: HTMLImageElement, dx: number) => {
        const s = tileH / img.height;
        const dw = Math.ceil(img.width * s);
        ctx.drawImage(img, dx, y, dw, tileH);
        return dw;
      };
      const off = (bgScrollX * factor) % CSS_W;
      let x = -off - CSS_W;
      let drawn = 0;
      while (x < CSS_W + CSS_W && drawn < 12) {
        const idx = Math.floor((bgScrollX * factor) / CSS_W) + drawn;
        let img: HTMLImageElement;
        if (wantsPantheon && idx < 3 && bgTiles[0]) {
          img = bgTiles[0];
        } else {
          const alt = (idx - 3) % 2;
          img = bgTiles[1 + (alt === 0 ? 0 : 1)] || bgTiles[1] || bgTiles[0];
        }
        const dw = drawTile(img, x);
        x += dw;
        drawn++;
      }
    }

    // Dessin du joueur (sprite + flip + ombre). Hitbox inchangée.
    function drawPlayer() {
      // ombre
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.beginPath();
      ctx.ellipse(player.x + player.w/2, groundY + 6, player.w*0.45, 6, 0, 0, Math.PI*2);
      ctx.fill();

      // invuln léger
      const prevAlpha = ctx.globalAlpha;
      if (invuln > 0) {
        const blink = (Math.floor(performance.now()/100) % 2) ? 0.55 : 1.0;
        ctx.globalAlpha = blink;
      }

      const visW = Math.round(player.w * PLAYER_VIS_SCALE);
      const visH = Math.round(player.h * PLAYER_VIS_SCALE);
      const visX = Math.round(player.x + (player.w - visW) / 2);
      const visY = Math.round(player.y + (player.h - visH));

      if (playerSprite) {
        const prevSmooth = (ctx as any).imageSmoothingEnabled;
        (ctx as any).imageSmoothingEnabled = false;

        ctx.save();
        if (facing === -1) {
          ctx.translate(visX + visW, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(playerSprite, 0, visY, visW, visH);
        } else {
          ctx.drawImage(playerSprite, visX, visY, visW, visH);
        }
        ctx.restore();

        (ctx as any).imageSmoothingEnabled = prevSmooth;
      } else {
        // fallback rectangle
        const bodyColor = character === 'kiki' ? '#FFB84D' : '#5E93FF';
        ctx.fillStyle = bodyColor;
        ctx.fillRect(visX, visY, visW, visH);
      }

      ctx.globalAlpha = prevAlpha;
    }

    // Dessin des ennemis / hazards / collectibles
    function drawEnemy(e: Enemy) {
      if (!e.alive) return;
      if (e.kind === 'rat' && ratSprite) {
        (ctx as any).imageSmoothingEnabled = false;
        ctx.drawImage(ratSprite, Math.round(e.x), Math.round(e.y), e.w, e.h);
      } else if (e.kind === 'pigeon' && pigeonSprite) {
        (ctx as any).imageSmoothingEnabled = false;
        const bob = Math.sin(performance.now()/200 + e.x*0.05) * 2;
        ctx.drawImage(pigeonSprite, Math.round(e.x), Math.round(e.y + bob), e.w, e.h);
      } else {
        ctx.fillStyle = e.kind === 'rat' ? '#ef4444' : '#93c5fd';
        ctx.fillRect(e.x, e.y, e.w, e.h);
      }
    }
    function drawHazard(h: Hazard) {
      ctx.fillStyle = '#bdbdbd';
      ctx.fillRect(h.x, h.y, h.w, h.h);
    }
    function drawItem(it: Collectible) {
      (ctx as any).imageSmoothingEnabled = false;
      const cx = Math.round(it.x);
      const cy = Math.round(it.y);
      if (it.kind === 'fish' && fishSprite) {
        ctx.drawImage(fishSprite, cx, cy, it.w, it.h);
      } else if (it.kind === 'bone' && boneSprite) {
        ctx.drawImage(boneSprite, cx, cy, it.w, it.h);
      } else {
        ctx.fillStyle = it.kind === 'fish' ? '#ffda6a' : '#e5e7eb';
        ctx.beginPath(); ctx.arc(cx + it.w/2, cy + it.h/2, Math.min(it.w,it.h)/2, 0, Math.PI*2); ctx.fill();
      }
    }

    // Rendu
    function draw() {
      drawScrollingBackground();

      // sol
      ctx.fillStyle = 'rgba(31,41,55,.85)';
      ctx.fillRect(0, groundY, CSS_W, CSS_H - groundY);

      // entités
      for (const e of enemies) drawEnemy(e);
      for (const h of hazards) drawHazard(h);
      for (const it of items) drawItem(it);

      // joueur
      drawPlayer();

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      ctx.font = '20px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(title, 16, 28);
      ctx.font = '16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText(String(score), CSS_W - 160, 26);
      ctx.fillText(Math.max(0, DURATION - elapsed).toFixed(1), CSS_W - 80, 26);

      ctx.font = '18px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
      ctx.fillText('❤'.repeat(hp), 16, 52);

      // overlays
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
      // timers invuln / start
      if (startCountdown > 0) startCountdown = Math.max(0, startCountdown - STEP);
      if (invulnBumpRef.current > 0) { invuln += invulnBumpRef.current; invulnBumpRef.current = 0; }
      if (invuln > 0) invuln = Math.max(0, invuln - STEP);

      const left  = controlsRef.current.left  || keys.left;
      const right = controlsRef.current.right || keys.right;

      // saut
      if (wantJumpRef.current && player.grounded) {
        player.vy = -jumpV;
        player.grounded = false;
      }
      wantJumpRef.current = false;

      // vertical
      prevY = player.y;
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

      // orientation sprite
      if (player.vx >  10) facing = 1;
      if (player.vx < -10) facing = -1;

      // limites
      if (player.x < 8) { player.x = 8; player.vx = 0; }
      if (player.x > CSS_W - player.w - 8) { player.x = CSS_W - player.w - 8; player.vx = 0; }

      // fond
      bgScrollX += (worldSpeed * slow) * STEP;

      // monde
      for (const e of enemies) e.x += e.vx * STEP;
      for (const h of hazards) h.x += h.vx * STEP;
      for (const it of items) it.x += it.vx * STEP;

      // collisions
      if (startCountdown === 0) {
        // Ennemis (stomp)
        for (const e of enemies) {
          if (!e.alive) continue;
          if (aabb(player, e)) {
            const falling = player.vy > 0;
            const wasAbove = (prevY + player.h) <= (e.y + 6); // marge tolérante
            if (falling && wasAbove) {
              // STOMP ✅
              e.alive = false;
              score += 2;
              player.vy = -jumpV * 0.55; // petit rebond
              // petit boost d’invuln contre un enchaînement immédiat
              invulnBumpRef.current = Math.max(invulnBumpRef.current, 0.15);
            } else if (invuln === 0) {
              // DÉGÂTS
              hp -= 1;
              invuln = HIT_IFRAMES;
              player.vx = -120; // knockback léger
              if (hp <= 0) { finish('rat'); return; }
            }
          }
        }

        // Hazards (poop → ralentit)
        for (const h of hazards) {
          if (aabb(player, h)) {
            slow = 0.55; setTimeout(() => (slow = 1), 650);
            h.x = -9999;
          }
        }
      }

      // Collectibles
      for (const it of items) {
        const overlap =
          player.x < it.x + it.w && player.x + player.w > it.x &&
          player.y < it.y + it.h && player.y + player.h > it.y;
        if (overlap) {
          const matched = (character === 'kiki' && it.kind === 'fish') || (character === 'toby' && it.kind === 'bone');
          score += matched ? 2 : 1; // bonus si “goût” assorti
          it.x = -9999;
        }
      }

      // purge off-screen / morts
      while (enemies.length && (enemies[0].x < -100 || !enemies[0].alive)) enemies.shift();
      while (hazards.length && hazards[0].x < -100) hazards.shift();
      while (items.length && items[0].x < -80) items.shift();

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

      acc += dt * slow;
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

    // cleanup
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cvs.removeEventListener('pointerdown', onPointer);
      if (cvs.parentElement === host) host.removeChild(cvs);
      cvsRef.current = null;
    };
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
