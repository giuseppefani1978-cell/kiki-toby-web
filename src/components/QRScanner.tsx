// src/components/QRScanner.tsx
import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function parseQR(raw: string) {
  const parts = raw.trim().split('|');
  if (parts.length < 3) return null;
  const [ns, partnerId, ts] = parts;
  if (ns !== 'KT-PARTNER') return null;
  return { ns, partnerId, ts: Number(ts) || Date.now() };
}

// Try to pick the rear camera on phones
async function pickRearCamera(): Promise<MediaStreamConstraints['video']> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { facingMode: 'environment' as const };
  }
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    const cams = devs.filter(d => d.kind === 'videoinput');
    const rear = cams.find(d =>
      /back|rear|environment/i.test(d.label) || /back|rear|environment/i.test(d.deviceId)
    );
    return rear ? { deviceId: { exact: rear.deviceId } } : { facingMode: 'environment' as const };
  } catch {
    return { facingMode: 'environment' as const };
  }
}

export default function QRScanner({ onVisit }: { onVisit: (p: { partnerId: string }) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;

    // Use the visible container itself as the scan region
    const regionId = 'qr-region-' + Math.random().toString(36).slice(2);
    boxRef.current.id = regionId;

    const scanner = new Html5Qrcode(regionId);

    (async () => {
      try {
        const videoConstraints = await pickRearCamera();
        await scanner.start(
          videoConstraints,
          { fps: 10, qrbox: 250 },
          (decoded: string) => {
            const payload = parseQR(decoded);
            if (payload) {
              onVisit({ partnerId: payload.partnerId });
              scanner.stop().then(() => scanner.clear());
            }
          },
          () => {}
        );
      } catch (e) {
        console.error('QR start error', e);
      }
    })();

    return () => {
      scanner.stop().catch(() => {}).finally(() => {
        scanner.clear().catch(() => {});
      });
    };
  }, [onVisit]);

  return (
    <div
      ref={boxRef}
      style={{
        width: '100%',
        height: 320,
        background: '#000',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <p style={{ color: '#fff', opacity: 0.7, fontSize: 14 }}>Chargement de la caméra…</p>
    </div>
  );
}
