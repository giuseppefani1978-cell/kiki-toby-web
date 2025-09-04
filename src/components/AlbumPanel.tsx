// src/components/AlbumPanel.tsx
import React from 'react';
import { game, clearGame } from '../store/game';

export default function AlbumPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="overlay-card" style={{ maxWidth: 720 }}>
        <div className="overlay-head">
          <b>Album des choix</b>
          <button onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div className="panel" style={{paddingTop:0}}>
          <p style={{marginTop:0}}>
            🐱 <b>Kiki</b> : {game.moustaches} &nbsp;·&nbsp; 🐶 <b>Toby</b> : {game.pattes}
          </p>

          {game.album.length === 0 ? (
            <p style={{opacity:.7}}>Aucun fragment collecté pour l’instant.</p>
          ) : (
            <ul style={{listStyle:'none', padding:0, margin:0, display:'grid', gap:8}}>
              {game.album.map((f, i) => (
                <li key={i} style={{
                  display:'flex', alignItems:'center', gap:10,
                  background:'#fff', border:'1px solid #e8eaed', borderRadius:10, padding:'8px 10px'
                }}>
                  <span style={{fontSize:18}}>{f.who === 'kiki' ? '🐱' : '🐶'}</span>
                  <span style={{opacity:.8}}>POI&nbsp;: <code>{f.poiId}</code></span>
                </li>
              ))}
            </ul>
          )}

          <div style={{display:'flex', gap:8, marginTop:12}}>
            <button onClick={onClose}>Fermer</button>
            <button onClick={() => { clearGame(); onClose(); }} style={{marginLeft:'auto'}}>
              Réinitialiser l’album
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
