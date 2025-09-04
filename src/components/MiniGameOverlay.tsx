// src/components/MiniGameOverlay.tsx
import React from 'react';
import { createPortal } from 'react-dom';
import MiniGame from './MiniGame';

export default function MiniGameOverlay({
  character,
  title,
  onClose,
  onResult,
}: {
  character: 'kiki' | 'toby';
  title?: string;
  onClose: () => void;
  onResult?: (r: { won: boolean; score: number; time: number }) => void;
}) {
  return createPortal(
    <div className="overlay" role="dialog" aria-modal="true" style={{ background: 'rgba(0,0,0,.9)' }}>
      <div className="overlay-card" style={{ padding: 0, width: 'min(900px, 96vw)', overflow: 'hidden' }}>
        <div className="overlay-head" style={{ padding: 10 }}>
          <b>{title || 'Mini-niveau'}</b>
          <button onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div style={{ width: '100%', height: '70vh' }}>
          <MiniGame
            character={character}
            title={title}
            onDone={(res) => {
              onResult?.(res);
              onClose();
            }}
          />
        </div>
        <p className="overlay-hint" style={{ padding: 10, textAlign: 'center' }}>
          Tap / Espace pour sauter — évite les rats, saute les crottes, collecte les {character === 'kiki' ? 'moustaches' : 'pattes'} !
        </p>
      </div>
    </div>,
    document.body,
  );
}
