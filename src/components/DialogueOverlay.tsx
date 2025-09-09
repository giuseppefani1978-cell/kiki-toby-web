// src/components/DialogueOverlay.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useMap } from 'react-leaflet';
import type { POI } from './MapView';
import { addFragment } from '../store/game';

type Props = {
  poi: POI;
  /** Pass 'kiki' or 'toby' when a choice is made; undefined when closed via ✕ */
  onClose: (picked?: 'kiki' | 'toby') => void;
};

function useScreenPoint(lat: number, lng: number) {
  const map = useMap();
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const update = () => {
      const p = map.latLngToContainerPoint([lat, lng]);
      setPt({ x: p.x, y: p.y });
    };
    update();
    map.on('move zoom resize', update);
    return () => { map.off('move zoom resize', update); };
  }, [map, lat, lng]);

  return pt;
}

export default function DialogueOverlay({ poi, onClose }: Props) {
  const pt = useScreenPoint(poi.lat, poi.lng);
  const bubbleOffset = useMemo(() => ({ left: -120, top: -160 }), []);
  const base = (import.meta as any).env?.BASE_URL || '/'; // ex: '/kiki-toby-web/'

  if (!pt) return null;

  const pick = (who: 'kiki' | 'toby') => {
    // on enregistre le fragment…
    addFragment({ poiId: poi.id, who });
    // …et on remonte le choix au parent (Apps.tsx)
    onClose(who);
  };

  return (
    <div className="map-overlay">
      {/* ancre au point du POI */}
      <div
        className="bubble-wrap"
        style={{ transform: `translate(${pt.x + bubbleOffset.left}px, ${pt.y + bubbleOffset.top}px)` }}
      >
        <div className="avatars">
          <div className="avatar">
            <img
              src={`${base}avatars/kiki.png`}
              alt="Kiki"
              onError={(e: any) => { e.currentTarget.replaceWith(document.createTextNode('🐱')); }}
            />
          </div>
          <div className="avatar">
            <img
              src={`${base}avatars/toby.png`}
              alt="Toby"
              onError={(e: any) => { e.currentTarget.replaceWith(document.createTextNode('🐶')); }}
            />
          </div>
        </div>

        <div className="speech speech-kiki">
          <div className="speech-text">🐱 <b>Kiki</b> — {poi.kiki}</div>
          <button className="chip" onClick={() => pick('kiki')}>Soutenir Kiki</button>
        </div>

        <div className="speech speech-toby">
          <div className="speech-text">🐶 <b>Toby</b> — {poi.toby}</div>
          <button className="chip" onClick={() => pick('toby')}>Soutenir Toby</button>
        </div>

        <button className="close-x" aria-label="Fermer" onClick={() => onClose()}>✕</button>
      </div>
    </div>
  );
}
