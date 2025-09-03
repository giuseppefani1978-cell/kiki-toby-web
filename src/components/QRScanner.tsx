// src/components/QRScanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type Props = { onVisit: (p: { partnerId: string }) => void };

// Accepte "KT-PARTNER|<id>|<ts>" ou n'importe quel texte (démo)
function parseQR(raw: string) {
  const parts = raw.trim().split('|');
  if (parts.length >= 3 && parts[0] === 'KT-PARTNER') return { partnerId: parts[1] };
  return { partnerId: raw };
}

export default function QRScanner({ onVisit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Utilise le conteneur visible comme région de scan
    const id = 'qr-' + Math.random().toString(36).slice(2);
    host.id = id;

    const qr = new Html5Qrcode(id, /* verbose */ false);
    let started = false;   // évite double start
    let stopping = false;  // sérialise stop/clear
    let handled = false;   // évite double-callback

    (async () => {
      try {
        setErr(null);

        // Laisse l’overlay se peindre avant de démarrer (iOS)
        await new Promise<void>(r => requestAnimationFrame(() => r()));

        const box = Math.min(Math.floor(window.innerWidth * 0.8), 380);

        // Démarrage simple et fiable : caméra arrière par "facingMode"
        await qr.start(
          { facingMode: 'environment' } as any,
          { fps: 12, qrbox: { width: box, height: box } },
          async (decoded: string) => {
            if (handled) return;
            handled = true;

            try {
              if (!stopping) {
                stopping = true;
                await qr.stop();
                await qr.clear();
              }
            } catch { /* ignore */ }

            const { partnerId } = parseQR(decoded);
            onVisit({ partnerId });   // -> Apps ferme l’overlay + affiche le toast
          },
          /* onDecodeFailure */ () => {}
        );

        started = true;
      } catch (e) {
        console.error('[QR] start error', e);
        setErr("Impossible d'accéder à la caméra. Vérifie l'autorisation puis réessaie.");
      }
    })();

    // Nettoyage robuste
    return () => {
      (async () => {
        try {
          if (started && !stopping) {
            stopping = true;
            await qr.stop();
            await qr.clear();
          }
        } catch { /* ignore */ }
      })();
    };
  }, [onVisit]);

  return (
    <div
      ref={hostRef}
      className="qr-region"
      style={{
        width: '100%',
        maxWidth: 680,
        aspectRatio: '4 / 3',
        background: '#000',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      aria-label="Zone de lecture QR"
    >
      {err
        ? <div style={{ color:'#fff', textAlign:'center', padding:12, lineHeight:1.4 }}>
            {err}<br/>
            <small>iOS ▸ Safari ▸ Caméra : Autoriser.</small>
          </div>
        : <p style={{ color:'#fff', opacity:.7, fontSize:14 }}>Chargement de la caméra…</p>}
    </div>
  );
}
