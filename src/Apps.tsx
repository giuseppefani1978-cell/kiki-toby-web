import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import MapView from './components/MapView';
import QRScanner from './components/QRScanner';
import './styles.css';

export default function Apps() {
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Empêche le défilement de la page quand l’overlay est ouvert
  useEffect(() => {
    document.body.classList.toggle('modal-open', showScan);
    return () => document.body.classList.remove('modal-open');
  }, [showScan]);

  // Overlay rendu dans <body> pour passer AU-DESSUS de la carte quoi qu’il arrive
  const overlay = showScan
    ? createPortal(
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="overlay-card">
            <div className="overlay-head">
              <b>Scanner un QR partenaire</b>
              <button onClick={() => setShowScan(false)} aria-label="Fermer">✕</button>
            </div>
            <QRScanner
              onVisit={({ partnerId }) => {
                setShowScan(false); // ferme l’overlay dès que ça scanne
                setToast(`Visite validée chez ${partnerId} — récompense débloquée !`);
                window.setTimeout(() => setToast(null), 3000); // auto-hide
              }}
            />
            <p className="overlay-hint">Cadrez le QR. La détection est automatique.</p>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="safe">
      <h2 style={{ margin: '8px 12px' }}>Kiki & Toby – Promenades parisiennes</h2>

      {/* La carte laisse un espace en bas pour la barre d’actions */}
      <MapView bottomSpace={140} />

      <div className="panel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="primary" onClick={() => setShowScan(true)}>
          Scanner QR partenaire
        </button>
      </div>

      {overlay}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
