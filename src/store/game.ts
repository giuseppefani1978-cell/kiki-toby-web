// src/store/game.ts
export type Fragment = { poiId: string; who: 'kiki' | 'toby' };
export type GameState = { moustaches: number; pattes: number; album: Fragment[] };

const STORAGE_KEY = 'kt_game_v1';

export const game: GameState = { moustaches: 0, pattes: 0, album: [] };

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Partial<GameState>;
    game.album = Array.isArray(data.album) ? data.album : [];
    game.moustaches = Number(data.moustaches) || 0;
    game.pattes = Number(data.pattes) || 0;
  } catch {}
}

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    // notifie l'UI (Apps.tsx écoute cet event pour re-render)
    window.dispatchEvent(new CustomEvent('kt-game-update'));
  } catch {}
}

export function addFragment(f: Fragment) {
  game.album.push(f);
  if (f.who === 'kiki') game.moustaches += 1;
  else game.pattes += 1;
  saveGame();
}

export function clearGame() {
  game.album = [];
  game.moustaches = 0;
  game.pattes = 0;
  saveGame();
}
