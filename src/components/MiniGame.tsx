// src/components/MiniGame.tsx
import React, { useEffect, useRef } from 'react';
import kaboom, { KaboomCtx } from 'kaboom';

type Props = {
  character: 'kiki' | 'toby';
  title?: string;
  onDone: (res: { won: boolean; score: number; time: number }) => void;
};

export default function MiniGame({ character, title = 'Paris Run', onDone }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const kRef = useRef<KaboomCtx | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Nettoyage d’un éventuel contexte précédent
    try { kRef.current?.destroy(); } catch {}
    kRef.current = null;

    // Taille réelle du conteneur (évite le conflit avec la fonction rect() de Kaboom)
    const bounds = host.getBoundingClientRect();
    const W = Math.max(240, Math.floor(bounds.width));
    const H = Math.max(200, Math.floor(bounds.height));

    // helper pour afficher un message dans le conteneur en cas d’échec
    const showHostMessage = (msg: string) => {
      host.innerHTML = `<div style="color:#fff;padding:12px;text-align:center;">${msg}</div>`;
      host.style.background = '#222';
    };

    console.log('[MiniGame] init…', { W, H });

    let k: KaboomCtx | null = null;

    try {
      k = kaboom({
        global: false,
        root: host,
        width: W,
        height: H,
        background: [240, 244, 247],
        touchToMouse: true,
        letterbox: true,
        pixelDensity: 1,
      });
    } catch (e) {
      console.error('[MiniGame] kaboom() failed', e);
      showHostMessage("⚠️ Impossible d'initialiser le moteur (Kaboom).");
      return;
    }

    // Sanity check : le canvas a-t-il bien été inséré ?
    const canvas = host.querySelector('canvas');
    if (!canvas) {
      console.error('[MiniGame] no canvas found inside host after init');
      showHostMessage("⚠️ Le canvas du jeu n'a pas pu être créé.");
      try { k?.destroy(); } catch {}
      return;
    }

    kRef.current = k;

    // ───────────────── Smoke-test : un petit carré qui glisse ─────────────────
    // S’il n’apparaît pas, c’est que Kaboom ne tourne pas (erreur ailleurs).
    const { add, pos, rect, color, onUpdate, vec2, time, text, z, rgb,
            area, body, outline, anchor, rand, onClick, onKeyPress, destroy, wait } = k;

    const probe = add([
      rect(30, 30),
      pos(10, 10),
      color(255, 0, 0),
      'probe',
    ]);

    let dir = 1;
    onUpdate(() => {
      probe.move(120 * dir, 0);
      if (probe.pos.x < 10) dir = 1;
      if (probe.pos.x > W - 40) dir = -1;
    });

    // Si on arrive ici et que tu vois le carré rouge bouger => Kaboom est OK.
    console.log('[MiniGame] smoke-test OK, building scene…');

    // ───────────────── HUD ─────────────────
    add([text(title, { size: 20 }), pos(16, 16), z(100), color(20, 24, 32)]);
    let score = 0;
    const duration = 20;
    const start = time();
    const timerLabel = add([text(String(duration.toFixed(1)), { size: 16 }), pos(W - 80, 16), z(100), color(20,24,32)]);
    const scoreLabel = add([text('0', { size: 16 }), pos(W - 160, 16), z(100), color(20,24,32)]);
    const updateHUD = () => {
      const t = Math.max(0, duration - (time() - start));
      (timerLabel as any).text = t.toFixed(1);
      (scoreLabel as any).text = String(score);
    };

    // ───────────────── Sol & décor ─────────────────
    const groundY = Math.floor(H * 0.8);
    add([rect(W, H - groundY), pos(0, groundY), color(220,224,228), anchor('topleft'), z(1), area(), body({ isStatic: true }), outline(2, rgb(190,194,198))]);
    for (let i = 0; i < 6; i++) {
      const bw = rand(60, 120), bh = rand(60, 180), bx = i * (W / 6) + rand(-20, 20);
      add([rect(bw, bh), pos(bx, groundY - bh - 40), color(210,214,220), anchor('topleft'), z(0)]);
    }

    // ───────────────── Joueur ─────────────────
    const isKiki = character === 'kiki';
    const player = add([
      rect(36, 36),
      pos(80, groundY - 36),
      color(isKiki ? rgb(255,184,77) : rgb(94,147,255)),
      outline(4, rgb(20,24,32)),
      area(),
      body(),
      z(10),
      anchor('topleft'),
      { speed: 240, jump: 560, slow: 0 },
    ]);

    add([rect(8, 8), pos(() => (player as any).pos.add(vec2(10, 10))), color(20,24,32), anchor('topleft'), z(12)]);

    const doJump = () => { if ((player as any).isGrounded()) (player as any).jump((player as any).jump); };
    onClick(doJump);
    onKeyPress('space', doJump);
    onKeyPress('up', doJump);

    // ───────────────── Obstacles / bonus ─────────────────
    const scrollSpeedBase = 260;
    function spawnRat() {
      const y = groundY - 22;
      const r = add([rect(28,22), pos(W + 40, y), color(80,80,80), outline(2, rgb(20,24,32)), area(), z(5), 'rat', { vx: -(scrollSpeedBase + rand(20, 80)) }]);
      (r as any).onUpdate(() => { (r as any).move((r as any).vx, 0); if ((r as any).pos.x < -60) destroy(r); });
    }
    function spawnPigeonPoop() {
      const y = groundY - 10;
      const p = add([rect(18,10), pos(W + 40, y), color(180,180,180), outline(2, rgb(20,24,32)), area(), z(4), 'poop', { vx: -(scrollSpeedBase + rand(0, 50)) }]);
      (p as any).onUpdate(() => { (p as any).move((p as any).vx, 0); if ((p as any).pos.x < -40) destroy(p); });
    }
    function spawnCollectible() {
      const y = groundY - rand(60, 140);
      const c = add([rect(16,16), pos(W + 40, y), color(isKiki ? rgb(255,149,0) : rgb(0,122,255)), outline(2, rgb(20,24,32)), area(), z(6), 'collect', { vx: -(scrollSpeedBase + rand(30, 90)) }]);
      (c as any).onUpdate(() => { (c as any).move((c as any).vx, 0); if ((c as any).pos.x < -40) destroy(c); });
    }

    let alive = true;
    const loop = k.loop(0.9, () => {
      if (!alive) return;
      const roll = rand(0, 1);
      if (roll < 0.45) spawnRat();
      else if (roll < 0.75) spawnPigeonPoop();
      else spawnCollectible();
    });

    (player as any).onCollide('rat', () => { if (!alive) return; alive = false; (player as any).color = rgb(200,0,0); wait(0.3, () => finish(false)); });
    (player as any).onCollide('poop', (p: any) => { (player as any).slow = 0.8; p.destroy(); wait(0.8, () => ((player as any).slow = 0)); });
    (player as any).onCollide('collect', (c: any) => { score += 1; c.destroy(); });

    onUpdate(() => {
      updateHUD();
      if (alive && time() - start >= duration) { alive = false; finish(true); }
    });

    function finish(won: boolean) {
      loop.cancel();
      add([text(won ? 'BRAVO !' : 'Aïe !', { size: 28 }), pos(W/2, H/2 - 20), anchor('center'), color(0,0,0), z(201)]);
      add([text(`Score: ${score}`, { size: 20 }), pos(W/2, H/2 + 12), anchor('center'), color(0,0,0), z(201)]);
      wait(0.8, () => onDone({ won, score, time: Math.min(duration, time() - start) }));
    }

    // Cleanup
    return () => {
      try { kRef.current?.destroy(); } catch {}
      kRef.current = null;
    };
  }, [character, title, onDone]);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        maxWidth: 680,
        aspectRatio: '4 / 3',
        background: '#0b0d10',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    />
  );
}
