import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type Props = { onVisit: (p: { partnerId: string }) => void };

function parseQR(raw: string) {
  const parts = raw.trim().split('|');
  if (parts.length >= 3 && parts[0] === 'KT-PARTNER') {
    return { partnerId: parts[1] };
  }
  return { partnerId: raw }; // accepte tout en mode démo
}

async function chooseRearConstraint(): Promise<MediaStreamConstraints['video']> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { facingMode: { ideal: 'environment' } };
  }
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const cams = devs.filter(d => d.kind === 'videoinput');
    const rear = cams.find(d =>
      /back|rear|environment/i.test(d.label) || /back|rear|environment/i.test(d.deviceId)
    );
    return rear ? { deviceId: { exact: rear.deviceId } }
                : { facingMode: { ideal: 'environment' } };
  } catch {
    return { facingMode: { ideal: 'environment' } };
  }
}

export default function QRScanner({ onVisit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    // id directement sur le conteneur visible
    const id = 'qr-' + Math.random().toString(36).slice(2);
    hostRef.current.id = id;

    const qr = new Html5Qrcode(id, false);
    let stopped = false;
    let handled = false;

    (async () => {
      try {
        setErr(null);

        // 1) Choix contrainte arrière si possible
        const video = await chooseRearConstraint();

        // ⚠️ On NE fait plus de "pré-permission" qui ouvrait/fermait instantanément la caméra
        // (c’est la cause fréquente de l’écran blanc sur iOS). On laisse html5-qrcode gérer.

        const box = Math.min(Math.floor(window.innerWidth * 0.86), 420);

        await qr.start(
          video,
          { fps: 12, qrbox: { width: box, height: box } },
          async (decoded: string) => {
            if (handled) return;
            handled = true;
            try {
              if (!stopped) {
                stopped = true;
                await qr.stop();
                await qr.clear();
              }
            } finally {
              const payload = parseQR(decoded);
              onVisit({ partnerId: payload.partnerId }); // Apps ferme l’overlay + affiche le toast
            }
          },
          () => {}
        );
      } catch (e) {
        // Fallback caméra frontale (au cas où)
        try {
          const box = Math.min(Math.floor(window.innerWidth * 0.86), 420);
          await qr.start(
            { facingMode: { ideal: 'user' } },
            { fps: 12, qrbox: { width: box, height: box } },
            async (decoded: string) => {
              if (handled) return;
              handled = true;
              try {
                if (!stopped) {
                  stopped = true;
                  await qr.stop();
                  await qr.clear();
                }
              } finally {
                const payload = parseQR(decoded);
                onVisit({ partnerId: payload.partnerId });
              }
            },
            () => {}
          );
        } catch (e2) {
          console.error('[QR] start failed', e, e2);
          setErr("Impossible d'accéder à la caméra. Vérifie l'autorisation puis réessaie.");
        }
      }
    })();

    return () => {
      (async () => {
        try {
          if (!stopped) {
            stopped = true;
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
    >
      {err ? (
        <div style={{color:'#fff', textAlign:'center', padding:12, lineHeight:1.4}}>
          {err}<br/>
          <small>Paramètres iOS ▸ Safari ▸ Caméra : Autoriser.</small>
        </div>
      ) : (
        <p style={{ color:'#fff', opacity:.7, fontSize:14 }}>Chargement de la caméra…</p>
      )}
    </div>
  );
}
