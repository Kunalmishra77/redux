// Generates the demo "site photos": one before (scaled, tarnished) and one after (restored) SVG per
// fitting type and finish, into public/demo/fittings/. Placeholder art until REDUX's real
// before/after photography arrives (client input A6). Run: node scripts/demo/make-photos.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = 'public/demo/fittings'
mkdirSync(OUT, { recursive: true })

const FINISH = {
  chrome: { base: '#C9CFD6', hi: '#F4F7FA', lo: '#8E969F' },
  pvd_brushed_gold: { base: '#C9A55C', hi: '#EED9A2', lo: '#8C6D2E' },
  pvd_matte_black: { base: '#2B2D31', hi: '#55585E', lo: '#131417' },
}

// Simple silhouettes, 400×300 viewBox
const SHAPES = {
  basin_mixer: (f) => `
    <rect x="170" y="200" width="60" height="40" rx="6" fill="url(#m)"/>
    <path d="M185 205 V120 Q185 95 210 95 H300 Q312 95 312 107 V118 H290 V112 H215 Q205 112 205 122 V205 Z" fill="url(#m)"/>
    <rect x="180" y="70" width="40" height="18" rx="6" fill="url(#m)"/>
    <rect x="196" y="84" width="8" height="16" fill="${f.lo}"/>`,
  shower_mixer: (f) => `
    <circle cx="200" cy="150" r="78" fill="url(#m)"/>
    <circle cx="200" cy="150" r="52" fill="${f.lo}" opacity=".35"/>
    <rect x="192" y="95" width="16" height="60" rx="8" fill="url(#m)" transform="rotate(-30 200 150)"/>
    <circle cx="200" cy="150" r="16" fill="url(#m)"/>`,
  diverter: (f) => `
    <rect x="120" y="110" width="160" height="80" rx="40" fill="url(#m)"/>
    <circle cx="200" cy="150" r="30" fill="${f.lo}" opacity=".4"/>
    <rect x="186" y="100" width="28" height="100" rx="14" fill="url(#m)"/>`,
  health_faucet: (f) => `
    <rect x="130" y="95" width="120" height="44" rx="22" fill="url(#m)"/>
    <rect x="230" y="104" width="46" height="26" rx="10" fill="url(#m)"/>
    <path d="M140 138 Q120 220 200 245" stroke="${f.lo}" stroke-width="9" fill="none"/>
    <rect x="165" y="120" width="10" height="26" rx="4" fill="${f.lo}"/>`,
  spout: () => `
    <rect x="80" y="120" width="40" height="60" rx="8" fill="url(#m)"/>
    <path d="M115 130 H290 Q315 130 315 155 V175 H292 V158 Q292 152 286 152 H115 Z" fill="url(#m)"/>`,
  shower_head: (f) => `
    <rect x="190" y="40" width="20" height="70" fill="url(#m)"/>
    <ellipse cx="200" cy="150" rx="95" ry="42" fill="url(#m)"/>
    <ellipse cx="200" cy="160" rx="80" ry="26" fill="${f.lo}" opacity=".35"/>
    ${Array.from({ length: 12 }, (_, i) => `<circle cx="${135 + (i % 6) * 26}" cy="${154 + Math.floor(i / 6) * 14}" r="3" fill="${f.lo}"/>`).join('')}`,
}

function svg(type, finish, state) {
  const f = FINISH[finish]
  const before = state === 'before'
  const wall = before ? '#D8D2C6' : '#E9EEF5'
  const grime = before
    ? `<g opacity=".55">
         ${Array.from({ length: 26 }, (_, i) => `<circle cx="${110 + ((i * 53) % 190)}" cy="${80 + ((i * 37) % 160)}" r="${3 + (i % 5) * 2}" fill="#F3EBD8"/>`).join('')}
         <path d="M150 120 q30 60 90 40 q-20 50 -80 40 z" fill="#B99A63" opacity=".5"/>
       </g>`
    : `<path d="M140 90 q20 -10 40 0" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".8"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="m" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${before ? f.lo : f.hi}"/>
      <stop offset=".5" stop-color="${before ? '#9A958A' : f.base}"/>
      <stop offset="1" stop-color="${f.lo}"/>
    </linearGradient>
    <pattern id="tiles" width="50" height="50" patternUnits="userSpaceOnUse">
      <rect width="50" height="50" fill="${wall}"/><path d="M50 0 V50 H0" fill="none" stroke="${before ? '#C2B9A8' : '#D5DEEA'}" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="400" height="300" fill="url(#tiles)"/>
  ${SHAPES[type](f)}
  ${grime}
</svg>`
}

let n = 0
for (const type of Object.keys(SHAPES)) {
  for (const finish of Object.keys(FINISH)) {
    for (const state of ['before', 'after']) {
      writeFileSync(`${OUT}/${type}-${finish}-${state}.svg`, svg(type, finish, state))
      n++
    }
  }
}
console.log(`wrote ${n} demo photos to ${OUT}`)
