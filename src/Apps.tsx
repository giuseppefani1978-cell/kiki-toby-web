import React, { useState } from 'react';
import MapView from './components/MapView';
import QRScanner from './components/QRScanner';
import './styles.css';

export default function App() {
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast] = useState<string|null>(null);

  // Hauteur réservée au panneau bas (boutons + marge).
  // Quand le scanner est ouvert, on garde le panneau visible (fermer)
  // mais la caméra est en overlay, donc la carte peut être plus courte.
  const bottomUI = showScan ? 140 : 140; // même hauteur, le scanner est en overlay

  return (
    <div className="safe">
      <h2 style={{margin:'8px 12px'}}>Kiki & Toby – Promenades parisiennes</h2>

      <MapView bottomSpace={bottomUI} />

      <div className="panel" style={{display:'flex', gap:8, alignItems:'center'}}>
        <button onClick={() => setShowScan(s => !s)}>
          {showScan ? 'Fermer scanner' : 'Scanner QR partenaire'}
        </button>
        {toast && <span>✅ {toast}</span>}
      </div>

      {showScan && (
        <div className="overlay">
          <div className="overlay-card">
            <div className="overlay-head">
              <b>Scanner un QR partenaire</b>
              <button onClick={() => setShowScan(false)} aria-label="Fermer">✕</button>
            </div>
            <QRScanner onVisit={({ partnerId }) => {
              setToast(`Visite validée chez ${partnerId} — récompense débloquée !`);
              setShowScan(false);
            }} />
            <p className="overlay-hint">Cadrez le QR. La détection est automatique.</p>
          </div>
        </div>
      )}
    </div>
  );
}
