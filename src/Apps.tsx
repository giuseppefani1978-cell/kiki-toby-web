// src/Apps.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import MapView, { POI } from './components/MapView';
import QRScanner from './components/QRScanner';
import DialogueOverlay from './components/DialogueOverlay';
import AlbumPanel from './components/AlbumPanel';
import MiniGameOverlay from './components/MiniGameOverlay';

import { game, loadGame } from './store/game';
import '../styles.css';

export default function Apps() {
  // --- UI state ---
  const [showScan, setShowScan] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [focus, setFocus] = useState<POI | null>(null);

  // Mini-jeu
  const [showGame, setShowGame] = useState<null | { character: 'kiki' | 'toby'; title: string }>(null);

  // pour restaurer le focus après fermeture d’un overlay (accessibilité)
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const hasAnyOverlay = showScan || showAlbum || !!showGame;

  // re-render quand le store "game" change
  const [, force] = useState(0);

  // Charger l'état persistant + s'abonner aux updates
  useEffect(() => {
    loadGame();
    const onUpd = () => force(x => x + 1);
    window.addEventListener('kt-game-update', onUpd as any);
    return () => window.removeEventListener('kt-game-update', onUpd as any);
  }, []);

  // Empêche le scroll/zoom de la page quand un overlay plein écran est ouvert (iOS-friendly)
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('modal-open', hasAnyOverlay);

    // bloque les gestes tactiles du fond (notamment iOS)
    const prevent = (e: TouchEvent) => {
      if (hasAnyOverlay) e.preventDefault();
    };
    document.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      body.classList.remove('modal-open');
      document.removeEventListener('touchmove', prevent);
    };
  }, [hasAnyOverlay]);

  // Sauve / restaure le focus autour des overlays
  useEffect(() => {
    if (hasAnyOverlay) {
      lastFocusRef.current = (document.activeElement as HTMLElement) || null;
    } else if (lastFocusRef.current) {
      lastFocusRef.current.focus?.();
      lastFocusRef.current = null;
    }
  }, [hasAnyOverlay]);

  // --- Overlays portés dans <body> ---
  const scannerOverlay = useMemo(() => {
    if (!showScan) return null;
    return createPortal(
      <div
        className="overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Scanner un QR partenaire"
        onClick={(e) => {
          // évite de fermer si on clique dans la zone sombre (on ferme uniquement via le bouton ✕)
          e.stopPropagation();
        }}
      >
        <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
          <div className="overlay-head">
            <b>Scanner un QR partenaire</b>
            <button type="button" onClick={() => setShowScan(false)} aria-label="Fermer">✕</button>
          </div>

          {/* Le QRScanner gère la permission et appelle onVisit au succès */}
          <QRScanner
            onVisit={({ partnerId }) => {
              // On garde l’overlay visible jusqu’au callback, puis on le ferme proprement
              setShowScan(false);
              setToast(`Visite validée chez ${partnerId} — récompense débloquée !`);
              window.setTimeout(() => setToast(null), 3000);
            }}
          />

          <p className="overlay-hint">Cadrez le QR. La détection est automatique.</p>
        </div>
      </div>,
      document.body
    );
  }, [showScan]);

  const albumOverlay = useMemo(() => {
    if (!showAlbum) return null;
    return createPortal(
      <AlbumPanel onClose={() => setShowAlbum(false)} />,
      document.body
    );
  }, [showAlbum]);

  const gameOverlay = useMemo(() => {
    if (!showGame) return null;
    return createPortal(
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
    );
  }, [showGame]);

  return (
    <div className="safe" style={{ position: 'relative' }} aria-hidden={hasAnyOverlay}>
      <h2 style={{ margin: '8px 12px' }}>Kiki & Toby – Promenades parisiennes</h2>

      <MapView
  bottomSpace={160}
  onFocus={setFocus}
  overlay={
    focus ? (
      <DialogueOverlay
        poi={focus}
        onClose={(picked?: 'kiki' | 'toby') => {
          // on capture le poi courant avant de le nettoyer
          const poi = focus;
          setFocus(null);

          setToast('Choix enregistré ✅');
          window.setTimeout(() => setToast(null), 2000);

          // Si on est sur un Panthéon → on enchaîne sur le mini-jeu
          if (poi && poi.title.toLowerCase().includes('panthéon')) {
            // léger délai pour laisser l’overlay se fermer proprement
            window.setTimeout(() => {
              setShowGame({
                character: picked || 'kiki',       // 'kiki' par défaut si non fourni
                title: `${poi.title} — Run`,
              });
            }, 120);
          }
        }}
      />
    ) : null
  }
/>
      {/* Barre d’actions */}
      <div className="panel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" className="primary" onClick={(e) => { e.currentTarget.blur(); setShowScan(true); }}>
          Scanner QR partenaire
        </button>

        <button type="button" onClick={() => setShowAlbum(true)}>
          Album <span className="badge">{game.moustaches + game.pattes}</span>
        </button>

        {/* Bouton de test pour lancer le mini-jeu immédiatement */}
        <button type="button" onClick={() => setShowGame({ character: 'kiki', title: 'Mini-jeu (démo)' })}>
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
