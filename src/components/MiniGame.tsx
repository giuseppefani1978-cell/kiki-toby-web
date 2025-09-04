// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';
import kaboom, {
  KaboomCtx, Vec2,
} from 'kaboom';

type Props = {
  character: 'kiki' | 'toby';
  title?: string;                // ex: "Panthéon"
  onDone: (res: { won: boolean; score: number; time: number }) => void;
};

export default function MiniGame({ character, title = 'Paris Run', onDone }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const kRef = useRef<KaboomCtx | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    // Taille
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Init kaboom dans le conteneur
    const k = kaboom({
      global: false,
      root: hostRef.current,
      width: w,
      height: h,
      background: [240, 244, 247],
      touchToMouse: true,
      canvas: undefined,       // kaboom crée son <canvas>
      letterbox: true,
      pixelDensity: 1,
    });
    kRef.current = k;

    // --- Aliases utiles
    const { add, pos, rect, color, area, body, outline, anchor, z, text, vec2, time, dt, rand, onClick, onKeyPress, onUpdate, destroy, wait } = k;

    // --- HUD titre
    add([
      text(title, { size: 20 }),
      pos(16, 16),
      z(100),
      color(20, 24, 32),
    ]);

    // --- Score & chrono
    let score = 0;
    const duration = 45; // secondes pour gagner
    const start = time();
    const timerLabel = add([
      text('45.0', { size: 16 }),
      pos(w - 80, 16),
      z(100),
      color(20,24,32),
    ]);

    const scoreLabel = add([
      text('0', { size: 16 }),
      pos(w - 160, 16),
      z(100),
      color(20,24,32),
    ]);

    function updateHUD() {
      const t = Math.max(0, duration - (time() - start));
      timerLabel.text = t.toFixed(1);
      scoreLabel.text = String(score);
    }

    // --- Sol & décor
    const groundY = Math.floor(h * 0.8);
    // sol
    add([
      rect(w, h - groundY),
      pos(0, groundY),
      color(220, 224, 228),
      anchor('topleft'),
      z(1),
      area(),
      body({ isStatic: true }),
      outline(2, k.rgb(190, 194, 198)),
    ]);

    // arrière-plan simple (bâtiments stylisés)
    for (let i = 0; i < 6; i++) {
      const bw = rand(60, 120);
      const bh = rand(60, 180);
      const bx = i * (w / 6) + rand(-20, 20);
      add([
        rect(bw, bh),
        pos(bx, groundY - bh - 40),
        color(210, 214, 220),
        anchor('topleft'),
        z(0),
      ]);
    }

    // --- Joueur
    const isKiki = character === 'kiki';
    const player = add([
      rect(36, 36),
      pos(80, groundY - 36),
      color(isKiki ? k.rgb(255, 184, 77) : k.rgb(94, 147, 255)), // orange vs bleu
      outline(4, k.rgb(20, 24, 32)),
      area(),
      body(),
      z(10),
      anchor('topleft'),
      { speed: 240, jump: 560, slow: 0 },
    ]);

    // “visage”
    add([
      rect(8, 8),
      pos(() => player.pos.add(vec2(10, 10))),
      color(20,24,32),
      anchor('topleft'),
      z(12),
    ]);

    // Tap / Space pour sauter
    const doJump = () => {
      if (player.isGrounded()) {
        player.jump(player.jump);
      }
    };
    onClick(doJump);
    onKeyPress('space', doJump);
    onKeyPress('up', doJump);

    // --- Générateurs d’obstacles & collectibles
    const scrollSpeedBase = 260; // vitesse du monde
    function spawnRat() {
      const y = groundY - 22;
      const r = add([
        rect(28, 22),
        pos(w + 40, y),
        color(80, 80, 80),
        outline(2, k.rgb(20, 24, 32)),
        area(),
        z(5),
        'rat',
        { vx: - (scrollSpeedBase + rand(20, 80)) },
      ]);
      r.onUpdate(() => {
        r.move(r.vx, 0);
        if (r.pos.x < -60) destroy(r);
      });
    }

    function spawnPigeonPoop() {
      const y = groundY - 10;
      const p = add([
        rect(18, 10),
        pos(w + 40, y),
        color(180, 180, 180),
        outline(2, k.rgb(20, 24, 32)),
        area(),
        z(4),
        'poop',
        { vx: - (scrollSpeedBase + rand(0, 50)) },
      ]);
      p.onUpdate(() => {
        p.move(p.vx, 0);
        if (p.pos.x < -40) destroy(p);
      });
    }

    function spawnCollectible() {
      const y = groundY - rand(60, 140);
      const c = add([
        rect(16, 16),
        pos(w + 40, y),
        color(isKiki ? k.rgb(255, 149, 0) : k.rgb(0, 122, 255)),
        outline(2, k.rgb(20, 24, 32)),
        area(),
        z(6),
        'collect',
        { vx: - (scrollSpeedBase + rand(30, 90)) },
      ]);
      c.onUpdate(() => {
        c.move(c.vx, 0);
        if (c.pos.x < -40) destroy(c);
      });
    }

    // boucle de spawn
    let alive = true;
    const mainLoop = k.loop(0.9, () => {
      if (!alive) return;
      const roll = rand(0, 1);
      if (roll < 0.45) spawnRat();
      else if (roll < 0.75) spawnPigeonPoop();
      else spawnCollectible();
    });

    // collisions
    player.onCollide('rat', () => {
      if (!alive) return;
      alive = false;
      // petit effet
      player.color = k.rgb(200, 0, 0);
      wait(0.3, () => finish(false));
    });

    player.onCollide('poop', (p) => {
      // ralentit brièvement
      player.slow = 0.8;
      p.destroy();
      wait(0.8, () => (player.slow = 0));
    });

    player.onCollide('collect', (c) => {
      score += 1;
      c.destroy();
    });

    // Scroll du monde
    onUpdate(() => {
      updateHUD();
      // Win condition
      if (alive && time() - start >= duration) {
        alive = false;
        return finish(true);
      }
      // “parallaxe” légère : arrière-plan qui glisse
      // (ici minimal, décor statique — tu peux animer si tu veux)
    });

    // léger auto-move pour le ressenti (surtout si on ajoute de vrais niveaux plus tard)
    // ici on ne bouge pas le player, c’est le monde qui vient à lui (les vx négatifs)
    // mais si tu veux le déplacer :
    // player.move((scrollSpeedBase * 0.2) * (player.slow ? 0.4 : 1), 0);

    // fin de partie
    function finish(won: boolean) {
      mainLoop.cancel();
      // écran résultat
      const bg = add([
        rect(w, h),
        pos(0, 0),
        color(0, 0, 0),
        z(200),
        { a: 0.0 },
      ]);
      // fade in
      const fade = k.tween(0, 0.6, 0.4, (v) => { bg.color = k.color(0, 0, 0); (bg as any).a = v; });

      add([
        text(won ? 'BRAVO !' : 'Aïe !', { size: 28 }),
        pos(w / 2, h / 2 - 40),
        anchor('center'),
        color(255, 255, 255),
        z(201),
      ]);

      add([
        text(`Score: ${score}`, { size: 20 }),
        pos(w / 2, h / 2),
        anchor('center'),
        color(255, 255, 255),
        z(201),
      ]);

      wait(0.8, () => {
        onDone({ won, score, time: Math.min(duration, time() - start) });
      });
    }

    // cleanup
    return () => {
      try { kRef.current?.destroy(); } catch {}
      kRef.current = null;
    };
  }, [character, title, onDone]);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000', // le canvas remplit ensuite
      }}
    />
  );
}
