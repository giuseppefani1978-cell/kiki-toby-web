import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import poiData from '../data/poi/05_quartier_latin.json';
import partners from '../data/partners/cafes_rive_gauche.json';

export type POI = typeof poiData[number];

const iconBlue = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25,41], iconAnchor:[12,41], popupAnchor:[1,-34]
});
const iconBrown = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [25,41], iconAnchor:[12,41], popupAnchor:[1,-34]
});

export default function MapView({
  bottomSpace = 140,
  onFocus,
}: {
  bottomSpace?: number;
  onFocus?: (p: POI) => void;
}) {
  const pois = useMemo(() => poiData, []);
  const [center, setCenter] = useState<[number, number]>([48.8465, 2.344]);

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
      style={{ height: mapHeight }}
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
      {pois.map(p => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={iconBlue}
          eventHandlers={onFocus ? { click: () => onFocus(p) } : undefined}
        >
          <Popup>{p.title}</Popup>
        </Marker>
      ))}
      {partners.map(pt => (
        <Marker key={pt.id} position={[pt.lat, pt.lng]} icon={iconBrown}>
          <Popup>{pt.name} (Partenaire)</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
