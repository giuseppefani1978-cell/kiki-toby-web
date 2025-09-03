// src/components/QRScanner.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function parseQR(raw: string) {
  const parts = raw.trim().split('|');
  if (parts.length >= 3 && parts[0] === 'KT-PARTNER') {
    return { partnerId: parts[1], ts: Number(parts[2]) || Date.now() };
  }
  // fallback: accepte n'importe quel QR comme partnerId brut
  return { partnerId: raw, ts: Date.now() };
}

async function pickRearCamera(): Promise<MediaStreamConstraints['video']> {
  if (!navigator.mediaDevices?.enumerateDevices) return { facingMode: { ideal: 'environment' } };
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const cams = devs.filter(d => d.kind === 'videoinput');
    const rear = cams.find(d => /back|rear|environment/i.test(d.label) || /back|rear|environment/i.test(d.deviceId));
    return rear ? { deviceId: { exact: rear.deviceId } } : { facingMode: { ideal: 'environment' } };
  } catch {
    return { facingMode: { ideal: 'environment' } };
  }
}

type Props = { onVisit: (p: { partnerId: string }) => void };

export default function QRScanner({ onVisit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [inst, setInst] = useState<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);       // évite stop/clear multiples
  const handledOnceRef = useRef(false);   // évite callback multiple

  useEffect(() => {
    if (!hostRef.current) return;

    const id = 'qr-' + Math.random().toString(36).slice(2);
    const region = document.createElement('div');
    region.id = id;
    region.className = 'qr-region';
    hostRef.current.appendChild(region);

    const qr = new Html5Qrcode(id, /*verbose*/ false);
    setInst(qr);

    (async () => {
      try {
        const video = await pickRearCamera();
        const box = Math.min(Math.floor(window.innerWidth * 0.8), 360); // cadre plus grand

        await qr.start(
          video,
          { fps: 12, qrbox: { width: box, height: box } },
          async (decoded: string) => {
            if (handledOnceRef.current) return;
            handledOnceRef.current = true;

            // stop/clear une seule fois, et séquencé
            try {
              if (!stoppedRef.current) {
                stoppedRef.current = true;
                await qr.stop();
                await qr.clear();
              }
            } catch {/* ignore */}

            const payload = parseQR(decoded);
            if (payload) onVisit({ partnerId: payload.partnerId });
          },
          () => {}
        );
      } catch (e) {
        console.error('[QR] start error', e);
      }
    })();

    // cleanup robuste
    return () => {
      (async () => {
        try {
          if (!stoppedRef.current && inst) {
            stoppedRef.current = true;
            await inst.stop();
            await inst.clear();
          }
        } catch {/* ignore */}
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className="qr-region"
      style={{
        width: '100%', maxWidth: 680, aspectRatio: '1 / 1',
        background: '#000', borderRadius: 8, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <p style={{ color:'#fff', opacity:.7, fontSize:14 }}>Chargement de la caméra…</p>
    </div>
  );
}
