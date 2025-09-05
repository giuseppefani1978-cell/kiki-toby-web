import React from "react";
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
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="overlay-card" style={{ width: "min(760px, 96vw)" }}>
        <div className="overlay-head" style={{ marginBottom: 8 }}>
          <b>{title}</b>
          <button onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        {/* Mini-jeu Canvas (gère lui-même son ratio/hauteur) */}
        <MiniGame
          character={character}
          title={title}
          onDone={(r) => {
            onResult(r);   // d'abord remonter le résultat…
            onClose();     // …puis fermer l’overlay
          }}
        />

        <p className="overlay-hint" style={{ marginTop: 8 }}>
          Appuie pour sauter. Évite les obstacles. Tiens 20 secondes !
        </p>
      </div>
    </div>
  );
}
