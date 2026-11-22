// Små tegnede stuer, én per stil, så man ser forskjellen uten å måtte tolke fargeprøver.
// Samme rom og samme møbler hver gang: sofa, bord, lampe, teppe, vegg og plante. Bare stilen endrer seg.

const S = {
  skandi: {
    wall: '#F3F1EC', floor: '#D9C4A1', wood: '#C8A878', sofa: ['legs', '#B9C3C0', '#A9B4B1'], pillows: ['#FFFFFF', '#8FA39B'],
    rug: ['plain', '#E9E4DA'], lamp: ['dome', '#FFFFFF'], deco: ['frames', '#8FA39B', '#3C4A4B'], plant: 'small', table: 'round',
  },
  japandi: {
    wall: '#EFE8DC', floor: '#C9B79A', wood: '#A98B63', sofa: ['low', '#D9CDB8', '#C9BCA4'], pillows: ['#7C7A6B', '#EFE8DC'],
    rug: ['plain', '#DDD2BE'], lamp: ['lantern', '#FBF7EE'], deco: ['scroll', '#2B2B28', '#FBF7EE'], plant: 'branch', table: 'low',
  },
  retro: {
    wall: '#F2E3C2', floor: '#B98A55', wood: '#8E5A2B', sofa: ['legs', '#3F6C6A', '#335957'], pillows: ['#E3B23C', '#C8552D'],
    rug: ['stripe', '#C8552D', '#E3B23C'], lamp: ['globe', '#FFF3D6'], deco: ['sun', '#E3B23C', '#8E5A2B'], plant: 'small', table: 'rect',
  },
  industri: {
    wall: '#B9B4AA', floor: '#6E6259', wood: '#7A5C3E', sofa: ['boxy', '#6B4A32', '#5A3D29'], pillows: ['#4A4F54', '#B9B4AA'],
    rug: ['plain', '#4A4F54'], lamp: ['cage', '#1E1F21'], deco: ['shelf', '#1E1F21', '#7A5C3E'], plant: 'none', table: 'metal',
  },
  landlig: {
    wall: '#F1EADB', floor: '#C8A877', wood: '#B58B55', sofa: ['slip', '#E8DFCB', '#D9CEB6'], pillows: ['#8FA08A', '#C98F8F'],
    rug: ['stripe', '#8FA08A', '#F1EADB'], lamp: ['shade', '#F7F0DE'], deco: ['plates', '#6B4F3A', '#8FA08A'], plant: 'small', table: 'rect',
  },
  boho: {
    wall: '#F3E3C8', floor: '#B98A5E', wood: '#C99A5B', sofa: ['legs', '#C96F4A', '#B55F3D'], pillows: ['#7F9B76', '#F0D9B5'],
    rug: ['pattern', '#8E3B46', '#F0D9B5'], lamp: ['lantern', '#E9C98E'], deco: ['macrame', '#FBF3E2', '#5A3E36'], plant: 'big', table: 'rattan',
  },
  varm: {
    wall: '#EEE3D3', floor: '#CDB59A', wood: '#A77E62', sofa: ['curvy', '#F3ECE0', '#E5DBCB'], pillows: ['#A77E62', '#CDB59A'],
    rug: ['plain', '#E2D4BF'], lamp: ['globe', '#FFFFFF'], deco: ['arch', '#D9BFA3', '#A77E62'], plant: 'branch', table: 'stone',
  },
  fri: {
    wall: '#E9EEF0', floor: '#C7B08E', wood: '#8E5A2B', sofa: ['legs', '#E83E8C', '#CF2E79'], pillows: ['#F2B705', '#0E6B5C'],
    rug: ['pattern', '#0E6B5C', '#F2B705'], lamp: ['cage', '#1B2430'], deco: ['frames', '#F2B705', '#0E6B5C'], plant: 'big', table: 'round',
  },
};

const ink = '#1B2430';

function deco(c) {
  const [type, a, b] = c.deco;
  switch (type) {
    case 'frames':
      return `<rect x="46" y="12" width="20" height="24" fill="#fff" stroke="${b}" stroke-width="1.5"/><circle cx="56" cy="24" r="6" fill="${a}"/>
        <rect x="72" y="16" width="26" height="18" fill="#fff" stroke="${b}" stroke-width="1.5"/><path d="M74 32l8-9 6 6 4-4 4 7z" fill="${b}"/>`;
    case 'scroll':
      return `<rect x="62" y="8" width="16" height="30" fill="${b}"/><rect x="60" y="7" width="20" height="2" fill="${a}"/><rect x="60" y="37" width="20" height="2" fill="${a}"/>
        <path d="M70 14c-4 6 4 8 0 18" fill="none" stroke="${a}" stroke-width="1.6" stroke-linecap="round"/>`;
    case 'sun':
      return `<g stroke="${b}" stroke-width="1.4" stroke-linecap="round">${Array.from({ length: 16 }, (_, i) => {
        const t = (i * Math.PI) / 8, r1 = 8, r2 = i % 2 ? 14 : 17;
        return `<path d="M${(70 + r1 * Math.cos(t)).toFixed(1)} ${(23 + r1 * Math.sin(t)).toFixed(1)}L${(70 + r2 * Math.cos(t)).toFixed(1)} ${(23 + r2 * Math.sin(t)).toFixed(1)}"/>`;
      }).join('')}</g><circle cx="70" cy="23" r="8" fill="${a}"/><circle cx="70" cy="23" r="5" fill="#FFF8E6"/>`;
    case 'shelf':
      return `<path d="M40 10v30M100 10v30" stroke="${a}" stroke-width="2"/><rect x="38" y="20" width="64" height="2.5" fill="${b}"/><rect x="38" y="36" width="64" height="2.5" fill="${b}"/>
        <rect x="46" y="10" width="4" height="10" fill="#7A2E2E"/><rect x="51" y="8" width="4" height="12" fill="#D8D2C6"/><rect x="56" y="11" width="4" height="9" fill="${a}"/>
        <rect x="78" y="27" width="12" height="9" fill="${a}"/><circle cx="64" cy="31" r="4.5" fill="#D8D2C6"/>`;
    case 'plates':
      return `<rect x="44" y="12" width="22" height="26" fill="#FBF7EC" stroke="${a}" stroke-width="2.5"/><path d="M49 32c2-10 10-10 12 0z" fill="${b}"/>
        <circle cx="80" cy="20" r="7" fill="#FBF7EC" stroke="${b}" stroke-width="1.5"/><circle cx="95" cy="28" r="5.5" fill="#FBF7EC" stroke="${a}" stroke-width="1.5"/><circle cx="80" cy="20" r="3" fill="none" stroke="${b}"/>`;
    case 'macrame':
      return `<rect x="52" y="9" width="36" height="2.5" rx="1" fill="${b}"/><path d="M54 11l16 28 16-28z" fill="${a}"/>
        <path d="M58 11l12 21 12-21M62 11l8 14 8-14M66 11l4 7 4-7" fill="none" stroke="${b}" stroke-width=".8"/><path d="M70 39v6M66 34v7M74 34v7" stroke="${a}" stroke-width="1.2"/>`;
    case 'arch':
      return `<path d="M44 78V34a26 26 0 0152 0v44z" fill="${a}"/><circle cx="112" cy="22" r="7" fill="none" stroke="${b}" stroke-width="1.5"/>`;
    default: return '';
  }
}

function rug(c) {
  const [type, a, b] = c.rug;
  if (type === 'plain') return `<ellipse cx="74" cy="89" rx="64" ry="7.5" fill="${a}"/>`;
  const base = `<path d="M14 83h120l12 13H2z" fill="${a}"/>`;
  if (type === 'stripe') return `${base}<path d="M11 86h126M8 89.5h132M5 93h138" stroke="${b}" stroke-width="1.4"/>`;
  return `${base}<path d="M10 90l8-5 8 5 8-5 8 5 8-5 8 5 8-5 8 5 8-5 8 5 8-5 8 5 8-5 8 5 8-5 8 5" fill="none" stroke="${b}" stroke-width="1.5"/><path d="M6 94h136" stroke="${b}" stroke-width="1.2"/>`;
}

function lamp(c) {
  const [type, a] = c.lamp;
  switch (type) {
    case 'dome': return `<path d="M132 0v16" stroke="${ink}" stroke-width="1"/><path d="M121 28a11 12 0 0122 0z" fill="${a}" stroke="${ink}" stroke-width="1"/>`;
    case 'lantern': return `<path d="M132 0v10" stroke="${ink}" stroke-width="1"/><ellipse cx="132" cy="22" rx="12" ry="12.5" fill="${a}" stroke="${c.wood}" stroke-width="1"/>
      <path d="M121 17h22M120 22h24M121 27h22" stroke="${c.wood}" stroke-width=".7"/>`;
    case 'cage': return `<path d="M132 0v14" stroke="${a}" stroke-width="1.4"/><path d="M127 14h10l6 12h-22z" fill="${a}"/><circle cx="132" cy="28" r="3.2" fill="#FFD98A"/>`;
    case 'globe': return `<path d="M150 78V34" stroke="${c.wood}" stroke-width="2"/><rect x="143" y="76" width="14" height="2.5" rx="1" fill="${c.wood}"/><circle cx="150" cy="28" r="8" fill="${a}" stroke="${c.wood}" stroke-width="1"/>`;
    case 'shade': return `<path d="M150 78V40" stroke="${c.wood}" stroke-width="2"/><rect x="143" y="76" width="14" height="2.5" rx="1" fill="${c.wood}"/><path d="M144 24h12l5 16h-22z" fill="${a}" stroke="${c.wood}" stroke-width="1"/>`;
    default: return '';
  }
}

function plant(c) {
  if (c.plant === 'small') return `<path d="M8 64h12l-2 14H10z" fill="#C97B55"/><path d="M14 64c-8-6-9-14-5-18 5 4 6 10 5 18zm0 0c8-6 9-16 4-22-5 5-6 12-4 22z" fill="#5E8C6A"/>`;
  if (c.plant === 'big') return `<path d="M6 62h16l-3 16H9z" fill="#F0D9B5" stroke="${c.wood}" stroke-width="1"/>
    <path d="M14 62C2 54 0 38 6 30c7 8 9 20 8 32zm0 0c12-6 16-22 10-34-8 8-11 22-10 34zm0 0c-2-14 2-30 0-40-5 10-4 28 0 40z" fill="#4F8A5B"/>`;
  if (c.plant === 'branch') return `<path d="M10 60h8l1 18H9z" fill="${c.pillows[0]}"/><path d="M14 60c0-14-6-22-8-30M14 52c2-10 8-14 10-22M14 46c-1-8 2-14 1-22" fill="none" stroke="#6B5A45" stroke-width="1.1" stroke-linecap="round"/>`;
  return '';
}

function sofa(c) {
  const [type, a, b] = c.sofa;
  const [p1, p2] = c.pillows;
  const pillows = `<rect x="40" y="47" width="15" height="12" rx="3" fill="${p1}"/><rect x="87" y="47" width="15" height="12" rx="3" fill="${p2}"/>`;
  switch (type) {
    case 'legs': return `<path d="M36 72l-3 7M104 72l3 7" stroke="${c.wood}" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="33" y="42" width="74" height="20" rx="4" fill="${a}"/><rect x="29" y="58" width="82" height="14" rx="4" fill="${b}"/><path d="M70 59v12" stroke="${a}" stroke-width="1"/>${pillows}`;
    case 'low': return `<rect x="24" y="72" width="92" height="5" fill="${c.wood}"/><rect x="30" y="50" width="38" height="14" rx="2" fill="${a}"/><rect x="72" y="50" width="38" height="14" rx="2" fill="${a}"/>
      <rect x="26" y="62" width="88" height="10" rx="2" fill="${b}"/><rect x="44" y="53" width="13" height="10" rx="2" fill="${p1}"/>`;
    case 'boxy': return `<path d="M32 72v6M108 72v6" stroke="${ink}" stroke-width="1.6"/><rect x="30" y="42" width="80" height="18" rx="1.5" fill="${a}"/>
      <rect x="24" y="50" width="10" height="23" rx="1.5" fill="${b}"/><rect x="106" y="50" width="10" height="23" rx="1.5" fill="${b}"/><rect x="33" y="59" width="74" height="13" fill="${b}"/>
      <path d="M57 44v14M83 44v14M57 60v11M83 60v11" stroke="${a}" stroke-width=".9" opacity=".7"/><rect x="88" y="48" width="14" height="11" rx="2" fill="${p1}"/>`;
    case 'slip': return `<rect x="28" y="44" width="84" height="22" rx="7" fill="${a}"/><path d="M26 60h88v18H26z" fill="${b}"/><path d="M26 78q5.5-3 11 0t11 0 11 0 11 0 11 0 11 0 11 0 11 0" fill="none" stroke="${a}" stroke-width="1.6"/>
      <rect x="24" y="52" width="9" height="24" rx="4" fill="${a}"/><rect x="107" y="52" width="9" height="24" rx="4" fill="${a}"/>${pillows}`;
    case 'curvy': return `<rect x="30" y="40" width="80" height="30" rx="15" fill="${a}"/><rect x="24" y="58" width="92" height="19" rx="9.5" fill="${b}"/><rect x="60" y="48" width="18" height="12" rx="6" fill="${p1}"/>`;
    default: return '';
  }
}

function table(c) {
  const w = c.wood;
  switch (c.table) {
    case 'round': return `<path d="M124 80l-3 12M140 80l3 12M132 80v12" stroke="${w}" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="132" cy="79" rx="15" ry="3.6" fill="${w}"/>`;
    case 'rect': return `<path d="M120 82l-3 10M144 82l3 10" stroke="${w}" stroke-width="2" stroke-linecap="round"/><rect x="115" y="78" width="34" height="4.5" rx="1.5" fill="${w}"/>`;
    case 'metal': return `<path d="M118 82v10h28V82" fill="none" stroke="${ink}" stroke-width="1.6"/><rect x="115" y="78" width="34" height="4" fill="${w}"/>`;
    case 'low': return `<rect x="114" y="82" width="36" height="5" fill="${w}"/><rect x="118" y="87" width="5" height="5" fill="${w}"/><rect x="141" y="87" width="5" height="5" fill="${w}"/>
      <rect x="126" y="76" width="8" height="6" rx="1" fill="${c.pillows[0]}"/>`;
    case 'stone': return `<ellipse cx="132" cy="91" rx="13" ry="3" fill="${w}"/><rect x="119" y="80" width="26" height="11" fill="${w}"/><ellipse cx="132" cy="80" rx="13" ry="3.2" fill="${c.deco[1]}"/>`;
    case 'rattan': return `<path d="M121 81l-2 11h26l-2-11z" fill="${w}"/><path d="M121 84h22M120 88h24M127 81l-1 11M132 81v11M137 81l1 11" stroke="${c.deco[2]}" stroke-width=".7" opacity=".6"/><ellipse cx="132" cy="80" rx="13" ry="3.2" fill="${c.pillows[1]}" stroke="${w}" stroke-width="1"/>`;
    default: return '';
  }
}

export function scene(id) {
  const c = S[id] || S.fri;
  return `<svg class="scene" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <rect width="160" height="100" fill="${c.wall}"/>${deco(c)}<rect y="78" width="160" height="22" fill="${c.floor}"/>
    ${rug(c)}${lamp(c)}${plant(c)}${sofa(c)}${table(c)}</svg>`;
}
