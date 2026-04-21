// stages.jsx — stage roster. Each stage is themed to a Nannymud location.

const STAGES = [
  { id: 'market',   name: 'Market Square',     sub: 'Town · daylight',    hue: 40,  flavor: 'Barrow-walls and bread-smoke. Neutral ground.' },
  { id: 'assembly', name: 'Assembly Hall',     sub: 'Knights · stone',    hue: 210, flavor: 'Banners for kings who died before their words were written.' },
  { id: 'tower',    name: 'The Mages Tower',   sub: 'Mages · arcane',     hue: 260, flavor: 'Candles that burn without wax. Do not linger at the windows.' },
  { id: 'grove',    name: 'Old Grove',         sub: 'Druids · wild',      hue: 140, flavor: 'Older than the road that leads to it.' },
  { id: 'wilds',    name: 'Northern Wilds',    sub: 'Hunters · tundra',   hue: 75,  flavor: 'Snow keeps every track for a full winter.' },
  { id: 'cloister', name: 'Stone Cloister',    sub: 'Monks · temple',     hue: 40,  flavor: 'Still water, still breath, still blade.' },
  { id: 'longship', name: 'Longship Dock',     sub: 'Vikings · fjord',    hue: 0,   flavor: 'A shield-wall can be built at sea too.' },
  { id: 'altar',    name: 'High Altar',        sub: 'Prophets · vigil',   hue: 185, flavor: 'Where the signs are read before the battle speaks them.' },
  { id: 'crypt',    name: 'Moonless Crypt',    sub: 'Vampires · dusk',    hue: 330, flavor: "A door for those with keys. A door for those without." },
  { id: 'shore',    name: 'Drowned Shore',     sub: 'Cult · coast',       hue: 300, flavor: 'The tide comes in with names it should not know.' },
  { id: 'throne',   name: 'Red Throne',        sub: 'Champions · keep',   hue: 15,  flavor: 'Blood for the throne. The throne remembers the tally.' },
  { id: 'library',  name: 'Black Library',     sub: 'Darkmages · vault',  hue: 275, flavor: 'Books read you back here.' },
  { id: 'kitchen',  name: 'Great Kitchen',     sub: 'Chefs · hearth',     hue: 50,  flavor: 'Where steel is judged against the pot, not the foe.' },
  { id: 'colony',   name: 'Lepers Colony',     sub: 'Lepers · waste',     hue: 95,  flavor: 'The rot negotiates with nothing.' },
  { id: 'ascent',   name: 'Mount of Masters',  sub: 'Masters · summit',   hue: 170, flavor: "The last hall before the title you won't keep." },
];

Object.assign(window, { STAGES });
