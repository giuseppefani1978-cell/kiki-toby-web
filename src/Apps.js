import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import MapView from './components/MapView';
import QRScanner from './components/QRScanner';
export default function App() {
    const [showScan, setShowScan] = useState(false);
    const [toast, setToast] = useState(null);
    return (_jsxs("div", { className: "safe", children: [_jsx("h2", { style: { margin: '8px 12px' }, children: "Kiki & Toby \u2013 Promenades parisiennes" }), _jsx(MapView, {}), _jsxs("div", { className: "panel", style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("button", { onClick: () => setShowScan(s => !s), children: showScan ? 'Fermer scanner' : 'Scanner QR partenaire' }), toast && _jsxs("span", { children: ["\u2705 ", toast] })] }), showScan && (_jsx(QRScanner, { onVisit: ({ partnerId }) => {
                    setToast(`Visite validée chez ${partnerId} — récompense débloquée !`);
                    setShowScan(false);
                } }))] }));
}
