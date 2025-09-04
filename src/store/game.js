export const game = { moustaches: 0, pattes: 0, album: [] };
export function addFragment(f) {
    game.album.push(f);
    if (f.who === 'kiki')
        game.moustaches += 1;
    else
        game.pattes += 1;
}
