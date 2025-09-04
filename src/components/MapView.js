import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import poiData from '../data/poi/05_quartier_latin.json';
import partners from '../data/partners/cafes_rive_gauche.json';
import DialogueCard from './DialogueCard';
const iconBlue = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
});
const iconBrown = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
});
export default function MapView() {
    const [focus, setFocus] = useState(null);
    const pois = useMemo(() => poiData, []);
    // Optionnel : centrage sur l’utilisateur (si autorisé)
    const [center, setCenter] = useState([48.8465, 2.344]);
    useEffect(() => {
        if (!('geolocation' in navigator))
            return;
        const id = navigator.geolocation.watchPosition((pos) => setCenter([pos.coords.latitude, pos.coords.longitude]), () => { }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
        return () => navigator.geolocation.clearWatch(id);
    }, []);
    return (_jsxs(_Fragment, { children: [_jsxs(MapContainer, { id: "map", center: center, zoom: 15, preferCanvas: true, touchZoom: true, inertia: false, children: [_jsx(TileLayer, { attribution: '\u00A9 OpenStreetMap', url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" }), pois.map(p => (_jsx(Marker, { position: [p.lat, p.lng], icon: iconBlue, eventHandlers: { click: () => setFocus(p) }, children: _jsx(Popup, { children: p.title }) }, p.id))), partners.map(pt => (_jsx(Marker, { position: [pt.lat, pt.lng], icon: iconBrown, children: _jsxs(Popup, { children: [pt.name, " (Partenaire)"] }) }, pt.id)))] }), focus && (_jsx(DialogueCard, { kiki: focus.kiki, toby: focus.toby, poiId: focus.id }))] }));
}
