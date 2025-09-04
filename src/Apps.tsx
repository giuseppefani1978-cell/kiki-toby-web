// src/Apps.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import MapView, { POI } from './components/MapView';
import QRScanner from './components/QRScanner';
import DialogueOverlay from './components/DialogueOverlay';
import AlbumPanel from './components/AlbumPanel';
import MiniGameOverlay from './components/MiniGameOverlay'; // ← AJOUT

import { game, loadGame } from './store/game';
import '../styles.css';

export default function Apps() {
  // --- UI state ---
  const [showScan, setShowScan] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [focus, setFocus] = useState<POI | null>(null);

  // --- Mini-jeu ---
  const [showGame, setShowGame] = useState<null | { character: 'kiki' | 'toby'; title: string }>(null);

  // force re-render quand le store "game" change (via CustomEvent)
  const [, force] = useState(0);

  // Charger l'état persistant + s'abonner aux updates de l'album
  useEffect(() => {
    loadGame();
    const onUpd = () => force(x => x + 1);
    window.addEventListener('kt-game-update', onUpd as any);
    return () => window.removeEventListener('kt-game-update', onUpd as any);
  }, []);

  // Empêche le scroll quand un overlay plein écran est ouvert
  useEffect(() => {
    const modalOpen = showScan || !!showGame;
    document.body.classList.toggle('modal-open', modalOpen);
    return () => document.body.classList.remove('modal-open');
  }, [showScan, showGame]);

  // --- Overlays portés dans <body> ---
  const scannerOverlay = showScan
    ? createPortal(
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="overlay-card">
            <div className="overlay-head">
              <b>Scanner un QR partenaire</b>
              <button onClick={() => setShowScan(false)} aria-label="Fermer">✕</button>
            </div>
            <QRScanner
              onVisit={({ partnerId }) => {
                setShowScan(false);
                setToast(`Visite validée chez ${partnerId} — récompense débloquée !`);
                window.setTimeout(() => setToast(null), 3000);
              }}
            />
            <p className="overlay-hint">Cadrez le QR. La détection est automatique.</p>
          </div>
        </div>,
        document.body
      )
    : null;

  const albumOverlay = showAlbum
    ? createPortal(<AlbumPanel onClose={() => setShowAlbum(false)} />, document.body)
    : null;

  const gameOverlay = showGame
    ? createPortal(
        <MiniGameOverlay
          character={showGame.character}
          title={showGame.title}
          onClose={() => setShowGame(null)}
          onResult={(r) => {
            setShowGame(null);
            setToast(r.won ? `🏁 Bravo ! Score ${r.score}` : `💥 Raté… Score ${r.score}`);
            window.setTimeout(() => setToast(null), 3000);
          }}
        />,
        document.body
      )
    : null;

  return (
    <div className="safe" style={{ position: 'relative' }}>
      <h2 style={{ margin: '8px 12px' }}>Kiki & Toby – Promenades parisiennes</h2>

      {/* Carte : on remonte le POI cliqué via onFocus, et on passe l’overlay de dialogue à MapView */}
      <MapView
        bottomSpace={160}
        onFocus={setFocus}
        overlay={
          focus ? (
            <DialogueOverlay
              poi={focus}
              onClose={() => {
                setFocus(null);
                setToast('Choix enregistré ✅');
                window.setTimeout(() => setToast(null), 2000);

                // Ex : lancer un mini-niveau juste après un choix
                // setShowGame({ character: 'kiki', title: `${focus.title} — Run` });
              }}
            />
          ) : null
        }
      />

      {/* Barre d’actions */}
      <div className="panel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="primary" onClick={() => setShowScan(true)}>
          Scanner QR partenaire
        </button>

        <button onClick={() => setShowAlbum(true)}>
          Album <span className="badge">{game.moustaches + game.pattes}</span>
        </button>

        {/* Bouton de test pour afficher le mini-jeu tout de suite */}
        <button onClick={() => setShowGame({ character: 'kiki', title: 'Mini-niveau (démo)' })}>
          Mini-jeu (démo)
        </button>
      </div>

      {scannerOverlay}
      {albumOverlay}
      {gameOverlay}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
