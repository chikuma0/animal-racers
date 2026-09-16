// Local pose inspection only; bundled by contact-preview.mjs, never by the app.
import { ChampionshipRenderer } from '../../src/championship/renderer';
import { ATTACKS, CHARACTERS, createMatch, type CharacterId } from '../../src/championship/simulation';

document.body.innerHTML = `<main><canvas aria-label="Runtime contact inspection"></canvas><form>
<strong>Local pose inspection · not gameplay evidence</strong>
<label>Left animal<select id="left"></select></label><label>Right animal<select id="right"></select></label>
<label>Left action<select id="action"><option value="fight_idle">Idle</option><option value="attack">Strike</option><option value="special">Special</option><option value="guard">Guard</option><option value="hit">Hit reaction</option></select></label>
<label>Right action<select id="rival"><option value="fight_idle">Idle</option><option value="guard">Guard</option><option value="attack">Strike</option></select></label>
<label>Separation (m)<input id="gap" type="number" min="0.85" max="8" step="0.05" value="1.75"></label>
<label>Action time (s)<input id="elapsed" type="number" min="0" max="5" step="0.01" value="0.20"></label>
<label>Rival time (s)<input id="rival-time" type="number" min="0" max="5" step="0.01" value="1.00"></label>
<button type="button" id="apply">Apply pose</button><button type="button" id="active">Active frame</button><button type="button" id="play">Play cycle</button><button type="button" id="save">Save frame and settings</button>
<output id="status">Loading runtime assets…</output></form></main>`;
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const left = element<HTMLSelectElement>('left'), right = element<HTMLSelectElement>('right');
for (const id of Object.keys(CHARACTERS) as CharacterId[]) {
  for (const select of [left, right]) select.add(new Option(CHARACTERS[id].name, id));
}
right.value = 'wolf';
const action = element<HTMLSelectElement>('action'), rival = element<HTMLSelectElement>('rival');
const gap = element<HTMLInputElement>('gap'), elapsed = element<HTMLInputElement>('elapsed');
const rivalTime = element<HTMLInputElement>('rival-time');
const status = element<HTMLOutputElement>('status');
const renderer = new ChampionshipRenderer(document.querySelector('canvas')!);
void renderer.load().catch(error => { status.value = `Asset load failed: ${String(error)}`; });
let match = createMatch(['lion', 'wolf']), playing = false, playTime = 0, frame = 0, previous = performance.now();
const settings = () => ({
  left: match.players[0].character, right: match.players[1].character,
  action: match.players[0].action, rival: match.players[1].action,
  gap: match.players[1].x - match.players[0].x, elapsed: match.players[0].actionTime,
  rivalTime: match.players[1].actionTime,
});
function apply() {
  playing = false;
  match = createMatch([left.value as CharacterId, right.value as CharacterId]);
  match.phase = 'fight';
  match.players.forEach((player, slot) => {
    player.x = (slot ? 1 : -1) * Math.max(.85, Math.min(8, Number(gap.value) || 1.75)) / 2;
    player.z = 0;
    player.action = slot ? rival.value : action.value;
    player.actionTime = Math.max(0, Math.min(5, Number(slot ? rivalTime.value : elapsed.value) || 0));
    player.stun = player.action === 'hit' ? .1 : 0;
  });
}
element('apply').onclick = apply;
element('active').onclick = () => {
  elapsed.value = String(action.value === 'special' ? ATTACKS[left.value as CharacterId].windup + .03 : .21);
  apply();
};
element('play').onclick = () => { apply(); playing = true; playTime = 0; };
element('save').onclick = async () => {
  if (!renderer.report().loaded) { status.value = 'Wait for asset loading before saving'; return; }
  playing = false;
  const config = settings();
  const png = await renderer.capture();
  if (!png) { status.value = 'Capture failed'; return; }
  const response = await fetch('/capture?settings=' + encodeURIComponent(JSON.stringify(config)), { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png });
  status.value = response.ok ? `Saved ${await response.text()}` : 'Capture failed';
};
document.querySelector('form')!.onsubmit = event => { event.preventDefault(); apply(); };
apply();
function render(now: number) {
  const dt = Math.min(.05, Math.max(.001, (now - previous) / 1000)); previous = now;
  if (playing) {
    playTime += dt;
    match.players[0].actionTime = playTime;
    elapsed.value = playTime.toFixed(2);
    if (playTime >= (action.value === 'guard' ? 2.4 : 1.4)) playing = false;
  }
  match.tick = ++frame;
  renderer.render(match, 0, dt, now / 1000);
  if (status.value === 'Loading runtime assets…' && renderer.report().loaded) status.value = 'Ready · authored poses only; simulation is not stepping';
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
window.addEventListener('pagehide', () => renderer.dispose(), { once: true });
