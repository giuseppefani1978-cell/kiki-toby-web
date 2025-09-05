// src/components/MiniGameOverlay.tsx
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
      <div
        className="overlay-card"
        style={{
          width: "min(760px, 96vw)",
          maxWidth: "96vw",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* En-tête */}
        <div
          className="overlay-head"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <b>{title}</b>
          <button onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {/* Conteneur du mini-jeu */}
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",   // ratio fixe pour que le canvas ait une hauteur
            minHeight: 240,         // sécurité : jamais 0px
            position: "relative",   // nécessaire car le <canvas> est en absolute
            background: "#0b0d10",  // visible si jamais le canvas n’est pas rendu
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <MiniGame
            character={character}
            title={title}
            onDone={(r) => {
              onResult(r); // transmettre le résultat
              onClose();   // fermer ensuite
            }}
          />
        </div>

        <p className="overlay-hint" style={{ marginTop: 8 }}>
          Appuie pour sauter. Évite les obstacles. Tiens 20 secondes !
        </p>
      </div>
    </div>
  );
}
