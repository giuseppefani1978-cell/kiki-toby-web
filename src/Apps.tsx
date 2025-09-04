// src/Apps.tsx
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import MapView, { POI } from './components/MapView';
import QRScanner from './components/QRScanner';
import DialogueOverlay from './components/DialogueOverlay'; // si absent, commente cette ligne
import AlbumPanel from './components/AlbumPanel';

import { game, loadGame } from './store/game';
import '../styles.css';

export default function Apps() {
  // --- UI state ---
  const [showScan, setShowScan] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [focus, setFocus] = useState<POI | null>(null);

  // force re-render quand le store "game" change (via CustomEvent)
  const [, force] = useState(0);

  // Charger l'état persistant + s'abonner aux updates de l'album
  useEffect(() => {
    loadGame();
    const onUpd = () => force(x => x + 1);
    window.addEventListener('kt-game-update', onUpd as any);
    return () => window.removeEventListener('kt-game-update', onUpd as any);
  }, []);

  // Empêche le scroll uniquement quand le scanner est ouvert
  useEffect(() => {
    document.body.classList.toggle('modal-open', showScan);
    return () => document.body.classList.remove('modal-open');
  }, [showScan]);

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

  return (
    <div className="safe" style={{ position: 'relative' }}>
      <h2 style={{ margin: '8px 12px' }}>Kiki & Toby – Promenades parisiennes</h2>

      {/* Carte : on remonte le POI cliqué via onFocus */}
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
          Album
          <span className="badge">{game.moustaches + game.pattes}</span>
        </button>
      </div>

      {scannerOverlay}
      {albumOverlay}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
