// genesis-bot.js
// Run with: node genesis-bot.js
// Sweeps ALL rational billiard configs and feeds Genesis Brain forever

const SUPABASE_URL = 'https://xoolmbmnzbsvcqeyqvyi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhvb2xtYm1uemJzdmNleXhxdnlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDMwNDQsImV4cCI6MjA4NzAxOTA0NH0.ebTwMZ_byU6EXtuR0jynct64QO5ornQrCwElQ5b9TxQ';

const HDRS = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'resolution=merge-duplicates,return=minimal'
};

// ── MATH ──────────────────────────────────────────────────────────────────────
function gcd(a, b) { return b === 0 ? Math.abs(a) : gcd(b, a % b); }

function runBilliard({ sizeX, sizeY, vx, vy, mod = 1000003, steps = 2000 }) {
  let x = 1, y = 1, phase = 1;
  let diagHits = 0, offDiagHits = 0, cornerHits = 0;
  const recentEvents = [];

  for (let t = 0; t < steps; t++) {
    const nx = ((x + vx - 1) % sizeX) + 1;
    const ny = ((y + vy - 1) % sizeY) + 1;
    phase = (phase * 30) % mod;

    const isDiag   = nx === ny;
    const isCorner = (nx===1&&ny===1)||(nx===sizeX&&ny===sizeY)||
                     (nx===1&&ny===sizeY)||(nx===sizeX&&ny===1);

    if (isDiag) diagHits++; else offDiagHits++;
    if (isCorner) cornerHits++;

    recentEvents.push({ t, x: nx, y: ny, phase, isDiag, isCorner });
    if (recentEvents.length > 20) recentEvents.shift();
    x = nx; y = ny;
  }

  const g = gcd(Math.abs(vx), Math.abs(vy));
  const diagRatio = diagHits / steps;
  const winding   = (steps * (vy / g)) / (sizeX * sizeY);

  return {
    totalSteps: steps, diagHits, offDiagHits, cornerHits,
    diagRatio:   parseFloat(diagRatio.toFixed(4)),
    sizeX, sizeY, vx, vy,
    slope:       `${vy/g}/${vx/g}`,
    mod,
    x, y, phase,
    winding:     parseFloat(winding.toFixed(4)),
    x_norm:      (x - 1) / Math.max(sizeX - 1, 1),
    y_norm:      (y - 1) / Math.max(sizeY - 1, 1),
    chaos_ratio: parseFloat((offDiagHits / steps).toFixed(4)),
    recentEvents,
    grade: diagRatio > 0.4 ? 'GRADE_A' : diagRatio > 0.25 ? 'GRADE_B' : 'GRADE_C',
  };
}

// ── ALL RATIONAL ORBITS p/q ≤ 8 ──────────────────────────────────────────────
function getAllOrbits(maxN = 8) {
  const orbits = [];
  for (let p = 1; p <= maxN; p++)
    for (let q = 1; q <= maxN; q++)
      if (gcd(p, q) === 1)
        orbits.push({ p, q, period: p * q, label: `${p}/${q}` });
  return orbits.sort((a, b) => a.period - b.period);
}

// ── WRITE TO SUPABASE ─────────────────────────────────────────────────────────
async function writeToBrain(namespace, payload) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/genesis_brain`, {
      method: 'POST',
      headers: HDRS,
      body: JSON.stringify({
        namespace,
        version: Date.now(),
        payload: { ...payload, _ts: Date.now() }
      })
    });
    return res.ok;
  } catch (e) {
    console.error('Write error:', e.message);
    return false;
  }
}

// ── BOT LOOP ──────────────────────────────────────────────────────────────────
const ORBITS  = getAllOrbits(8);
const DELAY   = 2500; // ms between each orbit
let idx       = 0;
let totalRuns = 0;
let passes    = 0;

console.log(`\n╔══════════════════════════════════════════╗`);
console.log(`║   GENESIS BILLIARD BOT — SWEEPING BRAIN  ║`);
console.log(`╚══════════════════════════════════════════╝`);
console.log(`  ${ORBITS.length} rational orbits (p/q ≤ 8)`);
console.log(`  Writing to namespace: billiard`);
console.log(`  Delay: ${DELAY}ms per orbit\n`);

async function sweep() {
  const orbit  = ORBITS[idx];
  const result = runBilliard({
    sizeX: orbit.p,
    sizeY: orbit.q,
    vx:    orbit.q,
    vy:    orbit.p,
  });

  const ok = await writeToBrain('billiard', result);

  const status = ok ? '✓' : '✗';
  const bar    = '█'.repeat(Math.round((idx / ORBITS.length) * 20)) +
                 '░'.repeat(20 - Math.round((idx / ORBITS.length) * 20));

  console.log(
    `${status} [${bar}] ${String(idx+1).padStart(3)}/${ORBITS.length} ` +
    `orbit=${orbit.label.padEnd(5)} ` +
    `grade=${result.grade} ` +
    `diag=${result.diagRatio.toFixed(3)} ` +
    `chaos=${result.chaos_ratio.toFixed(3)} ` +
    `wind=${result.winding.toFixed(2)}`
  );

  idx++;
  if (idx >= ORBITS.length) {
    idx = 0;
    passes++;
    totalRuns += ORBITS.length;
    console.log(`\n  ── PASS ${passes} COMPLETE · ${totalRuns} total writes ──\n`);
  }
}

// Run immediately then on interval
sweep();
setInterval(sweep, DELAY);

// Keep process alive + show heartbeat every 60s
setInterval(() => {
  console.log(`  ♥  heartbeat · pass=${passes} idx=${idx}/${ORBITS.length} total=${totalRuns}`);
}, 60000);
