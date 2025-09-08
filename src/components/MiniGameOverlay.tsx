// src/components/MiniGameOverlay.tsx
import React, { useMemo, useState } from "react";
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
  // États des contrôles tactiles
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const [jumpTick, setJumpTick] = useState(0);

  // HUD debug
  const [showDebug, setShowDebug] = useState(false);
  const [noAutoClose, setNoAutoClose] = useState(false);
  const [lastResult, setLastResult] = useState<null | {
    won: boolean;
    score: number;
    time: number;
  }>(null);

  // Helpers pour press/release (mouse + touch)
  const press = (fn: (v: boolean) => void, v: boolean) =>
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      fn(v);
    };

  const release = (fn: (v: boolean) => void) =>
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      fn(false);
    };

  const doJump = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setJumpTick((t) => t + 1);
  };

  // Texte aide rapide (mémoisé pour ne pas rerendre)
  const hint = useMemo(
    () => "Mobile : ◀︎ / ▶︎ pour bouger, ⏫ pour sauter. Desktop : flèches et Espace.",
    []
  );

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="overlay-card" style={{ width: "min(760px, 96vw)", position: "relative" }}>
        <div className="overlay-head" style={{ marginBottom: 8 }}>
          <b>{title}</b>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Toggles debug */}
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={showDebug}
                onChange={(e) => setShowDebug(e.currentTarget.checked)}
              />
              Debug HUD
            </label>

            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={noAutoClose}
                onChange={(e) => setNoAutoClose(e.currentTarget.checked)}
              />
              Ne pas fermer automatiquement
            </label>

            <button onClick={onClose} aria-label="Fermer">✕</button>
          </div>
        </div>

        {/* Aire de jeu */}
        <div style={{ position: "relative", width: "100%", height: "min(70vh, 520px)" }}>
          <MiniGame
            character={character}
            title={title}
            onDone={(r) => {
              // 1) On remonte quand même le résultat (logique jeu)
              onResult(r);
              setLastResult(r);

              // 2) Fermeture auto uniquement si l’option est décochée
              if (!noAutoClose) {
                onClose();
              }
              // Sinon, on reste ouvert pour pouvoir lire le HUD / reproduire le bug.
            }}
            // Commandes tactiles (passe-plat)
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
              pointerEvents: "none", // la carte de fond reste non cliquable ; on réactive par bouton
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

          {/* HUD DEBUG (coin haut-gauche) */}
          {showDebug && (
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                zIndex: 10,
                background: "rgba(0,0,0,.6)",
                color: "#fff",
                padding: "6px 8px",
                borderRadius: 8,
                font: "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                lineHeight: 1.25,
                pointerEvents: "none",
                maxWidth: "80%",
                whiteSpace: "pre-wrap",
              }}
            >
{`MiniGame DEBUG
left: ${left} | right: ${right} | jumpTick: ${jumpTick}
autoClose: ${!noAutoClose}
lastResult: ${lastResult ? JSON.stringify(lastResult) : "—"}`}
            </div>
          )}

          {/* Bandeau résultat en mode debug (si on a bloqué l’auto-close) */}
          {noAutoClose && lastResult && (
            <div
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 12,
                zIndex: 10,
                background: "rgba(17,24,39,.9)",
                color: "#fff",
                padding: "10px 12px",
                borderRadius: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                {lastResult.won ? "🏁 Terminé" : "💥 Raté"} — score {lastResult.score} — {lastResult.time.toFixed(1)}s
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={onClose}
                  style={chipButton}
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    // “Relancer” : on ferme puis on rouvre côté parent (MiniGameOverlay est recréé)
                    // Ici, on se contente de reset l’état local pour rejouer immédiatement
                    setLastResult(null);
                    setLeft(false);
                    setRight(false);
                    // On simule un “tap” saut pour relancer rapidement si besoin
                    // setJumpTick((t) => t + 1);
                  }}
                  style={{ ...chipButton, background: "rgba(34,197,94,.9)" }}
                >
                  Rester / Rejouer
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="overlay-hint" style={{ marginTop: 8 }}>
          {hint}
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

const chipButton: React.CSSProperties = {
  border: "none",
  borderRadius: 999,
  background: "rgba(59,130,246,.9)",
  color: "#fff",
  fontSize: 13,
  padding: "8px 12px",
};
