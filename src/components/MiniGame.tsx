import React, { useEffect, useRef, useState } from "react";

/**
 * Mini runner très simple en Kaboom.
 * - A: taper ou espace pour sauter
 * - Gagne au bout de 20s, perd à la première collision
 * - Nettoyage propre au démontage
 */
type Props = {
  character: "kiki" | "toby";
  onEnd: (res: { won: boolean; score: number }) => void;
};

export default function MiniGame({ character, onEnd }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    let disposed = false;
    let kaboomCtx: any;

    (async () => {
      try {
        // import dynamique pour éviter les soucis de build si kaboom change
        const mod = await import("kaboom");
        const kaboom = (mod as any).default || (mod as any);

        // crée un canvas dans le conteneur
        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        hostRef.current!.appendChild(canvas);

        kaboomCtx = kaboom({
          canvas,
          global: false,
          background: [10, 12, 16],
          touchToMouse: true,
          debug: false,
          // tailwind / pixel scaling pas nécessaire – on ajuste au parent
          width: hostRef.current!.clientWidth,
          height: hostRef.current!.clientHeight,
        });

        const k = kaboomCtx;
        const W = k.width();
        const H = k.height();

        // Monde basique
        k.setGravity(1200);

        // Sol
        k.add([
          k.rect(W, 24),
          k.pos(0, H - 24),
          k.area(),
          k.body({ isStatic: true }),
          k.color(40, 40, 40),
        ]);

        // Joueur : couleur change selon le perso
        const col = character === "kiki" ? [255, 170, 0] : [0, 160, 255];
        const player = k.add([
          k.rect(28, 28),
          k.pos(40, H - 24 - 28),
          k.area(),
          k.body(),
          k.color(...col),
        ]);

        // Commandes (espace / clic)
        const jump = () => {
          if (player.isGrounded()) player.jump(520);
        };
        k.onKeyPress("space", jump);
        k.onClick(jump);

        // Obstacles
        const SPEED = 220;
        k.loop(1.1, () => {
          const h = k.rand(22, 40);
          const obs = k.add([
            k.rect(18, h),
            k.pos(W + 20, H - 24 - h),
            k.area(),
            "ob",
            k.color(220, 60, 60),
          ]);
          obs.onUpdate(() => {
            obs.move(-SPEED, 0);
            if (obs.pos.x < -30) obs.destroy();
          });
        });

        // Collision = perdu
        player.onCollide("ob", () => end(false));

        // Timer de victoire simple
        k.wait(20, () => end(true));

        function end(won: boolean) {
          if (disposed) return;
          disposed = true;
          const score = Math.max(0, Math.floor(k.time() * 10));
          try {
            k.destroyAll?.();
          } catch {}
          try {
            k.quit?.();
          } catch {}
          onEnd({ won, score });
        }
      } catch (e: any) {
        console.error("MiniGame init error", e);
        setError(
          "Impossible de lancer le mini-jeu (module Kaboom indisponible)."
        );
      }
    })();

    return () => {
      try {
        disposed = true;
        // si un canvas a été ajouté, on le retire
        if (hostRef.current && hostRef.current.firstChild) {
          hostRef.current.removeChild(hostRef.current.firstChild);
        }
        kaboomCtx?.quit?.();
      } catch {}
    };
  }, [character, onEnd]);

  return (
    <div
      ref={hostRef}
      className="game-host"
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 12,
        overflow: "hidden",
        background: "#0a0c10",
      }}
    >
      {error && (
        <div
          style={{
            color: "#fff",
            padding: 12,
            textAlign: "center",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
