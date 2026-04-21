// mp-data.jsx — synthetic multiplayer rooms + helpers

const MP_MODES = [
  { id: 'ffa',   label: 'FFA',        sub: 'Free-for-all', max: 8,  teams: false },
  { id: '2v2',   label: 'TEAMS 2v2',  sub: 'Two teams',    max: 4,  teams: 2 },
  { id: '3v3',   label: 'TEAMS 3v3',  sub: 'Two teams',    max: 6,  teams: 2 },
  { id: '4v4',   label: 'TEAMS 4v4',  sub: 'Two teams',    max: 8,  teams: 2 },
  { id: 'coop',  label: 'CO-OP HORDE',sub: 'vs CPU waves', max: 4,  teams: false, coop: true },
];

// 6-char base32-ish room code: no 0/O/I/1
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function rollCode(len = 6, seed = Math.random()) {
  let s = '';
  for (let i = 0; i < len; i++) {
    seed = (Math.sin(seed * 9301 + 49297 + i * 733) + 1) / 2;
    s += CODE_CHARS[Math.floor(seed * CODE_CHARS.length)];
  }
  return s;
}

const FAKE_PLAYERS = [
  'Beldin', 'Titleist', 'Vulcan', 'Astrodeath', 'Reaps', 'Ghostline',
  'Lektor', 'Hanna', 'Orvar', 'Siri', 'Fjord', 'Gnasher',
  'Pax', 'Juniper', 'Korr', 'Vel', 'Mats', 'Nanny', 'Ragn', 'Svea',
  'Dorg', 'Eskil', 'Inga', 'Rolf', 'Asta', 'Brynn',
];

const ROOM_NAMES = [
  'The Market Brawl', "Mats' Revenge Hour", 'Pure Knights Only',
  'Lepers Welcome', 'No Blinks Allowed', 'Tower vs Throne',
  'Drunk Night 6 of 12', 'Swedish Open Invitational', 'Saturday Scrims',
  'Rank Placement — Plz', 'Meta Diff Club', 'Chef Mirror Match',
  'Low Ping EU Only', 'Survival #47', 'New Players Welcome',
  'The Bog', 'Old Grove Royal', 'Midsommar Cup Qualifier',
];

function makeRoom(i, seed = i * 0.137) {
  const mode = MP_MODES[Math.floor(((Math.sin(seed * 12.9898) + 1) / 2) * MP_MODES.length)];
  const filled = 1 + Math.floor(((Math.sin(seed * 78.233) + 1) / 2) * (mode.max - 1));
  const locked = ((Math.sin(seed * 14.1) + 1) / 2) > 0.6;
  const pingBase = 12 + Math.floor(((Math.sin(seed * 3.77) + 1) / 2) * 210);
  const hostIdx = Math.floor(((Math.sin(seed * 51.3) + 1) / 2) * FAKE_PLAYERS.length);
  const nameIdx = Math.floor(((Math.sin(seed * 29.7) + 1) / 2) * ROOM_NAMES.length);
  const stageIdx = Math.floor(((Math.sin(seed * 7.11) + 1) / 2) * STAGES.length);
  const region = ['EU-N','EU-S','NA-E','NA-W','ASIA'][Math.floor(((Math.sin(seed * 5.55) + 1) / 2) * 5)];
  const state = pingBase % 3 === 0 ? 'IN BATTLE' : (filled === mode.max ? 'FULL' : 'LOBBY');
  return {
    id: `r${i}`,
    code: rollCode(6, seed * 100 + 3),
    name: ROOM_NAMES[nameIdx],
    host: FAKE_PLAYERS[hostIdx],
    mode,
    filled, max: mode.max,
    locked,
    ping: pingBase,
    region,
    stageId: STAGES[stageIdx].id,
    state,
  };
}

const MP_ROOMS = Array.from({ length: 18 }, (_, i) => makeRoom(i, i * 0.137 + 1));

Object.assign(window, { MP_MODES, MP_ROOMS, FAKE_PLAYERS, rollCode });
