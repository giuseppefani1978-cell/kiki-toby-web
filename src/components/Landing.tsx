// src/components/Landing.tsx
import React from 'react';

type Props = {
  onStart: () => void;
};

export default function Landing({ onStart }: Props) {
  const base = import.meta.env.BASE_URL || '/';

  return (
    <div
      className="safe"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px 16px',
        background:
          'radial-gradient(1200px 600px at 60% -10%, rgba(59,130,246,.25), transparent), linear-gradient(180deg, #0b0d10 0%, #0b0d10 60%, #0e1116 100%)',
        color: '#fff',
      }}
    >
      <div
        className="landing-card"
        style={{
          width: 'min(880px, 96vw)',
          borderRadius: 16,
          background: 'rgba(17, 24, 39, .75)',
          boxShadow: '0 10px 30px rgba(0,0,0,.35)',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,.06)',
        }}
      >
        {/* Bandeau visuel */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,.05), transparent)',
          }}
        >
          <figure
            style={{
              margin: 0,
              padding: 24,
              display: 'grid',
              placeItems: 'center',
              borderRight: '1px solid rgba(255,255,255,.06)',
            }}
          >
            <img
              src={`${base}avatars/kiki.png`}
              alt="Kiki"
              width={200}
              height={200}
              style={{ imageRendering: 'pixelated', maxWidth: '60%', height: 'auto' }}
              onError={(e: any) => (e.currentTarget.style.display = 'none')}
            />
            <figcaption style={{ marginTop: 8, opacity: .8 }}>Kiki</figcaption>
          </figure>

          <figure
            style={{
              margin: 0,
              padding: 24,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <img
              src={`${base}avatars/toby.png`}
              alt="Toby"
              width={200}
              height={200}
              style={{ imageRendering: 'pixelated', maxWidth: '60%', height: 'auto' }}
              onError={(e: any) => (e.currentTarget.style.display = 'none')}
            />
            <figcaption style={{ marginTop: 8, opacity: .8 }}>Toby</figcaption>
          </figure>
        </div>

        {/* Contenu texte */}
        <div style={{ padding: '20px 20px 16px 20px' }}>
          <h1
            style={{
              margin: '6px 4px 0',
              fontSize: 'clamp(24px, 3.2vw, 36px)',
              lineHeight: 1.2,
              letterSpacing: .3,
            }}
          >
            Kiki & Toby — Promenades parisiennes
          </h1>

          <p
            style={{
              margin: '6px 4px 14px',
              fontSize: 'clamp(14px, 1.8vw, 18px)',
              opacity: .9,
              fontStyle: 'italic',
            }}
          >
            d’après Colette
          </p>

          <p style={{ margin: '8px 4px 16px', opacity: .9 }}>
            Explore Paris avec Kiki 🐱 et Toby 🐶, échange quelques répliques sous les
            réverbères, puis élance-toi dans de petits runs urbains pour récolter des
            récompenses. Évite les pigeons, saute sur les rats comme dans un jeu de
            plateforme classique, et attrape un maximum de pièces !
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <button
              type="button"
              onClick={onStart}
              className="primary"
              style={{
                border: 'none',
                borderRadius: 999,
                background: 'rgba(59,130,246,.95)',
                color: '#fff',
                padding: '12px 18px',
                fontSize: 16,
                cursor: 'pointer',
              }}
            >
              Commencer l’aventure
            </button>

            <span style={{ alignSelf: 'center', opacity: .75, fontSize: 13 }}>
              Conseil : active le son et prépare tes pouces !
            </span>
          </div>
        </div>
      </div>

      {/* petit crédit discret */}
      <div style={{ marginTop: 18, fontSize: 12, opacity: .6 }}>
        © {new Date().getFullYear()} — Projet Kiki & Toby
      </div>
    </div>
  );
}
