// src/components/MiniGameOverlay.tsx
import React, { useState } from "react";
import MiniGame from "./MiniGame";

type Props = {
  character: "kiki" | "toby";
  title: string;
  onClose: () => void;
  onResult: (r: { won: boolean; score: number; time: number }) => void;
};

export default function MiniGameOverlay({
  character,
  title,
  onClose,
  onResult,
}: Props) {
  // états des contrôles tactiles
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [jumpTick, setJumpTick] = useState(0);

  // helpers pour gérer press/release à la fois mouse et touch
  const press =
    (fn: (v: boolean) => void, v: boolean) =>
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      fn(v);
    };

  const release = (fn: (v: boolean) => void) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    fn(false);
  };

  const doJump = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setJumpTick((t) => t + 1);
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="overlay-card" style={{ width: "min(760px, 96vw)", position: "relative" }}>
        <div className="overlay-head" style={{ marginBottom: 8 }}>
          <b>{title}</b>
          <button onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* Aire de jeu : occupe toute la carte de l’overlay-card */}
        <div style={{ position: "relative", width: "100%", height: "min(70vh, 520px)" }}>
          <MiniGame
            character={character}
            title={title}
            onDone={(r) => {
              onResult(r);
              onClose();
            }}
            // ⬇️ commandes tactiles
            moveLeft={left}
            moveRight={right}
            jumpTick={jumpTick}
          />

          {/* PAD TACTILE — rangée gauche/droite + saut */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              padding: 12,
              pointerEvents: "none", // on réactive par bouton
            }}
          >
            {/* Gauche/Droite */}
            <div style={{ display: "flex", gap: 12, pointerEvents: "auto" }}>
              <button
                type="button"
                aria-label="Aller à gauche"
                onMouseDown={press(setLeft, true)}
                onMouseUp={release(setLeft)}
                onMouseLeave={release(setLeft)}
                onTouchStart={press(setLeft, true)}
                onTouchEnd={release(setLeft)}
                onTouchCancel={release(setLeft)}
                style={padStyle}
              >
                ◀︎
              </button>
              <button
                type="button"
                aria-label="Aller à droite"
                onMouseDown={press(setRight, true)}
                onMouseUp={release(setRight)}
                onMouseLeave={release(setRight)}
                onTouchStart={press(setRight, true)}
                onTouchEnd={release(setRight)}
                onTouchCancel={release(setRight)}
                style={padStyle}
              >
                ▶︎
              </button>
            </div>

            {/* Saut */}
            <div style={{ pointerEvents: "auto" }}>
              <button
                type="button"
                aria-label="Sauter"
                onMouseDown={doJump}
                onTouchStart={doJump}
                style={{ ...padStyle, width: 84, height: 84, fontSize: 22 }}
              >
                ⏫
              </button>
            </div>
          </div>
        </div>

        <p className="overlay-hint" style={{ marginTop: 8 }}>
          Mobile : ◀︎ / ▶︎ pour bouger, ⏫ pour sauter. Desktop : flèches et Espace.
        </p>
      </div>
    </div>
  );
}

const padStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 999,
  border: "none",
  background: "rgba(15, 23, 42, .55)",
  color: "white",
  fontSize: 18,
  lineHeight: 1,
  display: "grid",
  placeItems: "center",
  touchAction: "none",
  WebkitTapHighlightColor: "transparent",
};
