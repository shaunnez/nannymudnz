"""
Generate combined sprite gallery + guild VFX mapping page.
Run: python3 scripts/gen_guild_map.py
"""
import os, base64, re
from PIL import Image

EXISTING = 'C:/Users/nimbl/projects/nannymud/public/vfx/effects'
SHEETS   = 'C:/Users/nimbl/projects/nannymud/public/vfx/packs/sheets'
OUT      = ('C:/Users/nimbl/projects/nannymud/.superpowers/brainstorm/'
            '88363-1777256499/content/guild-map.html')
OUT_SAVE = 'C:/Users/nimbl/projects/nannymud/docs/vfx/guild-vfx-map.html'

CATALOG = {
    'slash_1':(12,1280,720,35,'e'),'slash_2':(9,1280,720,35,'e'),
    'slash_3':(12,1280,720,35,'e'),'slash_4':(12,1280,720,35,'e'),
    'slash_5':(11,568,395,35,'e'),'slash_6':(11,1280,720,35,'e'),
    'slash_7':(6,1280,720,35,'e'),'slash_8':(8,1280,720,35,'e'),
    'slash_9':(9,1280,720,35,'e'),'slash_10':(10,662,506,35,'e'),
    'explosion_1':(10,550,550,60,'e'),'explosion_2':(10,520,520,60,'e'),
    'explosion_3':(10,680,680,60,'e'),'explosion_5':(10,640,640,60,'e'),
    'explosion_6':(10,760,760,60,'e'),'explosion_8':(10,700,700,60,'e'),
    'explosion_9':(10,800,800,60,'e'),'explosion_10':(10,615,615,60,'e'),
    'fire_arrow':(8,0,0,60,'s'),'fire_ball':(8,0,0,60,'s'),
    'fire_spell':(8,0,0,60,'s'),'water_arrow':(8,0,0,60,'s'),
    'water_ball':(12,0,0,60,'s'),'water_spell':(8,0,0,60,'s'),
    'flame1':(28,0,0,60,'s'),'flame2':(16,0,0,60,'s'),'flame3':(32,0,0,60,'s'),
    'flame4':(32,0,0,60,'s'),'flame5':(32,0,0,60,'s'),'flame6':(18,0,0,60,'s'),
    'flame8':(32,0,0,60,'s'),'flame9':(31,0,0,60,'s'),'flame10':(32,0,0,60,'s'),
    'water1':(32,0,0,60,'s'),'water2':(17,0,0,60,'s'),'water3':(23,0,0,60,'s'),
    'water4':(16,0,0,60,'s'),'water5':(31,0,0,60,'s'),'water6':(12,0,0,60,'s'),
    'water7':(14,0,0,60,'s'),'water8':(21,0,0,60,'s'),'water9':(32,0,0,60,'s'),
    'water10':(14,0,0,60,'s'),
}

GALLERY_H = 56
GUILD_H   = 88

# ── Color → CSS filter (approximate hue tinting for preview) ─────────────────
def color_filter(hex_color):
    hue_map = {
        '#93c5fd': 'hue-rotate(195deg) saturate(1.8) brightness(1.1)',   # ice blue
        '#86efac': 'hue-rotate(105deg) saturate(1.6)',                   # nature green
        '#84cc16': 'hue-rotate(80deg) saturate(1.4) brightness(0.9)',    # leper green
        '#a855f7': 'hue-rotate(255deg) saturate(1.8)',                   # cultist purple
        '#7c3aed': 'hue-rotate(245deg) saturate(1.6)',                   # darkmage purple
        '#dc2626': 'hue-rotate(340deg) saturate(1.8)',                   # vampire red
        '#ef4444': 'hue-rotate(340deg) saturate(1.6)',                   # viking red
        '#b91c1c': 'hue-rotate(335deg) saturate(1.5)',                   # champion red
        '#fde68a': 'hue-rotate(25deg) saturate(1.4) brightness(1.1)',    # holy gold
        '#fbbf24': 'hue-rotate(20deg) saturate(1.5)',                    # monk gold
        '#c9a961': 'hue-rotate(15deg) saturate(1.2)',                    # adventurer gold
        '#f97316': 'hue-rotate(10deg) saturate(1.6)',                    # chef orange
        '#5eead4': 'hue-rotate(150deg) saturate(1.4)',                   # hunter teal
        '#e2e8f0': 'saturate(0.2) brightness(1.3)',                      # master silver
    }
    return hue_map.get(hex_color, '')

# ── Load sprites ──────────────────────────────────────────────────────────────
sprite_info = {}
for key, (frames, fw, fh, ms, src) in CATALOG.items():
    ak = re.sub(r'[^a-z0-9]', '', key)
    if src == 'e':
        raw  = open(os.path.join(EXISTING, key+'.png'), 'rb').read()
        b64  = base64.b64encode(raw).decode()
        scale = GALLERY_H / fh
        fw_g  = int(fw * scale)
        fh_g  = GALLERY_H
    else:
        path = os.path.join(SHEETS, key+'_preview.png')
        img  = Image.open(path)
        pw, ph = img.size
        raw  = open(path, 'rb').read()
        b64  = base64.b64encode(raw).decode()
        fw_g  = pw // frames
        fh_g  = ph
    sprite_info[key] = dict(b64=b64, frames=frames, fw_g=fw_g, fh_g=fh_g, ms=ms, ak=ak)

# ── CSS ───────────────────────────────────────────────────────────────────────
def make_css():
    parts = [':root{']
    for key, s in sprite_info.items():
        parts.append(f'--img-{s["ak"]}:url(\'data:image/png;base64,{s["b64"]}\');')
    parts.append('}')
    for key, s in sprite_info.items():
        total = s['fw_g'] * s['frames']
        parts.append(f'@keyframes g{s["ak"]}{{to{{background-position:-{total}px 0}}}}')
    for key, s in sprite_info.items():
        scale = GUILD_H / s['fh_g']
        dw    = int(s['fw_g'] * scale)
        total = dw * s['frames']
        parts.append(f'@keyframes r{s["ak"]}{{to{{background-position:-{total}px 0}}}}')
    return '\n'.join(parts)

# ── Element builders ──────────────────────────────────────────────────────────
def gallery_el(key):
    s   = sprite_info[key]
    dur = s['frames'] * s['ms']
    return (f'<div style="display:inline-block;text-align:center;margin:0 3px 5px;flex-shrink:0">'
            f'<div style="width:{s["fw_g"]}px;height:{s["fh_g"]}px;overflow:hidden;border-radius:3px;background:#04040a">'
            f'<div style="width:{s["fw_g"]}px;height:{s["fh_g"]}px;background-image:var(--img-{s["ak"]});'
            f'background-size:auto {s["fh_g"]}px;animation:g{s["ak"]} {dur}ms steps({s["frames"]}) infinite"></div></div>'
            f'<div style="font-size:7px;color:#555;margin-top:2px;max-width:{max(s["fw_g"],36)}px">{key}</div></div>')

def guild_el(key, sub='', guild_color='', rotate='', gc=''):
    s     = sprite_info[key]
    scale = GUILD_H / s['fh_g']
    dw    = int(s['fw_g'] * scale)
    dur   = s['frames'] * s['ms']
    guild_color = guild_color or gc
    filt  = color_filter(guild_color) if guild_color else ''
    rot   = f'transform:rotate({rotate});' if rotate else ''
    return (f'<div style="display:inline-block;text-align:center;vertical-align:top;margin:0 4px">'
            f'<div style="width:{dw}px;height:{GUILD_H}px;overflow:hidden;border-radius:4px;background:#04040a;{rot}">'
            f'<div style="width:{dw}px;height:{GUILD_H}px;background-image:var(--img-{s["ak"]});'
            f'background-size:auto {GUILD_H}px;animation:r{s["ak"]} {dur}ms steps({s["frames"]}) infinite;'
            f'{"filter:"+filt+";" if filt else ""}"></div></div>'
            f'<div style="font-size:9px;color:#aaa;margin-top:3px">{key}</div>'
            f'{"<div style=font-size:8px;color:#6a5fd8>"+sub+"</div>" if sub else ""}</div>')

def proc_el(event, color='#555'):
    icons = {'heal_glow':'green orbs','aura_pulse':'dashed ring','hit_spark':'burst',
             'aoe_pop':'ring+sparks','channel_pulse':'pulse','blink_trail':'trail','zone_pulse':'ground zone'}
    return (f'<div style="display:inline-block;text-align:center;vertical-align:top;margin:0 4px">'
            f'<div style="width:60px;height:{GUILD_H}px;border:1px dashed rgba(255,255,255,0.12);'
            f'border-radius:4px;display:inline-flex;align-items:center;justify-content:center;flex-direction:column;gap:3px">'
            f'<div style="font-size:16px;color:{color}">&#9672;</div>'
            f'<div style="font-size:8px;color:#555;text-align:center;padding:0 4px">{icons.get(event,event)}</div>'
            f'</div><div style="font-size:9px;color:#666;margin-top:3px">procedural</div></div>')

def row(name, tags, desc, *cells, pos='', note='', flag=False, gc=''):
    TAG_C = {'Melee':'#f87171','Ranged':'#7dd3fc','AoE':'#fb923c','Buff':'#fde68a',
             'Heal':'#6ee7b7','Channel':'#c4b5fd','RMB':'#a78bfa','Zone':'#fb923c',
             'Summon':'#e879f9','Dash':'#fb923c','Debuff':'#f87171','Aura':'#a78bfa'}
    tag_h  = ''.join(f'<span style="font-size:8px;padding:1px 5px;border-radius:3px;'
                     f'background:{TAG_C.get(t,"#444")}22;color:{TAG_C.get(t,"#888")};margin-right:3px">{t}</span>'
                     for t in tags)
    pos_h  = (f'<span style="font-size:8px;color:#f59e0b;display:block;margin-bottom:5px">&#128205; {pos}</span>'
              if pos else '')
    note_h = f'<div style="font-size:9px;color:#6a5fd8;margin-top:4px">&#8627; {note}</div>' if note else ''
    flag_h = f'<div style="font-size:9px;color:#f59e0b;margin-top:3px">&#10067; Needs review</div>' if flag else ''
    left_border = '3px solid #f59e0b' if flag else '1px solid transparent'
    cells_h = ''.join(cells)
    return (f'<div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;'
            f'padding:9px 12px;background:rgba(255,255,255,0.02);'
            f'border:1px solid rgba(255,255,255,.06);border-left:{left_border};'
            f'border-radius:7px;margin-bottom:6px">'
            f'<div><div style="font-size:12px;font-weight:600;color:#eee;margin-bottom:2px">{name} {tag_h}</div>'
            f'<div style="font-size:11px;color:#666">{desc}</div>{note_h}{flag_h}</div>'
            f'<div style="text-align:right">{pos_h}{cells_h}</div></div>')

def guild_hdr(name, sub, color):
    return (f'<div style="display:flex;align-items:center;gap:10px;padding:9px 13px;'
            f'background:rgba(255,255,255,0.02);border-left:4px solid {color};'
            f'border-radius:6px;margin:18px 0 10px">'
            f'<div><div style="font-size:15px;font-weight:700;color:{color}">{name}</div>'
            f'<div style="font-size:10px;color:#555">{sub}</div></div></div>')

def sub_hdr(name, color):
    return (f'<div style="font-size:11px;font-weight:600;color:{color};'
            f'padding:5px 10px;background:rgba(255,255,255,0.03);'
            f'border-radius:5px;margin:10px 0 6px;border-left:3px solid {color}">{name}</div>')

# Shortcuts
G  = guild_hdr
SH = sub_hdr
R  = row
E  = guild_el
P  = proc_el

# ── Gallery strips ────────────────────────────────────────────────────────────
def gallery_strip(keys, label):
    cells = ''.join(gallery_el(k) for k in keys)
    return (f'<div style="margin-bottom:10px">'
            f'<div style="font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#555;margin-bottom:4px">{label}</div>'
            f'<div style="display:flex;flex-wrap:wrap;gap:2px">{cells}</div></div>')

slash_keys = [f'slash_{i}' for i in range(1,11)]
expl_keys  = ['explosion_1','explosion_2','explosion_3','explosion_5','explosion_6',
              'explosion_8','explosion_9','explosion_10']
p1_keys    = ['fire_arrow','fire_ball','fire_spell','water_arrow','water_ball','water_spell']
flame_keys = ['flame1','flame2','flame3','flame4','flame5','flame6','flame8','flame9','flame10']
water_keys = ['water1','water2','water3','water4','water5','water6','water7','water8','water9','water10']

gallery_html = (gallery_strip(slash_keys,'Slashes') +
                gallery_strip(expl_keys,'Explosions') +
                gallery_strip(p1_keys,'Pack 1 — Water &amp; Fire Magic') +
                gallery_strip(flame_keys,'Pack 2 — Flame Effects') +
                gallery_strip(water_keys,'Pack 3 — Water Effects'))

ARCHETYPES = [
    ('hit_spark','#f87171','burst sparks'),('aoe_pop','#fb923c','ring+sparks'),
    ('heal_glow','#4ade80','orbs up'),('aura_pulse','#a78bfa','dashed ring'),
    ('channel_pulse','#60a5fa','pulse repeat'),('blink_trail','#e879f9','trail'),
    ('zone_pulse','#fb923c','ground zone'),
]
arch_html = ''.join(
    f'<div style="text-align:center;min-width:68px">'
    f'<div style="height:48px;border:1px solid rgba(255,255,255,0.1);border-radius:5px;'
    f'background:#03030c;display:flex;align-items:center;justify-content:center">'
    f'<div style="font-size:18px;color:{c}">&#9672;</div></div>'
    f'<div style="font-size:9px;font-weight:600;color:{c};margin-top:3px">{t}</div>'
    f'<div style="font-size:8px;color:#444;margin-top:1px">{d}</div></div>'
    for t,c,d in ARCHETYPES)

# ══════════════════════════════════════════════════════════════════════════════
# GUILD DATA
# ══════════════════════════════════════════════════════════════════════════════
guilds_html = ''

# ── ADVENTURER (#c9a961) ──────────────────────────────────────────────────────
C = '#c9a961'
guilds_html += G('ADVENTURER','STR 14 · DEX 12 · CON 14 · HP 520 · Stamina', C)
guilds_html += R('Rallying Cry',['Buff','AoE'],'aoe_pop on caster', E('explosion_2',gc=C), pos='under feet')
guilds_html += R('Slash',['Melee'],'Combo progression',
    E('slash_5','hit 1',C), E('slash_8','hit 2',C), E('slash_6','finisher',C),
    pos='on target', note='slash_5 → slash_8 → slash_6')
guilds_html += R('Bandage',['Heal','Channel'],'Self-heal channel 1.5s', P('heal_glow','#4ade80'), pos='above head')
guilds_html += R('Quickshot',['Ranged'],'Arrow impact — fire_arrow tiny', E('fire_arrow','~40% scale',C), pos='on target')
guilds_html += R('Adrenaline Rush',['Buff'],'Self burst', E('explosion_3',gc=C), pos='under feet')
guilds_html += R('Second Wind',['RMB'],'Stamina restore', P('aura_pulse',C), pos='under feet')

# ── KNIGHT (#fde68a) ──────────────────────────────────────────────────────────
C = '#fde68a'
guilds_html += G('KNIGHT','STR 14 · CON 18 · HP 580 · Resolve', C)
guilds_html += R('Holy Rebuke',['AoE'],'Holy burst 120u, stun 1s', E('explosion_8',gc=C), pos='under feet')
guilds_html += R('Valorous Strike',['Melee'],'Single melee hit', E('slash_6',gc=C), pos='on target')
guilds_html += R('Taunt',['AoE'],'Force attack Knight 3s', E('explosion_10',gc=C), pos='under feet')
guilds_html += R('Shield Wall',['Buff','AoE'],'30% dmg reduction aura', E('flame6',gc=C),
    pos='on caster', note='flame6 placeholder — ideally shield asset', flag=True)
guilds_html += R('Last Stand',['Buff'],'5s immortality', E('explosion_3',gc=C), pos='under feet')
guilds_html += R('Shield Block',['RMB','Buff'],'30% dmg reduction 2s', E('flame6',gc=C),
    pos='on caster', note='Same as Shield Wall at smaller scale', flag=True)

# ── MAGE (#93c5fd — ice blue) ─────────────────────────────────────────────────
C = '#93c5fd'
guilds_html += G('MAGE','INT 20 · HP 490 · Mana', C)
guilds_html += R('Ice Nova',['AoE'],'Ice burst 120u, root 1.5s', E('water4',gc=C), pos='under feet')
guilds_html += R('Frostbolt',['Ranged'],'Projectile, slow 30% on land', E('flame10',gc=C),
    pos='on target', note='flame10 tinted ice-blue = cold impact shard burst')
guilds_html += R('Blink',['Dash'],'240u teleport', P('blink_trail',C), pos='trail')
guilds_html += R('Arcane Shard',['Ranged'],'Piercing hit', E('water_arrow',gc=C), pos='on target')
guilds_html += R('Meteor',['Channel','AoE'],'1.2s cast → 200 DMG',
    P('channel_pulse',C), E('fire_spell',gc=C), E('explosion_1',gc=C),
    pos='target ground', note='channel_pulse → fire_spell on arrival → explosion_1 on impact')
guilds_html += R('Short Teleport',['RMB'],'120u teleport',
    P('blink_trail',C), E('explosion_6',gc=C),
    pos='leave+arrive', note='blink_trail + explosion_6 at departure and arrival')

# ── DRUID (#86efac — nature green) ────────────────────────────────────────────
C = '#86efac'
guilds_html += G('DRUID','WIS 18 · HP 440 · Essence', C)
guilds_html += SH('Human Form', C)
guilds_html += R('Wild Growth',['Heal','AoE'],'AoE HoT 15/s × 5s', E('explosion_8',gc=C), pos='under feet')
guilds_html += R('Entangle',['Ranged','Control'],'Root projectile 2s', E('flame4',gc=C), pos='on target')
guilds_html += R('Rejuvenate',['Heal'],'HoT on nearest ally', E('water9',gc=C),
    pos='above head', note='water9 small scale above target')
guilds_html += R('Cleanse',['Heal'],'Heal + remove 2 debuffs', E('flame6',gc=C), pos='under feet')
guilds_html += R('Tranquility',['Channel','AoE'],'Channel 4s, AoE heal',
    P('channel_pulse',C), E('water10',gc=C), E('flame2',gc=C),
    pos='caster + allies', note='water10 pulsing on caster → flame2 above each ally on heal tick')
guilds_html += R('Shapeshift',['RMB'],'Toggle wolf form', E('water6',gc=C), pos='on caster')

guilds_html += SH('Wolf Form', '#a3e635')
WC = '#a3e635'
guilds_html += R('Maul',['Melee'],'55 DMG, knockdown', E('slash_6',gc=WC), pos='on target')
guilds_html += R('Charge',['Dash','Melee'],'180u dash, 35 DMG, knockup', E('water5',gc=WC), pos='on impact')
guilds_html += R('Roar',['AoE'],'Slow 40%, fear 1s', E('water_spell',gc=WC), pos='around caster', note='Nature burst — no big explosion')
guilds_html += R('Rend',['Melee'],'20 DMG + bleed DoT', E('slash_8',gc=WC), pos='on target')
guilds_html += R('Primal Fury',['Buff'],'6s +40% dmg, +20% speed', E('water4',gc=WC), pos='under feet')
guilds_html += R('Revert',['RMB'],'Exit wolf form', E('water6',gc=WC), pos='on caster')

# ── HUNTER (#5eead4) ──────────────────────────────────────────────────────────
C = '#5eead4'
guilds_html += G('HUNTER','DEX 18 · HP 450 · Focus', C)
guilds_html += R('Disengage',['AoE'],'Leap 150u, blind smoke', P('aoe_pop',C), pos='landing zone')
guilds_html += R('Piercing Volley',['Ranged'],'3-arrow piercing line',
    E('water_arrow',gc=C), pos='on each hit', note='water_arrow × 3 rapid hits (like arcane shard)')
guilds_html += R('Aimed Shot',['Ranged'],'0.2s draw, +15% crit',
    E('explosion_2',gc=C), E('water_arrow',gc=C),
    pos='on target', note='explosion_2 under feet on fire → water_arrow impact on land')
guilds_html += R('Bear Trap',['Zone'],'Root 1.5s on trigger',
    P('zone_pulse',C), E('explosion_2',gc=C),
    pos='ground', note='zone_pulse marker → explosion_2 when triggered')
guilds_html += R('Rain of Arrows',['Channel','AoE'],'Channel 3s, 6 pulses, slow',
    P('channel_pulse',C), E('water3',gc=C),
    pos='target zone', note='channel_pulse overhead → water3 per arrow impact')
guilds_html += R('Pet Command',['RMB'],'Move pet / cycle AI', P('aura_pulse',C), pos='on pet')

# ── MONK (#fbbf24) ────────────────────────────────────────────────────────────
C = '#fbbf24'
guilds_html += G('MONK','DEX 18 · WIS 14 · HP 470 · Chi', C)
guilds_html += R('Serenity',['Buff'],'Untargetable 1s, cleanse, +30% speed', E('water6',gc=C), pos='on caster')
guilds_html += R('Flying Kick',['Melee','Dash'],'150u dash, knockup', E('water5',gc=C), pos='on target')
guilds_html += R('Jab',['Melee'],'Light hit, generates 1 Chi', E('slash_7',gc=C), pos='on target')
guilds_html += R('Five-Point Palm',['Melee'],'Cost 2 Chi, detonates +40 dmg 4s later',
    E('slash_4',gc=C), E('explosion_5',gc=C),
    pos='on target', note='slash_4 on strike → explosion_5 on detonation 4s later')
guilds_html += R('Dragon\'s Fury',['Channel','Melee'],'Channel 2s, 5 strikes + stun',
    P('channel_pulse',C), E('flame9',gc=C), E('slash_4',gc=C), E('explosion_5',gc=C),
    pos='cone', note='channel_pulse + flame9 under caster → slash_4 per strike → explosion_5 under target per hit')
guilds_html += R('Parry',['RMB'],'0.3s parry window, stun on success', E('slash_7',gc=C), pos='on caster')

# ── VIKING (#ef4444 — red) ────────────────────────────────────────────────────
C = '#ef4444'
guilds_html += G('VIKING','STR 18 · CON 16 · HP 410 · Rage', C)
guilds_html += R('Whirlwind',['Channel','AoE'],'Channel 2s, AoE 100u, lifesteal',
    E('flame3',gc=C), pos='around caster', note='flame3 spinning — red-tinted Viking rage')
guilds_html += R('Harpoon',['Ranged'],'Pull target 120u', E('fire_arrow',gc=C), pos='on target')
guilds_html += R('Bloodlust',['Buff'],'Cost 30, +20% atk speed 5s, lifesteal',
    E('explosion_3',gc=C), pos='under feet', note='explosion_3 red-tinted (Viking stays red)')
guilds_html += R('Axe Swing',['Melee'],'Cone 60u, builds rage', E('slash_6',gc=C),
    pos='on target', note='slash_6 — single heavy swing')
guilds_html += R('Undying Rage',['Buff'],'3s cannot die, dmg→heal on expiry', E('explosion_10',gc=C), pos='under feet')
guilds_html += R('Shield Bash',['RMB','Melee'],'Knockback 150u',
    E('slash_8',gc=C), E('explosion_5',gc=C), pos='on target')

# ── PROPHET (#fde68a — holy gold) ─────────────────────────────────────────────
C = '#fde68a'
guilds_html += G('PROPHET','WIS 18 · CHA 16 · HP 500 · Faith', C)
guilds_html += R('Prophetic Shield',['Buff'],'Absorb 120 dmg shield', E('water6',gc=C), pos='on caster', flag=True)
guilds_html += R('Smite',['Ranged'],'90 DMG, reveals 3s', E('explosion_6',gc=C), pos='on target')
guilds_html += R('Bless',['Buff'],'Target +15% dmg +10% speed 8s', E('flame6',gc=C), pos='above target head')
guilds_html += R('Curse',['Debuff'],'Target +20% dmg taken, -15% dmg dealt', P('aura_pulse','#7c3aed'), pos='on target')
guilds_html += R('Divine Intervention',['Buff'],'Invulnerable 3s, heal to 100% on expiry',
    E('flame6',gc=C), E('water10',gc=C),
    pos='on target', note='flame6 + water10 together on the protected ally')
guilds_html += R('Divine Insight',['RMB','AoE'],'Reveal enemies 360u 4s', E('water4',gc=C), pos='under feet')

# ── VAMPIRE (#dc2626 — crimson) ───────────────────────────────────────────────
C = '#dc2626'
guilds_html += G('VAMPIRE','DEX 16 · CHA 14 · HP 530 · Bloodpool', C)
guilds_html += R('Hemorrhage',['Ranged'],'DoT, heals Vampire', E('water3',gc=C), pos='on target', note='water3 blood-red tinted')
guilds_html += R('Shadow Step',['Dash'],'240u teleport, 1s stealth', P('blink_trail',C), pos='trail')
guilds_html += R('Blood Drain',['Channel'],'Channel 2s, full heal', E('water7',gc=C),
    pos='between caster+target', note='water7 as blood drain visual', flag=True)
guilds_html += R('Fang Strike',['Melee'],'30% lifesteal', E('slash_6',gc=C), pos='on target')
guilds_html += R('Nocturne',['Buff'],'6s invisible, +50% speed', E('flame2',gc=C), pos='on caster')
guilds_html += R('Mist Step',['RMB'],'180u teleport, 1s stealth',
    P('blink_trail',C), E('explosion_2',gc=C),
    pos='leave+arrive', note='blink_trail + small explosion_2 at departure and arrival')

# ── CULTIST (#a855f7 — purple) ────────────────────────────────────────────────
C = '#a855f7'
guilds_html += G('CULTIST','INT 18 · CHA 14 · HP 300 · Sanity', C)
guilds_html += R('Summon Spawn',['Summon'],'150HP spawn 20s', E('explosion_5',gc=C), pos='spawn point')
guilds_html += R('Whispers',['Ranged'],'Silence 1s', E('water_arrow',gc=C), pos='on target')
guilds_html += R('Madness',['AoE'],'Stun 0.8s, DoT', E('explosion_8',gc=C), pos='on target')
guilds_html += R('Tendril Grasp',['Zone'],'Root + necrotic DoT',
    P('zone_pulse',C), E('flame4',gc=C),
    pos='ground zone', note='zone_pulse + flame4 pulsing on zone')
guilds_html += R('Open the Gate',['Channel','AoE'],'Pull to center, knockdown',
    P('channel_pulse',C), E('flame9',gc=C), E('explosion_10',gc=C),
    pos='target zone', note='channel_pulse → flame9 large under caster → explosion_10 on release')
guilds_html += R('Gaze into Abyss',['RMB','Buff'],'Next ability free +30% dmg', E('flame6',gc=C), pos='on caster')

# ── CHAMPION (#b91c1c — dark red) ─────────────────────────────────────────────
C = '#b91c1c'
guilds_html += G('CHAMPION','STR 18 · CON 14 · HP 450 · Bloodtally', C)
guilds_html += R('Tithe of Blood',['Buff'],'Cost 3 stacks, self-heal, +30% atk speed', E('explosion_3',gc=C), pos='under feet')
guilds_html += R('Berserker Charge',['Melee','Dash'],'240u dash, knockup',
    E('slash_8',gc=C), E('explosion_2',gc=C), pos='on impact')
guilds_html += R('Execute',['Melee'],'×2 dmg if target <30% HP',
    E('slash_6',gc=C), E('explosion_5',gc=C),
    pos='on target', note='slash_6 + explosion_5 on hit (always, not just sub-30%)')
guilds_html += R('Cleaver',['Melee','AoE'],'Cone 60u',
    E('flame8', gc=C, rotate='90deg'),
    pos='cone forward', note='flame8 rotated horizontal for cone sweep effect')
guilds_html += R('Skullsplitter',['Melee'],'Heavy, on kill: halve CD + bloodtally',
    E('slash_10',gc=C), E('explosion_6',gc=C), pos='on target')
guilds_html += R('Challenge',['RMB','Debuff'],'Target +20% dmg from Champion', P('aura_pulse',C), pos='on target')

# ── DARKMAGE (#7c3aed — dark purple) ──────────────────────────────────────────
C = '#7c3aed'
guilds_html += G('DARKMAGE','INT 18 · WIS 14 · HP 400 · Mana', C)
guilds_html += R('Darkness',['Zone'],'Reduces vision 90u inside 4s',
    P('zone_pulse',C), pos='ground zone', note='Needs input — procedural for now', flag=True)
guilds_html += R('Grasping Shadow',['Ranged'],'Root 1.5s on first hit',
    E('water3',gc=C), pos='on target', note='Needs input — water3 shadow-purple tinted?', flag=True)
guilds_html += R('Soul Leech',['Ranged'],'60 DMG, restores 50% as mana', E('flame8',gc=C), pos='on target')
guilds_html += R('Shadow Bolt',['Ranged'],'Stacking slow', E('water_arrow',gc=C), pos='on target')
guilds_html += R('Eternal Night',['Zone'],'Silence 6s, DoT zone',
    P('zone_pulse',C), E('flame2',gc=C),
    pos='ground zone', note='Large persistent zone — flame2 looping')
guilds_html += R('Shadow Cloak',['RMB','Buff'],'2s untargetable, +60% speed', E('flame6',gc=C), pos='on caster')

# ── CHEF (#f97316 — orange) ───────────────────────────────────────────────────
C = '#f97316'
guilds_html += G('CHEF','INT 14 · CHA 16 · HP 510 · Stamina', C)
guilds_html += R('Feast',['Buff','AoE'],'Dish buff to all allies', E('explosion_5',gc=C), pos='under feet')
guilds_html += R('Ladle Bash',['Melee'],'55 DMG, daze 0.5s', E('slash_8',gc=C), pos='on target')
guilds_html += R('Hot Soup',['Heal'],'HoT 16/s × 4s, 240u range', E('water5',gc=C), pos='above target')
guilds_html += R('Spice Toss',['Ranged'],'Blind 3s, DoT', E('fire_arrow',gc=C), pos='on target')
guilds_html += R('Signature Dish',['Channel','AoE'],'Channel 2s, combine dish effects',
    P('channel_pulse',C), E('flame5',gc=C), E('explosion_10',gc=C),
    pos='caster AoE', note='channel_pulse → flame5 → explosion_10 big reveal burst')
guilds_html += R('Pocket Dish',['RMB'],'Consume dish buff self', E('explosion_2',gc=C), pos='under feet')

# ── LEPER (#84cc16 — sickly green) ────────────────────────────────────────────
C = '#84cc16'
guilds_html += G('LEPER','STR 14 · CON 18 · HP 505 · Rot', C)
guilds_html += R('Plague Vomit',['AoE'],'Cone 80u, infected, slow',
    E('flame3',gc=C), pos='cone forward', note='flame3 green/brown tinted — cone spray forward')
guilds_html += R('Diseased Claw',['Melee'],'DoT 10/s × 3s', E('slash_6',gc=C), pos='on target')
guilds_html += R('Necrotic Embrace',['Melee'],'Grab, heals 25% of dmg', E('flame8',gc=C), pos='on target')
guilds_html += R('Contagion',['Debuff'],'Infect target 4s', P('aura_pulse',C), pos='on target')
guilds_html += R('Rotting Tide',['Channel','AoE'],'Killed → husks 5s',
    P('channel_pulse',C), E('flame10',gc=C), E('explosion_8',gc=C),
    pos='caster AoE', note='channel_pulse → flame10 rising → explosion_8 on release')
guilds_html += R('Miasma',['RMB','Aura'],'Toggle AoE DoT aura', E('flame2',gc=C), pos='around caster')

# ── MASTER (#e2e8f0 — silver) ─────────────────────────────────────────────────
C = '#e2e8f0'
guilds_html += G('MASTER','All stats 12-14 · HP 620 · Mastery', C)
guilds_html += R('Chosen Strike',['Melee'],'Varies by primed class',
    E('slash_5','hit 1',C), E('slash_8','hit 2',C), E('slash_6','finisher',C),
    pos='on target', note='Standard combo — varies with primed class', flag=True)
guilds_html += R('Chosen Utility',['Dash'],'Teleport 120u', P('blink_trail',C), pos='trail')
guilds_html += R('Chosen Nuke',['AoE'],'120 DMG, 100u AoE', E('explosion_8',gc=C), pos='target')
guilds_html += R('Eclipse',['Buff'],'5s cycling class buff', E('water6',gc=C), pos='on caster')
guilds_html += R('Apotheosis',['Channel','Buff'],'10s all CDs halved, +20% dmg, 2% HP/s',
    P('channel_pulse',C), E('explosion_10',gc=C),
    pos='under feet', note='channel_pulse → explosion_10 on activation')
guilds_html += R('Class Swap',['RMB'],'Cycle primed class', P('aura_pulse',C), pos='on caster')

# ══════════════════════════════════════════════════════════════════════════════
# ASSEMBLE
# ══════════════════════════════════════════════════════════════════════════════
css = make_css()

html = f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:system-ui,sans-serif;background:#0b0b12;color:#ddd;padding:14px}}
h2{{font-size:15px;font-weight:700;color:#eee;margin-bottom:4px}}
.subtitle{{font-size:11px;color:#555;margin-bottom:12px}}
summary{{cursor:pointer;font-size:10px;color:#666;text-transform:uppercase;
         letter-spacing:.08em;padding:7px 0;user-select:none;list-style:none}}
details{{margin-bottom:14px}}
.section{{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);
          border-radius:8px;padding:11px;margin-top:6px}}
{css}
</style></head><body>
<h2>Nannymud — VFX Mapping</h2>
<p class="subtitle">All sprites + per-guild assignments. Sprites shown with guild color tint. Amber border = needs your input.</p>

<details>
<summary>&#9654; Sprite Gallery — all 43 assets</summary>
<div class="section">{gallery_html}</div>
</details>

<details>
<summary>&#9654; VFX Archetypes — procedural fallbacks (sprites layer ON TOP)</summary>
<div class="section"><div style="display:flex;flex-wrap:wrap;gap:12px">{arch_html}</div></div>
</details>

<details open>
<summary>&#9654; Guild Ability Mappings (15 guilds)</summary>
<div style="margin-top:6px">{guilds_html}</div>
</details>
</body></html>"""

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

os.makedirs(os.path.dirname(OUT_SAVE), exist_ok=True)
with open(OUT_SAVE, 'w', encoding='utf-8') as f:
    f.write(html)

print(f'Done — {len(html)//1024} KB')
print(f'Saved to brainstorm: {OUT}')
print(f'Saved to docs:       {OUT_SAVE}')
