import React from 'react';
import { addFragment } from '../store/game';

export default function DialogueCard(
  { kiki, toby, poiId }: { kiki: string; toby: string; poiId: string }
){
  return (
    <div className="panel" style={{background:'#fff', borderRadius:12}}>
      <p>🐱 <b>Kiki</b> — {kiki}</p>
      <p>🐶 <b>Toby</b> — {toby}</p>
      <div style={{display:'flex', gap:8}}>
        <button onClick={() => addFragment({ poiId, who:'kiki' })}>Soutenir Kiki</button>
        <button onClick={() => addFragment({ poiId, who:'toby' })}>Soutenir Toby</button>
      </div>
    </div>
  );
}
