import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── CORE MATH ────────────────────────────────────────────────────────────────
function gcd(a, b) { return b === 0 ? Math.abs(a) : gcd(b, a % b); }

function runBilliard({ sizeX, sizeY, vx, vy, mod, steps, x0 = 1, y0 = 1 }) {
  const events = [];
  let x = x0, y = y0, phase = 1;
  for (let t = 0; t < steps; t++) {
    const nx = ((x + vx - 1) % sizeX) + 1;
    const ny = ((y + vy - 1) % sizeY) + 1;
    phase = (phase * mod) % (mod + 2 > 0 ? 1000003 : 1000003);
    const isDiag = (nx === ny);
    const isCorner = (nx === 1 && ny === 1) || (nx === sizeX && ny === sizeY) ||
                     (nx === 1 && ny === sizeY) || (nx === sizeX && ny === 1);
    events.push({ t, x: nx, y: ny, phase, isDiag, isCorner });
    x = nx; y = ny;
  }
  return events;
}

function getAllRationalOrbits(maxN = 6) {
  const orbits = [];
  for (let p = 1; p <= maxN; p++) {
    for (let q = 1; q <= maxN; q++) {
      if (gcd(p, q) === 1) {
        const period = p * q;
        const slope = q / p;
        orbits.push({ p, q, period, slope, label: `${p}/${q}` });
      }
    }
  }
  return orbits.sort((a, b) => a.slope - b.slope);
}

// ─── COLOR PALETTE ────────────────────────────────────────────────────────────
const PALETTE = {
  bg: "#04080f",
  panel: "#080e1a",
  border: "#0f1e33",
  cyan: "#00e5ff",
  magenta: "#ff00aa",
  gold: "#ffd700",
  green: "#00ff88",
  purple: "#aa00ff",
  dim: "#1a2a3a",
  text: "#c8dce8",
  muted: "#4a6a7a",
};

const ORBIT_COLORS = [
  "#00e5ff","#ff00aa","#ffd700","#00ff88","#aa00ff",
  "#ff6600","#00ccff","#ff3366","#88ff00","#ff44cc",
  "#00ffcc","#ffaa00","#6644ff","#ff2200","#00ff44",
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function TorusGrid({ events, sizeX, sizeY, width = 320, height = 320 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = width, H = height;
    const cellW = W / (sizeX + 1);
    const cellH = H / (sizeY + 1);

    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= sizeX; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellW, 0);
      ctx.lineTo(i * cellW, H);
      ctx.stroke();
    }
    for (let j = 1; j <= sizeY; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * cellH);
      ctx.lineTo(W, j * cellH);
      ctx.stroke();
    }

    // Trajectory
    const max = Math.min(events.length, 500);
    for (let i = 1; i < max; i++) {
      const prev = events[i - 1];
      const cur = events[i];
      const t = i / max;
      const r = Math.floor(0 + t * 255);
      const g = Math.floor(229 - t * 100);
      const b = Math.floor(255 - t * 50);
      ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(prev.x * cellW, prev.y * cellH);
      ctx.lineTo(cur.x * cellW, cur.y * cellH);
      ctx.stroke();
    }

    // Corner hits
    events.forEach(e => {
      if (e.isCorner) {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(e.x * cellW, e.y * cellH, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.isDiag) {
        ctx.fillStyle = PALETTE.cyan;
        ctx.beginPath();
        ctx.arc(e.x * cellW, e.y * cellH, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Start point
    if (events.length > 0) {
      const e0 = events[0];
      ctx.strokeStyle = PALETTE.green;
      ctx.lineWidth = 2;
      ctx.strokeRect(e0.x * cellW - 5, e0.y * cellH - 5, 10, 10);
    }
  }, [events, sizeX, sizeY, width, height]);

  return <canvas ref={canvasRef} width={width} height={height}
    style={{ borderRadius: 8, border: `1px solid ${PALETTE.border}` }} />;
}

function PhaseCanvas({ events, width = 320, height = 200 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);

    const max = events.length;
    if (max === 0) return;
    const maxPhase = Math.max(...events.map(e => e.phase));

    events.forEach((e, i) => {
      const px = (i / max) * width;
      const py = height - (e.phase / maxPhase) * height * 0.9 - 4;
      const hue = e.isDiag ? 190 : 330;
      ctx.fillStyle = `hsla(${hue},100%,60%,0.7)`;
      ctx.fillRect(px, py, 1.5, 2);
    });

    // Axis
    ctx.strokeStyle = PALETTE.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(width, height - 1);
    ctx.stroke();
  }, [events, width, height]);

  return <canvas ref={canvasRef} width={width} height={height}
    style={{ borderRadius: 6, border: `1px solid ${PALETTE.border}` }} />;
}

function OrbitLattice({ orbits, selected, onSelect, width = 320, height = 260 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);

    const maxP = Math.max(...orbits.map(o => o.p));
    const maxQ = Math.max(...orbits.map(o => o.q));
    const pad = 30;
    const scaleX = (width - pad * 2) / maxP;
    const scaleY = (height - pad * 2) / maxQ;

    // Diagonal line (slope=1)
    ctx.strokeStyle = PALETTE.dim;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, height - pad);
    ctx.lineTo(width - pad, pad);
    ctx.stroke();
    ctx.setLineDash([]);

    // Farey lines between adjacent fractions
    orbits.forEach((o, i) => {
      orbits.forEach((o2, j) => {
        if (i >= j) return;
        if (Math.abs(o.p * o2.q - o2.p * o.q) === 1) {
          const x1 = pad + (o.p - 1) * scaleX;
          const y1 = height - pad - (o.q - 1) * scaleY;
          const x2 = pad + (o2.p - 1) * scaleX;
          const y2 = height - pad - (o2.q - 1) * scaleY;
          ctx.strokeStyle = "rgba(0,100,150,0.25)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      });
    });

    // Orbit nodes
    orbits.forEach((o, i) => {
      const px = pad + (o.p - 1) * scaleX;
      const py = height - pad - (o.q - 1) * scaleY;
      const isSelected = selected?.label === o.label;
      const color = ORBIT_COLORS[i % ORBIT_COLORS.length];
      const r = isSelected ? 8 : 4 + Math.log(o.period + 1);

      if (isSelected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
      }
      ctx.fillStyle = isSelected ? color : color + "aa";
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isSelected || o.p <= 3 && o.q <= 3) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = `${isSelected ? "bold " : ""}10px monospace`;
        ctx.fillText(o.label, px + 6, py - 4);
      }
    });

    // Axes labels
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "10px monospace";
    ctx.fillText("p →", width - 22, height - 6);
    ctx.fillText("q", 4, 14);
  }, [orbits, selected, width, height]);

  const handleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const maxP = Math.max(...orbits.map(o => o.p));
    const maxQ = Math.max(...orbits.map(o => o.q));
    const pad = 30;
    const scaleX = (width - pad * 2) / maxP;
    const scaleY = (height - pad * 2) / maxQ;
    let best = null, bestDist = 20;
    orbits.forEach(o => {
      const px = pad + (o.p - 1) * scaleX;
      const py = height - pad - (o.q - 1) * scaleY;
      const d = Math.hypot(mx - px, my - py);
      if (d < bestDist) { bestDist = d; best = o; }
    });
    if (best) onSelect(best);
  }, [orbits, onSelect, width, height]);

  return (
    <canvas ref={canvasRef} width={width} height={height}
      onClick={handleClick}
      style={{ borderRadius: 8, border: `1px solid ${PALETTE.border}`, cursor: "crosshair" }} />
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ color: color || PALETTE.cyan, fontFamily: "monospace", fontSize: 22, fontWeight: 700, letterSpacing: -1 }}>{value}</span>
      <span style={{ color: PALETTE.muted, fontFamily: "monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: 2 }}>{label}</span>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function GenesisGrid() {
  const [sizeX, setSizeX] = useState(3);
  const [sizeY, setSizeY] = useState(3);
  const [vx, setVx] = useState(3);
  const [vy, setVy] = useState(4);
  const [steps, setSteps] = useState(2000);
  const [mod] = useState(1000003);
  const [tab, setTab] = useState("grid");
  const [selectedOrbit, setSelectedOrbit] = useState(null);

  const events = useMemo(() =>
    runBilliard({ sizeX, sizeY, vx, vy, mod, steps }),
    [sizeX, sizeY, vx, vy, mod, steps]
  );

  const diagHits = useMemo(() => events.filter(e => e.isDiag).length, [events]);
  const offDiagHits = useMemo(() => events.filter(e => !e.isDiag).length, [events]);
  const cornerHits = useMemo(() => events.filter(e => e.isCorner).length, [events]);
  const uniquePhases = useMemo(() => new Set(events.map(e => e.phase)).size, [events]);
  const g = useMemo(() => gcd(Math.abs(vx), Math.abs(vy)), [vx, vy]);
  const reducedVx = vx / g, reducedVy = vy / g;

  const orbits = useMemo(() => getAllRationalOrbits(6), []);

  const orbitEvents = useMemo(() => {
    if (!selectedOrbit) return [];
    return runBilliard({ sizeX: selectedOrbit.p, sizeY: selectedOrbit.q, vx: 1, vy: 1, mod, steps: selectedOrbit.period * 3 });
  }, [selectedOrbit, mod]);

  const TABS = [
    { id: "grid", label: "Grid" },
    { id: "phase", label: "Phase" },
    { id: "lattice", label: "Lattice" },
    { id: "data", label: "Data" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: PALETTE.bg,
      color: PALETTE.text,
      fontFamily: "'Courier New', monospace",
      padding: 0,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: PALETTE.panel,
        borderBottom: `1px solid ${PALETTE.border}`,
        padding: "14px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ color: PALETTE.cyan, fontSize: 18, fontWeight: 700, letterSpacing: 3 }}>GENESIS</span>
          <span style={{ color: PALETTE.muted, fontSize: 11, letterSpacing: 2 }}>RATIONAL BILLIARD BASELINE</span>
        </div>
        <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 1 }}>
          ALL RATIONAL CLOSED VOIDS · CORNER REFLECTOR · {sizeX}×{sizeY} TORUS
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background: PALETTE.panel,
        borderBottom: `1px solid ${PALETTE.border}`,
        padding: "12px 20px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
      }}>
        {[
          { label: "SIZE X", val: sizeX, set: setSizeX, min: 2, max: 8 },
          { label: "SIZE Y", val: sizeY, set: setSizeY, min: 2, max: 8 },
          { label: "VEL X", val: vx, set: setVx, min: 1, max: 12 },
          { label: "VEL Y", val: vy, set: setVy, min: 1, max: 12 },
          { label: "STEPS", val: steps, set: setSteps, min: 100, max: 5000, step: 100 },
        ].map(c => (
          <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ color: PALETTE.muted, fontSize: 8, letterSpacing: 2 }}>{c.label}</span>
            <input
              type="number"
              value={c.val}
              min={c.min}
              max={c.max}
              step={c.step || 1}
              onChange={e => c.set(Number(e.target.value))}
              style={{
                background: PALETTE.bg,
                border: `1px solid ${PALETTE.border}`,
                color: PALETTE.cyan,
                fontFamily: "monospace",
                fontSize: 13,
                padding: "4px 8px",
                borderRadius: 4,
                width: "100%",
                outline: "none",
              }}
            />
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{
        background: "#060c14",
        borderBottom: `1px solid ${PALETTE.border}`,
        padding: "14px 20px",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <StatBadge label="Diagonal Hits" value={diagHits} color={PALETTE.cyan} />
        <StatBadge label="Off-Diag" value={offDiagHits} color={PALETTE.magenta} />
        <StatBadge label="Corners" value={cornerHits} color={PALETTE.gold} />
        <StatBadge label="Unique φ" value={uniquePhases} color={PALETTE.green} />
        <StatBadge label="Slope" value={`${reducedVy}/${reducedVx}`} color={PALETTE.purple} />
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        borderBottom: `1px solid ${PALETTE.border}`,
        background: PALETTE.panel,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px 0",
              background: tab === t.id ? PALETTE.bg : "transparent",
              border: "none",
              borderBottom: tab === t.id ? `2px solid ${PALETTE.cyan}` : "2px solid transparent",
              color: tab === t.id ? PALETTE.cyan : PALETTE.muted,
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: 2,
              cursor: "pointer",
              textTransform: "uppercase",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 16, flex: 1, overflowY: "auto" }}>

        {tab === "grid" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>
                BILLIARD TRAJECTORY · {sizeX}×{sizeY} GRID → {sizeX * 2}×{sizeY * 2} TORUS
              </div>
              <TorusGrid events={events} sizeX={sizeX} sizeY={sizeY} width={340} height={300} />
              <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 9, color: PALETTE.muted }}>
                <span style={{ color: PALETTE.cyan }}>● diagonal hits</span>
                <span style={{ color: PALETTE.gold }}>● corner hits</span>
                <span style={{ color: PALETTE.green }}>□ start</span>
              </div>
            </div>

            <div style={{
              background: PALETTE.panel,
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 8,
              padding: 14,
            }}>
              <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2, marginBottom: 10 }}>MANIFOLD SUMMARY</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  ["Torus Dims", `${sizeX * 2}×${sizeY * 2}`],
                  ["Manifold Dim", "2+1"],
                  ["GCD(vx,vy)", `${g}`],
                  ["Reduced slope", `${reducedVy}/${reducedVx}`],
                  ["Orbit type", g === 1 ? "Open/Ergodic" : "Closed"],
                  ["Phase mod", "1000003"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: PALETTE.muted, fontSize: 8, letterSpacing: 1 }}>{k}</span>
                    <span style={{ color: PALETTE.text, fontSize: 12, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "phase" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>PHASE DIMENSION · φ vs TIME</div>
              <PhaseCanvas events={events} width={340} height={180} />
              <div style={{ marginTop: 6, fontSize: 9, color: PALETTE.muted, display: "flex", gap: 12 }}>
                <span style={{ color: PALETTE.cyan }}>■ diagonal</span>
                <span style={{ color: PALETTE.magenta }}>■ off-diagonal</span>
              </div>
            </div>

            <div style={{
              background: PALETTE.panel,
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 8,
              padding: 14,
            }}>
              <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2, marginBottom: 10 }}>PHASE STATISTICS</div>
              {[
                ["Total events", events.length],
                ["Unique phases", uniquePhases],
                ["Phase density", (uniquePhases / events.length).toFixed(4)],
                ["Phase winding", (Math.log(uniquePhases) / Math.log(events.length)).toFixed(4)],
                ["Diagonal ratio", (diagHits / events.length).toFixed(4)],
                ["Corner ratio", (cornerHits / events.length).toFixed(6)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${PALETTE.dim}` }}>
                  <span style={{ color: PALETTE.muted, fontSize: 10 }}>{k}</span>
                  <span style={{ color: PALETTE.green, fontSize: 10, fontFamily: "monospace" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "lattice" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2, marginBottom: 4 }}>
                RATIONAL ORBIT LATTICE · ALL CLOSED VOIDS p/q ≤ 6
              </div>
              <div style={{ color: PALETTE.muted, fontSize: 8, marginBottom: 8 }}>
                Tap any node to inspect its orbit
              </div>
              <OrbitLattice orbits={orbits} selected={selectedOrbit} onSelect={setSelectedOrbit} width={340} height={260} />
            </div>

            {selectedOrbit && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{
                  background: PALETTE.panel,
                  border: `1px solid ${PALETTE.border}`,
                  borderRadius: 8,
                  padding: 14,
                }}>
                  <div style={{ color: PALETTE.cyan, fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
                    ORBIT {selectedOrbit.label} — p={selectedOrbit.p}, q={selectedOrbit.q}
                  </div>
                  {[
                    ["Period", selectedOrbit.period],
                    ["Slope", selectedOrbit.slope.toFixed(4)],
                    ["GCD", gcd(selectedOrbit.p, selectedOrbit.q)],
                    ["Type", "Closed rational"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ color: PALETTE.muted, fontSize: 10 }}>{k}</span>
                      <span style={{ color: PALETTE.text, fontSize: 10 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>
                    ORBIT TRAJECTORY
                  </div>
                  <TorusGrid events={orbitEvents} sizeX={selectedOrbit.p} sizeY={selectedOrbit.q} width={340} height={240} />
                </div>
              </div>
            )}

            {!selectedOrbit && (
              <div style={{
                background: PALETTE.panel,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 8,
                padding: 14,
              }}>
                <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>ALL RATIONAL ORBITS</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                  {orbits.map((o, i) => (
                    <div key={o.label}
                      onClick={() => setSelectedOrbit(o)}
                      style={{
                        background: PALETTE.bg,
                        border: `1px solid ${ORBIT_COLORS[i % ORBIT_COLORS.length]}44`,
                        borderRadius: 4,
                        padding: "6px 4px",
                        textAlign: "center",
                        cursor: "pointer",
                      }}>
                      <span style={{ color: ORBIT_COLORS[i % ORBIT_COLORS.length], fontSize: 12, fontWeight: 700 }}>{o.label}</span>
                      <div style={{ color: PALETTE.muted, fontSize: 8 }}>T={o.period}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "data" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2 }}>RUN SUMMARY · FIRST 20 EVENTS</div>
            <div style={{
              background: PALETTE.panel,
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 8,
              overflow: "hidden",
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "40px 40px 40px 40px 80px 60px",
                padding: "6px 10px",
                borderBottom: `1px solid ${PALETTE.border}`,
              }}>
                {["#", "X", "Y", "Diag", "Phase", "Type"].map(h => (
                  <span key={h} style={{ color: PALETTE.muted, fontSize: 8, letterSpacing: 1 }}>{h}</span>
                ))}
              </div>
              {events.slice(0, 20).map((e, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "40px 40px 40px 40px 80px 60px",
                  padding: "5px 10px",
                  borderBottom: `1px solid ${PALETTE.dim}`,
                  background: e.isCorner ? "#1a120000" : "transparent",
                }}>
                  <span style={{ color: PALETTE.muted, fontSize: 9 }}>{e.t}</span>
                  <span style={{ color: PALETTE.text, fontSize: 9 }}>{e.x}</span>
                  <span style={{ color: PALETTE.text, fontSize: 9 }}>{e.y}</span>
                  <span style={{ color: e.isDiag ? PALETTE.cyan : PALETTE.muted, fontSize: 9 }}>
                    {e.isDiag ? "●" : "○"}
                  </span>
                  <span style={{ color: PALETTE.purple, fontSize: 8, fontFamily: "monospace" }}>
                    {e.phase}
                  </span>
                  <span style={{
                    color: e.isCorner ? PALETTE.gold : e.isDiag ? PALETTE.cyan : PALETTE.muted,
                    fontSize: 8,
                  }}>
                    {e.isCorner ? "CORNER" : e.isDiag ? "DIAG" : "off"}
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              background: PALETTE.panel,
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 8,
              padding: 14,
            }}>
              <div style={{ color: PALETTE.muted, fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>SPACING STATISTICS</div>
              {(() => {
                const diagSteps = events.filter(e => e.isDiag).map(e => e.t);
                const spacings = diagSteps.slice(1).map((t, i) => t - diagSteps[i]);
                const mean = spacings.length ? (spacings.reduce((a, b) => a + b, 0) / spacings.length).toFixed(3) : "—";
                const unique = new Set(spacings).size;
                return [
                  ["Diag spacing mean", mean],
                  ["Unique spacings", unique],
                  ["Min corner dist", events.filter(e => e.isCorner).length > 0 ? "0.000" : "∞"],
                  ["Phase mean", (events.reduce((a, e) => a + e.phase, 0) / events.length).toFixed(0)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid ${PALETTE.dim}` }}>
                    <span style={{ color: PALETTE.muted, fontSize: 10 }}>{k}</span>
                    <span style={{ color: PALETTE.green, fontSize: 10, fontFamily: "monospace" }}>{v}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${PALETTE.border}`,
        padding: "8px 20px",
        display: "flex",
        justifyContent: "space-between",
        background: PALETTE.panel,
      }}>
        <span style={{ color: PALETTE.muted, fontSize: 8, letterSpacing: 2 }}>CORNER REFLECTOR · MOD {mod}</span>
        <span style={{ color: PALETTE.muted, fontSize: 8, letterSpacing: 1 }}>
          {orbits.length} RATIONAL ORBITS INDEXED
        </span>
      </div>
    </div>
  );
}
