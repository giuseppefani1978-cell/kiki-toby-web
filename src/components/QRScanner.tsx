// src/components/QRScanner.tsx
import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function parseQR(raw: string) {
  const parts = raw.trim().split('|');
  if (parts.length >= 3 && parts[0] === 'KT-PARTNER') {
    return { partnerId: parts[1], ts: Number(parts[2]) || Date.now() };
  }
  return { partnerId: raw, ts: Date.now() };
}

async function pickRearCamera(): Promise<MediaStreamConstraints['video']> {
  if (!navigator.mediaDevices?.enumerateDevices)
    return { facingMode: { ideal: 'environment' } };
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

type Props = { onVisit: (p: { partnerId: string }) => void };

export default function QRScanner({ onVisit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    // Utilise le conteneur visible comme région de scan
    const id = 'qr-' + Math.random().toString(36).slice(2);
    hostRef.current.id = id;

    const qr = new Html5Qrcode(id, /* verbose */ false);

    let stopped = false;
    let handled = false;

    (async () => {
      try {
        const video = await pickRearCamera();
        const box = Math.min(Math.floor(window.innerWidth * 0.8), 360);

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
              onVisit({ partnerId: payload.partnerId });
            }
          },
          () => {}
        );
      } catch (e) {
        console.error('[QR] start error', e);
      }
    })();

    // cleanup
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
        aspectRatio: '1 / 1',
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <p style={{ color:'#fff', opacity:.7, fontSize:14 }}>Chargement de la caméra…</p>
    </div>
  );
}
