// Original artwork drawn in SVG: the title screen scene (a lone figure on a hill at sunrise with the
// city lit below) and small ornaments. Colors are fixed because it is an illustration, not UI.

/** The SVG markup of the title scene. */
export function titleSvg() {
  // Six rays around the sun, one of them red (the same sun as the app icon).
  const cx = 262;
  const cy = 128;
  let rays = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * (180 - i * 36)) / 180;
    const x1 = cx + Math.cos(a) * 44;
    const y1 = cy - Math.sin(a) * 44;
    const x2 = cx + Math.cos(a) * 76;
    const y2 = cy - Math.sin(a) * 76;
    rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i === 4 ? '#b3201f' : '#e8b957'}" stroke-width="5" stroke-linecap="round"/>`;
  }
  // A city of small lit windows in the valley.
  const blocks = [
    [196, 150, 14, 26], [212, 144, 12, 32], [226, 152, 16, 24], [244, 140, 10, 36], [256, 148, 18, 28],
    [276, 154, 12, 22], [290, 146, 14, 30], [306, 152, 16, 24], [324, 148, 12, 28], [338, 156, 18, 20],
  ];
  let city = '';
  let windows = '';
  blocks.forEach(([x, y, w, h], n) => {
    city += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#150e0b"/>`;
    for (let wy = y + 5; wy < y + h - 3; wy += 6) {
      for (let wx = x + 3; wx < x + w - 2; wx += 5) {
        if ((wx * 7 + wy * 3 + n) % 4 !== 0) windows += `<rect x="${wx}" y="${wy}" width="2" height="2.6" fill="#f4c76a" opacity="${(0.55 + ((wx + wy) % 5) / 12).toFixed(2)}"/>`;
      }
    }
  });
  const dome = '<path d="M262 126 a9 9 0 0 1 18 0 v14 h-18z" fill="#150e0b"/><rect x="270.2" y="112" width="1.6" height="8" fill="#150e0b"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220" role="img" aria-label="A lone figure on a hill at sunrise, looking down on a city whose windows are still lit">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0807"/><stop offset="0.45" stop-color="#2a130c"/>
      <stop offset="0.72" stop-color="#9a4b22"/><stop offset="1" stop-color="#e9a447"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffd98a" stop-opacity="0.85"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="220" fill="url(#sky)"/>
  <circle cx="${cx}" cy="${cy}" r="110" fill="url(#glow)"/>
  ${rays}
  <circle cx="${cx}" cy="${cy}" r="30" fill="#f6cf7a"/>
  <path d="M0 150 C40 132 70 140 110 134 C150 128 170 146 210 150 L400 150 L400 220 L0 220Z" fill="#241109"/>
  <path d="M170 156 C230 146 330 146 400 138 L400 220 L170 220Z" fill="#190d08"/>
  ${dome}${city}${windows}
  <path d="M0 220 L0 156 C26 150 52 140 86 132 C104 128 122 130 140 142 C168 160 196 190 226 220Z" fill="#070504"/>
  <g transform="translate(92 103)" fill="#070504">
    <circle cx="0" cy="3.4" r="3.4"/>
    <path d="M-5.6 8 C-3 6.6 3 6.6 5.6 8 L9.4 28 L-9.4 28Z"/>
    <path d="M-5.6 8 C-11 12 -12.6 22 -11.4 28 L-9.4 28 Z" opacity="0.9"/>
  </g>
  <path d="M0 220 L0 200 C60 196 120 205 170 220Z" fill="#050303"/>
</svg>`;
}

/** The ornament rule used under titles: a thin line with a diamond in the middle. */
export function ornamentSvg() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 12" aria-hidden="true" focusable="false"><line x1="0" y1="6" x2="86" y2="6" stroke="currentColor" stroke-width="1"/><line x1="114" y1="6" x2="200" y2="6" stroke="currentColor" stroke-width="1"/><path d="M100 1 L105 6 L100 11 L95 6Z" fill="currentColor"/></svg>';
}
