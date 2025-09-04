import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { addFragment } from '../store/game';
export default function DialogueCard({ kiki, toby, poiId }) {
    return (_jsxs("div", { className: "panel", style: { background: '#fff', borderRadius: 12 }, children: [_jsxs("p", { children: ["\uD83D\uDC31 ", _jsx("b", { children: "Kiki" }), " \u2014 ", kiki] }), _jsxs("p", { children: ["\uD83D\uDC36 ", _jsx("b", { children: "Toby" }), " \u2014 ", toby] }), _jsxs("div", { style: { display: 'flex', gap: 8 }, children: [_jsx("button", { onClick: () => addFragment({ poiId, who: 'kiki' }), children: "Soutenir Kiki" }), _jsx("button", { onClick: () => addFragment({ poiId, who: 'toby' }), children: "Soutenir Toby" })] })] }));
}
