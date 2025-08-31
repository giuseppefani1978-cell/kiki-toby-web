import React, { useState } from 'react';
import MapView from './components/MapView';
import QRScanner from './components/QRScanner';

export default function App() {
  const [showScan, setShowScan] = useState(false);
  const [toast, setToast] = useState<string|null>(null);

  return (
    <div className="safe">
      <h2 style={{margin:'8px 12px'}}>Kiki & Toby – Promenades parisiennes</h2>

      <MapView />

      <div className="panel" style={{display:'flex', gap:8, alignItems:'center'}}>
        <button onClick={() => setShowScan(s => !s)}>
          {showScan ? 'Fermer scanner' : 'Scanner QR partenaire'}
        </button>
        {toast && <span>✅ {toast}</span>}
      </div>

      {showScan && (
        <QRScanner onVisit={({partnerId})=>{
          setToast(`Visite validée chez ${partnerId} — récompense débloquée !`);
          setShowScan(false);
        }} />
      )}
    </div>
  );
}
