/* eslint-disable no-console */
/**
 * Generates elegant, brand-consistent SVG placeholder product images into ../frontend/public/images.
 * Run: npx tsx prisma/generate-placeholder-images.ts
 * Replace with real photography via the admin panel (uploads go to Cloudinary).
 */
import fs from 'node:fs';
import path from 'node:path';
import { categories, products, type ArtKind } from './seed-data';
import { slugify } from '../src/utils/slug';

const OUT = path.resolve(__dirname, '../../frontend/public/images');
const GOLD = '#C9A46A';
const GOLD_DARK = '#9C7A45';

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  const r = c(n >> 16), g = c((n >> 8) & 255), b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function art(kind: ArtKind, main: string): string {
  const dark = shade(main, -0.35);
  const light = shade(main, 0.35);
  switch (kind) {
    case 'lipstick':
      return `
      <g transform="translate(400 430) rotate(-14)">
        <rect x="-70" y="40" width="140" height="190" rx="14" fill="url(#gold)"/>
        <rect x="-70" y="40" width="140" height="22" fill="${GOLD_DARK}" opacity=".5"/>
        <rect x="-56" y="-60" width="112" height="110" rx="8" fill="url(#gold)"/>
        <path d="M-48 -60 L-48 -170 Q-48 -215 0 -240 L48 -205 L48 -60 Z" fill="url(#main)"/>
        <path d="M-30 -70 L-30 -170 Q-30 -200 0 -222" stroke="${light}" stroke-width="10" fill="none" opacity=".55" stroke-linecap="round"/>
      </g>`;
    case 'kajal':
      return `
      <g transform="translate(400 400) rotate(-35)">
        <rect x="-26" y="-250" width="52" height="400" rx="26" fill="#1c1719"/>
        <rect x="-26" y="-90" width="52" height="16" fill="url(#gold)"/>
        <rect x="-26" y="150" width="52" height="110" rx="20" fill="url(#gold)"/>
        <path d="M-26 -250 Q0 -300 26 -250 Z" fill="${main}"/>
        <rect x="-14" y="-240" width="8" height="370" rx="4" fill="#fff" opacity=".12"/>
      </g>
      <path d="M180 620 C 300 560, 460 560, 620 610" stroke="${main}" stroke-width="18" fill="none" stroke-linecap="round" opacity=".85"/>`;
    case 'compact':
      return `
      <ellipse cx="400" cy="560" rx="230" ry="60" fill="#000" opacity=".06"/>
      <circle cx="400" cy="460" r="200" fill="url(#gold)"/>
      <circle cx="400" cy="460" r="175" fill="${main}"/>
      <circle cx="400" cy="460" r="175" fill="url(#sheen)"/>
      <g opacity=".35" stroke="${dark}" stroke-width="2" fill="none">
        ${Array.from({ length: 8 }, (_, i) => `<circle cx="400" cy="460" r="${30 + i * 18}"/>`).join('')}
      </g>
      <path d="M220 330 A200 120 0 0 1 580 330 L560 250 A190 90 0 0 0 240 250 Z" fill="url(#gold)" opacity=".9"/>
      <text x="400" y="300" font-family="Georgia,serif" font-size="30" fill="#fff" text-anchor="middle" letter-spacing="6" opacity=".9">KC</text>`;
    case 'nailpolish':
      return `
      <ellipse cx="400" cy="640" rx="170" ry="30" fill="#000" opacity=".07"/>
      <rect x="350" y="150" width="100" height="200" rx="14" fill="#1c1719"/>
      <rect x="360" y="160" width="16" height="180" rx="8" fill="#fff" opacity=".12"/>
      <path d="M270 380 Q270 340 310 340 L490 340 Q530 340 530 380 L540 580 Q540 640 480 640 L320 640 Q260 640 260 580 Z" fill="url(#main)"/>
      <path d="M300 380 L300 590" stroke="#fff" stroke-width="16" stroke-linecap="round" opacity=".35"/>
      <rect x="330" y="450" width="140" height="70" rx="6" fill="#fff" opacity=".9"/>
      <text x="400" y="495" font-family="Georgia,serif" font-size="26" fill="${dark}" text-anchor="middle" letter-spacing="3">KASHIF</text>`;
    case 'serum':
      return `
      <ellipse cx="400" cy="650" rx="150" ry="28" fill="#000" opacity=".07"/>
      <path d="M380 110 Q400 90 420 110 L420 200 L380 200 Z" fill="#1c1719"/>
      <rect x="350" y="190" width="100" height="90" rx="12" fill="url(#gold)"/>
      <path d="M300 300 Q300 270 330 270 L470 270 Q500 270 500 300 L510 610 Q510 650 470 650 L330 650 Q290 650 290 610 Z" fill="url(#main)" opacity=".92"/>
      <path d="M320 310 L320 610" stroke="#fff" stroke-width="14" stroke-linecap="round" opacity=".35"/>
      <rect x="330" y="400" width="140" height="120" rx="8" fill="#fff" opacity=".88"/>
      <text x="400" y="452" font-family="Georgia,serif" font-size="22" fill="${dark}" text-anchor="middle" letter-spacing="3">KASHIF</text>
      <line x1="355" y1="470" x2="445" y2="470" stroke="${GOLD}" stroke-width="2"/>
      <text x="400" y="498" font-family="Georgia,serif" font-size="14" fill="${dark}" text-anchor="middle" letter-spacing="2">SKIN · GLOW</text>`;
    case 'perfume':
      return `
      <ellipse cx="400" cy="660" rx="200" ry="30" fill="#000" opacity=".07"/>
      <rect x="360" y="130" width="80" height="110" rx="10" fill="url(#gold)"/>
      <rect x="380" y="235" width="40" height="40" fill="${GOLD_DARK}"/>
      <path d="M260 330 L330 270 L470 270 L540 330 L540 600 L470 660 L330 660 L260 600 Z" fill="url(#main)" opacity=".9"/>
      <path d="M330 270 L400 330 L470 270 M400 330 L400 660 M260 330 L400 330 L540 330" stroke="#fff" stroke-width="3" fill="none" opacity=".35"/>
      <path d="M290 350 L290 580" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity=".3"/>`;
    case 'lace': {
      const scallops = Array.from({ length: 11 }, (_, i) => `<circle cx="${90 + i * 62}" cy="520" r="34" fill="${main}"/>`).join('');
      const holes = Array.from({ length: 11 }, (_, i) => `<circle cx="${90 + i * 62}" cy="528" r="12" fill="url(#bg)"/>`).join('');
      const flowers = Array.from({ length: 6 }, (_, i) => {
        const cx = 120 + i * 112;
        return `<g transform="translate(${cx} 420)">${Array.from({ length: 6 }, (_, j) => `<ellipse rx="10" ry="26" transform="rotate(${j * 60}) translate(0 -22)" fill="${light}"/>`).join('')}<circle r="12" fill="url(#gold)"/></g>`;
      }).join('');
      return `
      <rect x="40" y="330" width="720" height="190" fill="${main}"/>
      <rect x="40" y="330" width="720" height="16" fill="url(#gold)"/>
      <rect x="40" y="488" width="720" height="6" fill="url(#gold)" opacity=".8"/>
      ${scallops}${holes}${flowers}
      <g stroke="${light}" stroke-width="3" fill="none" opacity=".6">
        ${Array.from({ length: 6 }, (_, i) => `<path d="M${64 + i * 112} 380 q28 -26 56 0 t56 0"/>`).join('')}
      </g>
      <path d="M40 330 C 200 250, 600 250, 760 330" stroke="${GOLD}" stroke-width="2" fill="none" opacity=".5"/>`;
    }
    case 'earrings': {
      const one = (x: number) => {
        const pts = (r: number, n: number, from = 0.12, to = 0.88) =>
          Array.from({ length: n }, (_, i) => {
            const a = Math.PI * (from + ((to - from) * i) / (n - 1));
            return { x: -Math.cos(a) * 120, y: 40 + Math.sin(a) * r };
          });
        return `
        <g transform="translate(${x} 230)">
          <circle r="22" fill="url(#gold)"/>
          <line x1="0" y1="22" x2="0" y2="52" stroke="${GOLD}" stroke-width="6"/>
          <path d="M-120 40 A120 120 0 0 0 120 40 A120 72 0 0 1 -120 40 Z" fill="url(#gold)"/>
          <circle cy="70" r="24" fill="url(#gold)"/><circle cy="70" r="13" fill="${main}"/>
          ${pts(97, 7).map((p) => `<circle cx="${p.x * 0.93}" cy="${p.y}" r="10" fill="${main}"/>`).join('')}
          ${pts(120, 9, 0.08, 0.92).map((p) => `<line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y + 26}" stroke="${GOLD}" stroke-width="2"/><circle cx="${p.x}" cy="${p.y + 34}" r="8.5" fill="#FBF6EE" stroke="${GOLD_DARK}" stroke-width="1"/>`).join('')}
        </g>`;
      };
      return one(250) + one(550);
    }
    case 'necklace': {
      const beads = Array.from({ length: 23 }, (_, i) => {
        const a = Math.PI * (0.05 + (i * 0.9) / 22);
        return `<circle cx="${400 - Math.cos(a) * 260}" cy="${200 + Math.sin(a) * 230}" r="${i % 2 ? 12 : 16}" fill="${i % 2 ? '#FBF6EE' : 'url(#gold)'}" stroke="${GOLD_DARK}" stroke-width="1"/>`;
      }).join('');
      return `
      ${beads}
      <g transform="translate(400 470)">
        <path d="M-90 -10 Q0 -60 90 -10 L60 90 Q0 140 -60 90 Z" fill="url(#gold)"/>
        <circle cy="30" r="40" fill="${main}"/>
        <circle cy="30" r="40" fill="url(#sheen)"/>
        ${[-60, -30, 0, 30, 60].map((x) => `<line x1="${x}" y1="${95 - Math.abs(x) / 3}" x2="${x}" y2="${140 - Math.abs(x) / 3}" stroke="${GOLD}" stroke-width="2"/><circle cx="${x}" cy="${148 - Math.abs(x) / 3}" r="9" fill="#FBF6EE" stroke="${GOLD_DARK}"/>`).join('')}
      </g>`;
    }
    case 'bangles':
      return Array.from({ length: 5 }, (_, i) => `
        <ellipse cx="400" cy="${310 + i * 50}" rx="220" ry="70" fill="none" stroke="${i % 2 ? 'url(#gold)' : main}" stroke-width="${i % 2 ? 26 : 20}"/>
        ${i % 2 ? '' : Array.from({ length: 12 }, (_, j) => { const a = (j / 12) * Math.PI * 2; return `<circle cx="${400 + Math.cos(a) * 220}" cy="${310 + i * 50 + Math.sin(a) * 70}" r="5" fill="#fff" opacity=".8"/>`; }).join('')}`).join('');
    case 'tikka':
      return `
      <path d="M400 110 L400 330" stroke="${GOLD}" stroke-width="5" stroke-dasharray="10 6"/>
      <circle cx="400" cy="100" r="18" fill="url(#gold)"/>
      <g transform="translate(400 420)">
        <circle r="110" fill="url(#gold)"/>
        <circle r="80" fill="${main}"/>
        ${Array.from({ length: 12 }, (_, j) => { const a = (j / 12) * Math.PI * 2; return `<circle cx="${Math.cos(a) * 95}" cy="${Math.sin(a) * 95}" r="9" fill="#FBF6EE"/>`; }).join('')}
        <circle r="36" fill="url(#gold)"/>
        ${[-70, -35, 0, 35, 70].map((x) => `<line x1="${x}" y1="${105 - Math.abs(x) / 4}" x2="${x}" y2="${175}" stroke="${GOLD}" stroke-width="2"/><circle cx="${x}" cy="185" r="11" fill="#FBF6EE" stroke="${GOLD_DARK}"/>`).join('')}
      </g>`;
    case 'ring':
      return `
      <ellipse cx="400" cy="640" rx="170" ry="26" fill="#000" opacity=".07"/>
      <ellipse cx="400" cy="480" rx="160" ry="150" fill="none" stroke="url(#gold)" stroke-width="34"/>
      <g transform="translate(400 300)">
        ${Array.from({ length: 12 }, (_, j) => { const a = (j / 12) * Math.PI * 2; return `<circle cx="${Math.cos(a) * 88}" cy="${Math.sin(a) * 70}" r="16" fill="#F4F6FA" stroke="#B8C0CC"/>`; }).join('')}
        <path d="M-60 0 L0 -70 L60 0 L0 70 Z" fill="${main}"/>
        <path d="M-60 0 L0 -70 L0 70 Z" fill="${dark}" opacity=".4"/>
        <path d="M-20 -20 L0 -45" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
      </g>`;
    case 'anklet': {
      const pts = Array.from({ length: 26 }, (_, i) => ({ x: 90 + i * 25, y: 380 + Math.sin(i / 2.2) * 50 }));
      return `
      <polyline points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="url(#gold)" stroke-width="8" stroke-linecap="round"/>
      ${pts.map((p, i) => (i % 3 === 0 ? `<line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y + 40}" stroke="${GOLD}" stroke-width="2"/><circle cx="${p.x}" cy="${p.y + 52}" r="13" fill="url(#gold)"/><circle cx="${p.x}" cy="${p.y + 58}" r="3" fill="${GOLD_DARK}"/>` : `<circle cx="${p.x}" cy="${p.y}" r="7" fill="${main}"/>`)).join('')}`;
    }
  }
}

function svg(kind: ArtKind, main: string, bg: string, variant: 1 | 2 | 3, label: string) {
  const bgA = variant === 1 ? bg : variant === 2 ? shade(bg, -0.06) : shade(main, 0.82);
  const bgB = shade(bgA, -0.08);
  const zoom = variant === 3 ? 'translate(-200 -200) scale(1.5)' : variant === 2 ? 'translate(400 400) scale(-0.92 0.92) translate(-400 -400)' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${shade(bgA, 0.3)}"/><stop offset="1" stop-color="${bgB}"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9D3A6"/><stop offset=".45" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_DARK}"/></linearGradient>
    <linearGradient id="main" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(main, 0.18)}"/><stop offset=".6" stop-color="${main}"/><stop offset="1" stop-color="${shade(main, -0.3)}"/></linearGradient>
    <radialGradient id="sheen" cx="35%" cy="30%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1.6" fill="${GOLD}" opacity=".35"/></pattern>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <rect width="800" height="800" fill="url(#dots)"/>
  <circle cx="400" cy="420" r="300" fill="#fff" opacity=".35"/>
  <g transform="${zoom}">${art(kind, main)}</g>
  <text x="400" y="755" font-family="Georgia,serif" font-size="18" fill="${GOLD_DARK}" text-anchor="middle" letter-spacing="8" opacity=".75">KASHIF COLLECTION</text>
</svg>`;
}

fs.mkdirSync(path.join(OUT, 'products'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'categories'), { recursive: true });

let count = 0;
for (const p of products) {
  const slug = slugify(p.name);
  ([1, 2, 3] as const).forEach((n) => {
    fs.writeFileSync(path.join(OUT, 'products', `${slug}-${n}.svg`), svg(p.art.kind, p.art.colors[0], p.art.colors[1], n, p.name));
    count++;
  });
}
const catArt: Record<string, [ArtKind, string, string]> = {
  cosmetics: ['lipstick', '#9B1B30', '#F6E3E6'],
  lace: ['lace', '#B8875A', '#F7EFE6'],
  'artificial-jewellery': ['earrings', '#7A1F3D', '#F8EEE3'],
};
for (const c of categories) {
  const [kind, main, bg] = catArt[c.slug]!;
  fs.writeFileSync(path.join(OUT, 'categories', `${c.slug}.svg`), svg(kind, main, bg, 1, c.name));
  count++;
}
console.log(`Generated ${count} placeholder images in ${OUT}`);
