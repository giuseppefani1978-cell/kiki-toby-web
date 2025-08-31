export type Fragment = { poiId: string; who: 'kiki'|'toby' };
export type GameState = { moustaches: number; pattes: number; album: Fragment[] };

export const game: GameState = { moustaches: 0, pattes: 0, album: [] };

export function addFragment(f: Fragment) {
  game.album.push(f);
  if (f.who === 'kiki') game.moustaches += 1;
  else game.pattes += 1;
}
