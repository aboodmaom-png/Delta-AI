/* Delta — the app's character (flat SVG, built in code so every part can move).
   window.DeltaChar.svg({ mood, arms, prop, animate, size, label, rig, headOnly })
   mood: neutral | happy | think | wow | kind     arms: rest | wave | cheer | hold
   prop: '' | ruler | flask | book                rig: parts tagged with data-p for scripted animation */
(function () {
const PALETTES = {
  green: { green: '#3CC46B', shade: '#23A356', light: '#6BDC93', footShade: '#1A8A47' },
  lime: { green: '#7ED957', shade: '#5BB93A', light: '#A8EC88', footShade: '#4A9E2C' },
  teal: { green: '#2EC4B6', shade: '#1FA396', light: '#72E0D6', footShade: '#178A7F' },
};
let C = {};
const BASE = {
  white: '#F6F8F3', whiteShade: '#D9E1D5',
  ink: '#1B2A3A', inkRim: '#26394D', yellow: '#FFC21A', yellowShade: '#E3A500', eye: '#E2FCEF',
  blush: '#FF9DB0', orange: '#FF8A1F', blue: '#2468E8',
};
let OPT = {};
let uid = 0;
const X = 120;               // centre line
const GROUND = 262;

const smil = (on, type, values, dur) =>
  on ? `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${dur}" repeatCount="indefinite"/>` : '';

// ---- face (screen spans x 64–176, y 55–133) ----
function eyes(mood, animate) {
  const blink = animate
    ? `<animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 0.12;1 1" keyTimes="0;0.92;0.96;1" dur="3.8s" repeatCount="indefinite"/>`
    : '';
  const pill = (cx, cy = 89, w = 18, h = 28, look = [1, 2]) => OPT.eyes === 'round'
    ? `<g transform="translate(${cx} ${cy})"><g>${blink}<ellipse rx="${w * 0.85}" ry="${h * 0.66}" fill="#FFFFFF"/><circle cx="${look[0]}" cy="${look[1]}" r="${w * 0.42}" fill="${C.ink}"/><circle cx="${look[0] + 3}" cy="${look[1] - 4}" r="3" fill="#FFFFFF"/></g></g>`
    : `<g transform="translate(${cx} ${cy})"><g>${blink}<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${w / 2}" fill="${C.eye}"/></g></g>`;
  const arc = (cx) => `<path d="M${cx - 12} 94 Q${cx} 78 ${cx + 12} 94" fill="none" stroke="${C.eye}" stroke-width="7" stroke-linecap="round"/>`;
  const brow = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.eye}" stroke-width="5" stroke-linecap="round"/>`;
  switch (mood) {
    case 'happy': return arc(96) + arc(144);
    case 'think': return pill(98, 84, 18, 28, [4, -5]) + pill(146, 84, 18, 28, [4, -5]) + brow(86, 66, 108, 66) + brow(134, 64, 156, 58);
    case 'wow': return pill(96, 90, 22, 30, [0, 0]) + pill(144, 90, 22, 30, [0, 0]) + brow(84, 66, 106, 64) + brow(134, 64, 156, 66);
    case 'kind': return pill(96, 92, 18, 24, [0, 4]) + pill(144, 92, 18, 24, [0, 4]) + brow(84, 74, 106, 68) + brow(134, 68, 156, 74);
    default: return pill(96) + pill(144);
  }
}
function mouth(mood) {
  switch (mood) {
    case 'happy': return `<path d="M105 108 Q120 126 135 108 Z" fill="${C.eye}"/>`;
    case 'think': return `<path d="M111 117 Q120 114 129 118" fill="none" stroke="${C.eye}" stroke-width="5" stroke-linecap="round"/>`;
    case 'wow': return `<ellipse cx="120" cy="116" rx="7" ry="8" fill="${C.eye}"/>`;
    case 'kind': return `<path d="M109 116 Q120 123 131 116" fill="none" stroke="${C.eye}" stroke-width="5" stroke-linecap="round"/>`;
    default: return `<path d="M108 110 Q120 122 132 110" fill="none" stroke="${C.eye}" stroke-width="5.5" stroke-linecap="round"/>`;
  }
}

// ---- one arm, hanging from its shoulder at local (0,0); rot = clockwise degrees ----
function arm(rot, animate, waveRange, tag = '') {
  const anim = animate && waveRange
    ? `<animateTransform attributeName="transform" type="rotate" values="${waveRange}" dur="0.6s" repeatCount="indefinite"/>` : '';
  return `<g ${tag ? `data-p="${tag}"` : ''} transform="rotate(${rot})">${anim}
      <rect x="-9" y="-6" width="18" height="40" rx="9" fill="${C.green}"/>
      <rect x="2" y="-6" width="7" height="40" rx="3.5" fill="${C.shade}"/>
      <circle cx="0" cy="40" r="13" fill="${C.white}"/>
      <path d="M3 50.5 A13 13 0 0 0 12.5 36" fill="none" stroke="${C.whiteShade}" stroke-width="4.5" stroke-linecap="round"/>
    </g>`;
}
const ARMS = {
  rest:  { l: 22, r: -22 },
  wave:  { l: 22, r: -110, rWave: '-100;-128;-100' },
  cheer: { l: 110, r: -110, lWave: '100;124;100', rWave: '-100;-124;-100' },
  hold:  { l: -30, r: 30 },
};
const SHOULDER_L = 'translate(76 172)';
const SHOULDER_R = 'translate(164 172)';

function prop(name) {
  if (name === 'ruler') return `
    <g transform="translate(120 202)">
      <path d="M-32 22 L0 -32 L32 22 Z" fill="${C.yellow}" stroke="${C.yellowShade}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M-13 12 L0 -10 L13 12 Z" fill="#FFF3CC"/>
      <path d="M-20 22 v-6 M-10 22 v-8 M0 22 v-6 M10 22 v-8 M20 22 v-6" stroke="${C.yellowShade}" stroke-width="3" stroke-linecap="round"/>
    </g>`;
  if (name === 'flask') return `
    <g transform="translate(120 198)">
      <rect x="-9" y="-36" width="18" height="24" rx="3" fill="#E9F6FF" stroke="${C.ink}" stroke-width="3"/>
      <rect x="-13" y="-40" width="26" height="8" rx="4" fill="${C.ink}"/>
      <circle cx="0" cy="8" r="25" fill="#E9F6FF" stroke="${C.ink}" stroke-width="3"/>
      <path d="M-24 12 A25 25 0 0 0 24 12 Z" fill="${C.orange}"/>
      <circle cx="-7" cy="-1" r="4" fill="${C.orange}" opacity="0.8"/><circle cx="6" cy="-9" r="3" fill="${C.orange}" opacity="0.6"/>
      <path d="M-13 -3 Q-9 -11 -2 -13" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
    </g>`;
  if (name === 'book') return `
    <g transform="translate(120 204)">
      <path d="M-34 -18 Q-17 -26 0 -18 V22 Q-17 14 -34 22 Z" fill="${C.blue}"/>
      <path d="M34 -18 Q17 -26 0 -18 V22 Q17 14 34 22 Z" fill="#3D7EF5"/>
      <path d="M-26 -10 Q-15 -14 -6 -10 M-26 0 Q-15 -4 -6 0 M6 -10 Q15 -14 26 -10" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
    </g>`;
  return '';
}
function confetti() {
  return [[30, 40, C.yellow, 20], [204, 28, C.blue, -15], [16, 128, C.orange, 40], [214, 120, C.green, 10], [56, 10, C.blush, -30], [178, 64, C.yellow, 25]]
    .map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="10" height="16" rx="3" fill="${c}" transform="rotate(${r} ${x + 5} ${y + 8})"/>`).join('');
}

function deltaSVG({ mood = 'neutral', arms = 'rest', prop: p = '', animate = false, size = 240, label = 'دلتا',
  head = 'normal', shape = 'round', eyes: eyeStyle = 'round', ears = 'round', outline = true, palette = 'green',
  rig = false, headOnly = false } = {}) {
  const id = `d${++uid}`;
  C = { ...BASE, ...(PALETTES[palette] || PALETTES.green) };
  OPT = { eyes: eyeStyle };
  const big = head === 'big';
  const hr = shape === 'round' ? 52 : 36;          // head corner radius
  const sr = shape === 'round' ? 34 : 24;          // screen corner radius
  const A = { ...(ARMS[arms] || ARMS.rest) };
  if (big && arms === 'wave') { A.r = -98; A.rWave = '-92;-116;-92'; }
  if (big && arms === 'cheer') { A.l = 100; A.r = -100; A.lWave = '94;116;94'; A.rWave = '-94;-116;-94'; }
  const hop = animate && arms === 'cheer';
  if (rig) animate = false;
  const armL = `<g transform="${SHOULDER_L}">${arm(A.l, animate, A.lWave, rig ? 'armL' : '')}</g>`;
  const armR = `<g transform="${SHOULDER_R}">${arm(A.r, animate, A.rWave, rig ? 'armR' : '')}</g>`;
  const vb = headOnly ? '20 -20 200 182' : '0 -16 240 296';
  const [vw, vh] = headOnly ? [200, 182] : [240, 296];
  return `<svg role="img" aria-label="${label}" viewBox="${vb}" width="${size}" height="${Math.round(size * vh / vw)}">
  ${headOnly ? '' : `<ellipse cx="${X}" cy="${GROUND}" rx="62" ry="9" fill="${C.ink}" opacity="0.13"/>`}
  ${arms === 'cheer' ? confetti() : ''}
  ${outline ? `<filter id="${id}o" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="d"/><feFlood flood-color="${C.ink}"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}
  <g ${rig ? 'data-p="all"' : ''} ${outline ? `filter="url(#${id}o)"` : ''}>${smil(animate, 'translate', hop ? '0 0;0 -16;0 0' : '0 0;0 -4;0 0', hop ? '0.7s' : '1.6s')}
    ${headOnly ? '' : `
    <!-- legs: white stub + green shoe, clearly apart -->
    <g ${rig ? 'data-p="legL"' : ''}><rect x="88" y="222" width="21" height="30" rx="10" fill="${C.white}"/><rect x="99" y="222" width="10" height="30" rx="5" fill="${C.whiteShade}"/>
      <rect x="81" y="243" width="34" height="18" rx="9" fill="${C.green}"/><rect x="81" y="253" width="34" height="8" rx="4" fill="${C.footShade}"/></g>
    <g ${rig ? 'data-p="legR"' : ''}><rect x="131" y="222" width="21" height="30" rx="10" fill="${C.white}"/><rect x="142" y="222" width="10" height="30" rx="5" fill="${C.whiteShade}"/>
      <rect x="125" y="243" width="34" height="18" rx="9" fill="${C.green}"/><rect x="125" y="253" width="34" height="8" rx="4" fill="${C.footShade}"/></g>
    <!-- body -->
    <clipPath id="${id}b"><rect x="72" y="152" width="96" height="78" rx="26"/></clipPath>
    <rect x="72" y="152" width="96" height="78" rx="26" fill="${C.white}"/>
    <g clip-path="url(#${id}b)"><rect x="146" y="148" width="26" height="86" fill="${C.whiteShade}"/><rect x="68" y="220" width="104" height="14" fill="${C.whiteShade}"/></g>
    <rect x="99" y="180" width="42" height="24" rx="9" fill="${C.green}"/>
    <rect x="99" y="196" width="42" height="8" rx="4" fill="${C.shade}"/>
    <circle cx="130" cy="190" r="4.5" fill="${C.yellow}"/>
    <!-- arms sit behind the head, in front of the body -->
    ${armL}${armR}`}
    <g transform="${big ? 'translate(120 93) scale(1.16) translate(-120 -93)' : ''}">
    <!-- ears -->
    ${ears === 'round'
      ? `<circle cx="46" cy="96" r="17" fill="${C.yellowShade}"/><circle cx="46" cy="94" r="15" fill="${C.yellow}"/><circle cx="194" cy="96" r="17" fill="${C.yellowShade}"/><circle cx="194" cy="94" r="15" fill="${C.yellow}"/>`
      : `<rect x="38" y="72" width="16" height="44" rx="8" fill="${C.yellowShade}"/><rect x="40" y="72" width="14" height="40" rx="7" fill="${C.yellow}"/><rect x="186" y="72" width="16" height="44" rx="8" fill="${C.yellowShade}"/><rect x="186" y="72" width="14" height="40" rx="7" fill="${C.yellow}"/>`}
    <!-- antenna -->
    <g transform="translate(120 40)"><g ${rig ? 'data-p="ant"' : ''}>${smil(animate, 'rotate', '-6;6;-6', '1.8s')}
      <path d="M0 0 V-20" stroke="${C.ink}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="0" cy="-26" r="10" fill="${C.yellow}"/><circle cx="-3.5" cy="-29.5" r="3" fill="#FFFFFF" opacity="0.8"/>
    </g></g>
    <!-- head -->
    <clipPath id="${id}h"><rect x="47" y="36" width="146" height="114" rx="${hr}"/></clipPath>
    <rect x="47" y="36" width="146" height="114" rx="${hr}" fill="${C.green}"/>
    <g clip-path="url(#${id}h)">
      <rect x="171" y="30" width="30" height="126" fill="${C.shade}"/>
      <rect x="40" y="138" width="160" height="16" fill="${C.shade}"/>
    </g>
    <g clip-path="url(#${id}h)" transform="${shape === 'round' ? 'translate(14 2)' : ''}">
      <rect x="62" y="44" width="${shape === 'round' ? 46 : 58}" height="9" rx="4.5" fill="${C.light}"/>
      <rect x="${shape === 'round' ? 114 : 126}" y="44" width="12" height="9" rx="4.5" fill="${C.light}"/>
    </g>
    <!-- screen face -->
    <rect x="62" y="53" width="116" height="82" rx="${sr}" fill="${C.inkRim}"/>
    <rect x="65" y="56" width="110" height="76" rx="${sr - 3}" fill="${C.ink}"/>
    <path d="M76 76 Q78 66 90 64" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.14"/>
    ${rig
      ? `<g data-p="faceN">${eyes('neutral', false)}${mouth('neutral')}</g><g data-p="faceH" style="display:none">${eyes('happy', false)}${mouth('happy')}<ellipse cx="80" cy="113" rx="7" ry="4" fill="${C.blush}" opacity="0.55"/><ellipse cx="160" cy="113" rx="7" ry="4" fill="${C.blush}" opacity="0.55"/></g>`
      : `${eyes(mood, animate)}${mood === 'happy' || mood === 'kind' ? `<ellipse cx="80" cy="113" rx="7" ry="4" fill="${C.blush}" opacity="0.55"/><ellipse cx="160" cy="113" rx="7" ry="4" fill="${C.blush}" opacity="0.55"/>` : ''}${mouth(mood)}`}
    </g>
    ${p ? prop(p) + `<g transform="${SHOULDER_L}">${arm(A.l, false, '')}</g><g transform="${SHOULDER_R}">${arm(A.r, false, '')}</g>` : ''}
    ${mood === 'think' ? `<g><circle cx="200" cy="52" r="5" fill="#FFFFFF" stroke="#E2DACB" stroke-width="2.5"/><circle cx="214" cy="26" r="18" fill="#FFFFFF" stroke="#E2DACB" stroke-width="3"/><text x="214" y="35" text-anchor="middle" font-size="25" font-weight="800" fill="${C.ink}" font-family="inherit">?</text></g>` : ''}
  </g>
</svg>`;
}

  window.DeltaChar = { svg: deltaSVG };
})();
