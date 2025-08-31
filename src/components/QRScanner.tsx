import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

function parseQR(raw: string) {
  const parts = raw.split('|');
  if (parts.length < 3) return null;
  const [ns, partnerId, ts] = parts;
  if (ns !== 'KT-PARTNER') return null;
  return { ns, partnerId, ts: Number(ts)||Date.now() };
}

async function pickRearCamera(): Promise<MediaStreamConstraints['video']> {
  if (!navigator.mediaDevices?.enumerateDevices) return { facingMode: 'environment' as const };
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

export default function QRScanner({ onVisit }: { onVisit: (p:{partnerId:string})=>void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scanner, setScanner] = useState<Html5Qrcode|null>(null);

  useEffect(() => {
    const id = 'qr-region-' + Math.random().toString(36).slice(2);
    const el = document.createElement('div');
    el.id = id;
    ref.current?.appendChild(el);

    const s = new Html5Qrcode(id);
    setScanner(s);

    (async () => {
      try {
        const videoConstraints = await pickRearCamera();
        await s.start(
          videoConstraints,
          { fps: 10, qrbox: 250 },
          (decoded: string) => {
            const payload = parseQR(decoded);
            if (payload) {
              onVisit({ partnerId: payload.partnerId });
              s.stop().then(()=> s.clear());
            }
          },
          () => {}
        );
      } catch (e) { console.error(e); }
    })();

    return () => { s.stop().catch(()=>{}); s.clear().catch(()=>{}); };
  }, []);

  return <div ref={ref} style={{width:'100%', height:320}} />;
}
