// src/components/MapView.tsx
import React, { useMemo, useState, useEffect, type ReactNode } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import poiData from '../data/poi/05_quartier_latin.json';
import partners from '../data/partners/cafes_rive_gauche.json';

// ⬇️ NEW: overlay de mini-jeu
import MiniGameOverlay from './MiniGameOverlay';

export type POI = typeof poiData[number];

const iconBlue = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
const iconBrown = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export default function MapView({
  bottomSpace = 140,
  onFocus,
  overlay, // <-- on garde ton overlay (bulles DialogueOverlay passées depuis Apps)
}: {
  bottomSpace?: number;
  onFocus?: (p: POI) => void;
  overlay?: ReactNode;
}) {
  const pois = useMemo(() => poiData, []);
  const [center, setCenter] = useState<[number, number]>([48.8465, 2.344]);

  // ⬇️ NEW: état d’ouverture du mini-jeu
  const [activeGame, setActiveGame] = useState<null | { title: string; character: 'kiki' | 'toby' }>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const mapHeight = `calc(100vh - ${72 + bottomSpace}px)`; // ~72px pour le titre/marges

  return (
    <MapContainer
      id="map"
      style={{ height: mapHeight, position: 'relative' }} // relative pour superposer les overlays
      center={center}
      zoom={15}
      preferCanvas
      touchZoom
      inertia={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {pois.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={iconBlue}
          eventHandlers={{
            click: () => {
              // ⬇️ NEW: si c’est le Panthéon, on lance le mini-jeu
              if (p.title.toLowerCase().includes('panthéon')) {
                setActiveGame({ title: `${p.title} — Run`, character: 'kiki' }); // tu pourras choisir 'toby' selon le joueur
              } else {
                // sinon, on garde ton flux existant (remonte le POI pour tes bulles)
                onFocus?.(p);
              }
            },
          }}
        >
          <Popup>{p.title}</Popup>
        </Marker>
      ))}

      {partners.map((pt) => (
        <Marker key={pt.id} position={[pt.lat, pt.lng]} icon={iconBrown}>
          <Popup>{pt.name} (Partenaire)</Popup>
        </Marker>
      ))}

      {/* Overlay passé depuis Apps (DialogueOverlay avec bulles) — on le garde */}
      {overlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none', // la carte reste interactive en dessous
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>{overlay}</div>
        </div>
      )}

      {/* ⬇️ NEW: overlay du mini-jeu au-dessus de la carte (plein écran carte) */}
      {activeGame && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // pas de pointerEvents:'none' pour capter les inputs du jeu
          }}
        >
          <MiniGameOverlay
            character={activeGame.character}
            title={activeGame.title}
            onClose={() => setActiveGame(null)}
            onResult={(r) => {
              // ici tu peux brancher sur addFragment / score / toasts, etc.
              console.log('Résultat mini-jeu:', r);
              setActiveGame(null);
            }}
          />
        </div>
      )}
    </MapContainer>
  );
}
