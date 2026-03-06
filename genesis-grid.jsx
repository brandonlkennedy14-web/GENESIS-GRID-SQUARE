import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── CORE MATH ────────────────────────────────────────────────────────────────
function gcd(a, b) { return b === 0 ? Math.abs(a) : gcd(b, a % b); }

function runBilliard({ sizeX, sizeY, vx, vy, mod, steps, x0 = 1, y0 = 1 }) {
  const events = [];
  let x = x0, y = y0, phase = 1;
  for (let t = 0; t < steps; t++) {
    const nx = ((x + vx - 1) % sizeX) + 1;
    const ny = ((y + vy - 1) % sizeY) + 1;
    phase = (phase * 30) % mod;
    const isDiag   = nx === ny;
    const isCorner = (nx===1&&ny===1)||(nx===sizeX&&ny===sizeY)||(nx===1&&ny===sizeY)||(nx===sizeX&&ny===1);
    events.push({ t, x: nx, y: ny, phase, isDiag, isCorner });
    x = nx; y = ny;
  }
  return events;
}

function getAllRationalOrbits(maxN = 6) {
  const orbits = [];
  for (let p = 1; p <= maxN; p++)
    for (let q = 1; q <= maxN; q++)
      if (gcd(p, q) === 1)
        orbits.push({ p, q, period: p * q, slope: q / p, label: `${p}/${q}` });
  return orbits.sort((a, b) => a.slope - b.slope);
}

const ALL_ORBITS = getAllRationalOrbits(6);

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const P = {
  bg: "#04080f", panel: "#080e1a", border: "#0f1e33",
  cyan: "#00e5ff", magenta: "#ff00aa", gold: "#ffd700",
  green: "#00ff88", purple: "#aa00ff", dim: "#1a2a3a",
  text: "#c8dce8", muted: "#4a6a7a",
};
const ORBIT_COLORS = [
  "#00e5ff","#ff00aa","#ffd700","#00ff88","#aa00ff",
  "#ff6600","#00ccff","#ff3366","#88ff00","#ff44cc",
  "#00ffcc","#ffaa00","#6644ff","#ff2200","#00ff44",
];

// ─── GENESIS BRAIN WRITE ──────────────────────────────────────────────────────
function writeToBrain(payload) {
  if (window.GenesisBrain?.write) {
    window.GenesisBrain.write('billiard', payload);
  }
}

// ─── CANVAS: BILLIARD GRID ────────────────────────────────────────────────────
function TorusGrid({ events, sizeX, sizeY, width = 320, height = 280 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cw = width, ch = height;
    const cellW = cw / (sizeX + 1), cellH = ch / (sizeY + 1);
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = P.border; ctx.lineWidth = 0.5;
    for (let i = 1; i <= sizeX; i++) { ctx.beginPath(); ctx.moveTo(i*cellW,0); ctx.lineTo(i*cellW,ch); ctx.stroke(); }
    for (let j = 1; j <= sizeY; j++) { ctx.beginPath(); ctx.moveTo(0,j*cellH); ctx.lineTo(cw,j*cellH); ctx.stroke(); }
    const max = Math.min(events.length, 600);
    for (let i = 1; i < max; i++) {
      const prev = events[i-1], cur = events[i];
      const t = i / max;
      ctx.strokeStyle = `hsla(${190 + t*140},100%,60%,0.55)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(prev.x*cellW, prev.y*cellH); ctx.lineTo(cur.x*cellW, cur.y*cellH); ctx.stroke();
    }
    events.forEach(e => {
      if (e.isCorner) { ctx.fillStyle = P.gold; ctx.shadowColor = P.gold; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(e.x*cellW, e.y*cellH, 5, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur=0; }
      else if (e.isDiag) { ctx.fillStyle = P.cyan; ctx.beginPath(); ctx.arc(e.x*cellW, e.y*cellH, 2.5, 0, Math.PI*2); ctx.fill(); }
    });
    if (events.length > 0) {
      const e0 = events[0];
      ctx.strokeStyle = P.green; ctx.lineWidth = 2;
      ctx.strokeRect(e0.x*cellW-5, e0.y*cellH-5, 10, 10);
    }
  }, [events, sizeX, sizeY, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ borderRadius: 8, border: `1px solid ${P.border}` }} />;
}

// ─── CANVAS: PHASE SPACE ──────────────────────────────────────────────────────
function PhaseSpace({ events, width = 320, height = 280 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, width, height);

    if (events.length < 2) return;

    // Plot (x, phase % height) as a 2D scatter — this IS the phase space
    const maxPhase = 1000003;
    const sizeX = Math.max(...events.map(e => e.x));
    const sizeY = Math.max(...events.map(e => e.y));

    // Draw phase portrait: x position vs phase angle
    events.forEach((e, i) => {
      const px = (e.x / (sizeX + 1)) * width;
      const py = height - ((e.phase / maxPhase) * height * 0.95) - 2;
      const hue = e.isDiag ? 190 : 330;
      const alpha = e.isCorner ? 1.0 : 0.6;
      ctx.fillStyle = `hsla(${hue},100%,${e.isCorner ? 80 : 60}%,${alpha})`;
      const r = e.isCorner ? 4 : e.isDiag ? 2 : 1.2;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
    });

    // Connect trajectory in phase space
    ctx.strokeStyle = "rgba(0,229,255,0.15)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    events.slice(0, 300).forEach((e, i) => {
      const px = (e.x / (sizeX + 1)) * width;
      const py = height - ((e.phase / maxPhase) * height * 0.95) - 2;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Axes
    ctx.strokeStyle = P.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, height-1); ctx.lineTo(width, height-1); ctx.stroke();
    ctx.fillStyle = P.muted; ctx.font = "9px monospace";
    ctx.fillText("x →", width-24, height-4);
    ctx.fillText("φ", 4, 12);
  }, [events, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ borderRadius: 8, border: `1px solid ${P.border}` }} />;
}

// ─── CANVAS: ORBIT LATTICE ────────────────────────────────────────────────────
function OrbitLattice({ selected, onSelect, width = 320, height = 240 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, width, height);
    const pad = 28;
    const scaleX = (width - pad*2) / 6;
    const scaleY = (height - pad*2) / 6;

    // Farey connections
    ALL_ORBITS.forEach((o, i) => {
      ALL_ORBITS.forEach((o2, j) => {
        if (i >= j) return;
        if (Math.abs(o.p * o2.q - o2.p * o.q) === 1) {
          ctx.strokeStyle = "rgba(0,100,150,0.2)"; ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(pad + (o.p-1)*scaleX,  height-pad - (o.q-1)*scaleY);
          ctx.lineTo(pad + (o2.p-1)*scaleX, height-pad - (o2.q-1)*scaleY);
          ctx.stroke();
        }
      });
    });

    ALL_ORBITS.forEach((o, i) => {
      const px = pad + (o.p-1)*scaleX;
      const py = height-pad - (o.q-1)*scaleY;
      const isSel = selected?.label === o.label;
      const color = ORBIT_COLORS[i % ORBIT_COLORS.length];
      const r = isSel ? 9 : 4 + Math.log(o.period+1)*0.8;
      if (isSel) { ctx.shadowColor = color; ctx.shadowBlur = 18; }
      ctx.fillStyle = isSel ? color : color + "99";
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
      if (isSel || (o.p <= 2 && o.q <= 3)) {
        ctx.fillStyle = P.text; ctx.font = `${isSel?"bold ":""}9px monospace`;
        ctx.fillText(o.label, px+6, py-3);
      }
    });
    ctx.fillStyle = P.muted; ctx.font = "9px monospace";
    ctx.fillText("p →", width-24, height-4); ctx.fillText("q", 4, 12);
  }, [selected, width, height]);

  const handleClick = useCallback(e => {
    const rect = ref.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const pad = 28, scaleX = (width-pad*2)/6, scaleY = (height-pad*2)/6;
    let best = null, bestD = 18;
    ALL_ORBITS.forEach(o => {
      const d = Math.hypot(mx - (pad+(o.p-1)*scaleX), my - (height-pad-(o.q-1)*scaleY));
      if (d < bestD) { bestD = d; best = o; }
    });
    if (best) onSelect(best);
  }, [onSelect, width, height]);

  return <canvas ref={ref} width={width} height={height} onClick={handleClick}
    style={{ borderRadius: 8, border: `1px solid ${P.border}`, cursor: "crosshair" }} />;
}

// ─── STAT BADGE ───────────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
      <span style={{ color: color||P.cyan, fontFamily:"monospace", fontSize:20, fontWeight:700 }}>{value}</span>
      <span style={{ color: P.muted, fontFamily:"monospace", fontSize:8, textTransform:"uppercase", letterSpacing:2 }}>{label}</span>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function GenesisGrid() {
  const [sizeX, setSizeX] = useState(3);
  const [sizeY, setSizeY] = useState(3);
  const [vx, setVx]       = useState(3);
  const [vy, setVy]       = useState(4);
  const [steps, setSteps] = useState(2000);
  const mod = 1000003;
  const [tab, setTab]             = useState("grid");
  const [selectedOrbit, setSelectedOrbit] = useState(null);

  // Auto-sweep state
  const [autoRun, setAutoRun]         = useState(false);
  const [autoIdx, setAutoIdx]         = useState(0);
  const [autoLog, setAutoLog]         = useState([]);
  const [brainConnected, setBrainConnected] = useState(false);
  const autoRef = useRef(null);

  const events = useMemo(() => runBilliard({ sizeX, sizeY, vx, vy, mod, steps }), [sizeX, sizeY, vx, vy, steps]);

  const diagHits    = useMemo(() => events.filter(e => e.isDiag).length,   [events]);
  const offDiagHits = useMemo(() => events.filter(e => !e.isDiag).length,  [events]);
  const cornerHits  = useMemo(() => events.filter(e => e.isCorner).length, [events]);
  const g           = useMemo(() => gcd(Math.abs(vx), Math.abs(vy)),       [vx, vy]);

  // Connect GenesisBrain on mount
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!window.GenesisBrain) return;
      await window.GenesisBrain.connect();
      setBrainConnected(true);
    }, 600);
    return () => clearTimeout(t);
  }, []);

  // Write to brain whenever config changes
  useEffect(() => {
    if (!brainConnected) return;
    const diagRatio  = diagHits / events.length;
    const winding    = (events.length * (vy / g)) / (sizeX * sizeY);
    writeToBrain({
      totalSteps: events.length, diagHits, offDiagHits, cornerHits,
      diagRatio:   parseFloat(diagRatio.toFixed(4)),
      sizeX, sizeY, vx, vy, slope: `${vy/g}/${vx/g}`, mod,
      winding:     parseFloat(winding.toFixed(4)),
      x_norm:      (sizeX - 1) / (sizeX - 1 || 1),
      y_norm:      (sizeY - 1) / (sizeY - 1 || 1),
      chaos_ratio: parseFloat((offDiagHits / events.length).toFixed(4)),
      recentEvents: events.slice(-20),
      grade: diagRatio > 0.4 ? 'GRADE_A' : diagRatio > 0.25 ? 'GRADE_B' : 'GRADE_C',
    });
  }, [events, brainConnected]);

  // Auto-sweep through all rational orbits
  useEffect(() => {
    if (!autoRun) { if (autoRef.current) clearInterval(autoRef.current); return; }
    autoRef.current = setInterval(() => {
      setAutoIdx(idx => {
        const next = (idx + 1) % ALL_ORBITS.length;
        const o = ALL_ORBITS[next];
        setSizeX(o.p);
        setSizeY(o.q);
        setVx(o.q);
        setVy(o.p);
        setAutoLog(log => {
          const entry = `[${o.label}] p=${o.p} q=${o.q} T=${o.period}`;
          return [entry, ...log].slice(0, 30);
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(autoRef.current);
  }, [autoRun]);

  const currentOrbit = ALL_ORBITS[autoIdx];
  const TABS = ["grid","phase","lattice","auto","data"];

  return (
    <div style={{ minHeight:"100vh", background:P.bg, color:P.text, fontFamily:"'Courier New',monospace", display:"flex", flexDirection:"column" }}>

      {/* Header */}
      <div style={{ background:P.panel, borderBottom:`1px solid ${P.border}`, padding:"12px 18px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <span style={{ color:P.cyan, fontSize:16, fontWeight:700, letterSpacing:3 }}>GENESIS</span>
            <span style={{ color:P.muted, fontSize:9, letterSpacing:2, marginLeft:10 }}>RATIONAL BILLIARD BASELINE</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background: brainConnected ? P.green : P.muted, boxShadow: brainConnected ? `0 0 8px ${P.green}` : "none" }} />
            <span style={{ color: brainConnected ? P.green : P.muted, fontSize:8, letterSpacing:2 }}>
              {brainConnected ? "BRAIN LIVE" : "CONNECTING"}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ background:P.panel, borderBottom:`1px solid ${P.border}`, padding:"10px 18px", display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
        {[["SX",sizeX,setSizeX,2,8],["SY",sizeY,setSizeY,2,8],["VX",vx,setVx,1,12],["VY",vy,setVy,1,12],["STEPS",steps,setSteps,100,5000]].map(([l,v,s,mn,mx]) => (
          <div key={l} style={{ display:"flex", flexDirection:"column", gap:2 }}>
            <span style={{ color:P.muted, fontSize:7, letterSpacing:2 }}>{l}</span>
            <input type="number" value={v} min={mn} max={mx} step={l==="STEPS"?100:1}
              onChange={e => s(Number(e.target.value))}
              style={{ background:P.bg, border:`1px solid ${P.border}`, color:P.cyan, fontFamily:"monospace", fontSize:12, padding:"3px 6px", borderRadius:4, width:"100%", outline:"none" }} />
          </div>
        ))}
      </div>

      {/* Stats */}
      <div style={{ background:"#060c14", borderBottom:`1px solid ${P.border}`, padding:"12px 18px", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <Stat label="Diagonal" value={diagHits} color={P.cyan} />
        <Stat label="Off-Diag" value={offDiagHits} color={P.magenta} />
        <Stat label="Corners" value={cornerHits} color={P.gold} />
        <Stat label="Slope" value={`${vy/g}/${vx/g}`} color={P.purple} />
        <Stat label="Grade" value={diagHits/events.length > 0.4 ? "A" : diagHits/events.length > 0.25 ? "B" : "C"} color={P.green} />
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`1px solid ${P.border}`, background:P.panel }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, padding:"9px 0", background: tab===t ? P.bg : "transparent",
            border:"none", borderBottom: tab===t ? `2px solid ${P.cyan}` : "2px solid transparent",
            color: tab===t ? P.cyan : P.muted, fontFamily:"monospace", fontSize:10,
            letterSpacing:2, cursor:"pointer", textTransform:"uppercase"
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:14, flex:1, overflowY:"auto" }}>

        {tab === "grid" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ color:P.muted, fontSize:8, letterSpacing:2 }}>BILLIARD TRAJECTORY · {sizeX}×{sizeY} → {sizeX*2}×{sizeY*2} TORUS</div>
            <TorusGrid events={events} sizeX={sizeX} sizeY={sizeY} width={340} height={280} />
            <div style={{ fontSize:8, color:P.muted, display:"flex", gap:14 }}>
              <span style={{color:P.cyan}}>● diagonal</span>
              <span style={{color:P.gold}}>● corner</span>
              <span style={{color:P.green}}>□ start</span>
            </div>
          </div>
        )}

        {tab === "phase" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ color:P.muted, fontSize:8, letterSpacing:2 }}>PHASE SPACE · POSITION × PHASE ANGLE</div>
            <PhaseSpace events={events} width={340} height={280} />
            <div style={{ fontSize:8, color:P.muted, display:"flex", gap:14 }}>
              <span style={{color:"hsl(190,100%,60%)"}}>■ diagonal</span>
              <span style={{color:"hsl(330,100%,60%)"}}>■ off-diagonal</span>
              <span style={{color:P.gold}}>● corner</span>
            </div>
            <div style={{ background:P.panel, border:`1px solid ${P.border}`, borderRadius:8, padding:12 }}>
              <div style={{ color:P.muted, fontSize:8, letterSpacing:2, marginBottom:8 }}>PHASE STATISTICS</div>
              {[
                ["Unique phases", new Set(events.map(e=>e.phase)).size],
                ["Phase density", (new Set(events.map(e=>e.phase)).size / events.length).toFixed(4)],
                ["Phase winding", (Math.log(new Set(events.map(e=>e.phase)).size) / Math.log(events.length)).toFixed(4)],
                ["Diag ratio",    (diagHits / events.length).toFixed(4)],
                ["Corner ratio",  (cornerHits / events.length).toFixed(6)],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:`1px solid ${P.dim}` }}>
                  <span style={{color:P.muted, fontSize:10}}>{k}</span>
                  <span style={{color:P.green, fontSize:10}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "lattice" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ color:P.muted, fontSize:8, letterSpacing:2 }}>ALL RATIONAL ORBITS · FAREY LATTICE · TAP TO INSPECT</div>
            <OrbitLattice selected={selectedOrbit} onSelect={setSelectedOrbit} width={340} height={240} />
            {selectedOrbit ? (
              <div style={{ background:P.panel, border:`1px solid ${P.border}`, borderRadius:8, padding:12 }}>
                <div style={{ color:P.cyan, fontSize:13, fontWeight:700, marginBottom:8 }}>ORBIT {selectedOrbit.label}</div>
                {[["p",selectedOrbit.p],["q",selectedOrbit.q],["Period T",selectedOrbit.period],["Slope",selectedOrbit.slope.toFixed(4)]].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                    <span style={{color:P.muted,fontSize:10}}>{k}</span>
                    <span style={{color:P.text,fontSize:10}}>{v}</span>
                  </div>
                ))}
                <button onClick={() => { setSizeX(selectedOrbit.p); setSizeY(selectedOrbit.q); setVx(selectedOrbit.q); setVy(selectedOrbit.p); setTab("grid"); }}
                  style={{ marginTop:10, width:"100%", padding:"7px 0", background:P.cyan+"22", border:`1px solid ${P.cyan}`, color:P.cyan, fontFamily:"monospace", fontSize:10, borderRadius:4, cursor:"pointer" }}>
                  LOAD INTO SIM
                </button>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6 }}>
                {ALL_ORBITS.map((o,i) => (
                  <div key={o.label} onClick={() => setSelectedOrbit(o)}
                    style={{ background:P.bg, border:`1px solid ${ORBIT_COLORS[i%ORBIT_COLORS.length]}44`, borderRadius:4, padding:"6px 4px", textAlign:"center", cursor:"pointer" }}>
                    <span style={{ color:ORBIT_COLORS[i%ORBIT_COLORS.length], fontSize:12, fontWeight:700 }}>{o.label}</span>
                    <div style={{ color:P.muted, fontSize:7 }}>T={o.period}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "auto" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ color:P.muted, fontSize:8, letterSpacing:2 }}>AUTO-SWEEP · FEEDS ALL RATIONAL ORBITS TO GENESIS BRAIN</div>

            <div style={{ background:P.panel, border:`1px solid ${P.border}`, borderRadius:8, padding:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div>
                  <div style={{ color:P.cyan, fontSize:14, fontWeight:700 }}>
                    {autoRun ? `SWEEPING ${currentOrbit?.label}` : "AUTO-SWEEP PAUSED"}
                  </div>
                  <div style={{ color:P.muted, fontSize:8, marginTop:2 }}>
                    {autoIdx + 1} / {ALL_ORBITS.length} orbits · 3s per orbit
                  </div>
                </div>
                <button onClick={() => setAutoRun(r => !r)}
                  style={{ padding:"10px 18px", background: autoRun ? P.magenta+"22" : P.green+"22",
                    border:`1px solid ${autoRun ? P.magenta : P.green}`, color: autoRun ? P.magenta : P.green,
                    fontFamily:"monospace", fontSize:11, borderRadius:4, cursor:"pointer" }}>
                  {autoRun ? "⏹ STOP" : "▶ START"}
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ background:P.dim, borderRadius:4, height:6, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${((autoIdx+1)/ALL_ORBITS.length)*100}%`,
                  background: autoRun ? P.cyan : P.muted, transition:"width 0.3s" }} />
              </div>

              {autoRun && currentOrbit && (
                <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  {[["Orbit",currentOrbit.label],["Period",currentOrbit.period],["Slope",currentOrbit.slope.toFixed(3)],["Brain",brainConnected?"LIVE":"OFF"]].map(([k,v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{color:P.muted,fontSize:9}}>{k}</span>
                      <span style={{color:P.cyan,fontSize:9}}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background:P.panel, border:`1px solid ${P.border}`, borderRadius:8, padding:12 }}>
              <div style={{ color:P.muted, fontSize:8, letterSpacing:2, marginBottom:8 }}>SWEEP LOG · SENT TO BRAIN</div>
              {autoLog.length === 0 && <div style={{ color:P.muted, fontSize:9 }}>Press START to begin sweeping all orbits...</div>}
              {autoLog.map((entry, i) => (
                <div key={i} style={{ color: i===0 ? P.green : P.muted, fontSize:9, padding:"2px 0", fontFamily:"monospace" }}>
                  {entry}
                </div>
              ))}
            </div>

            <div style={{ background:P.panel, border:`1px solid ${P.border}`, borderRadius:8, padding:12 }}>
              <div style={{ color:P.muted, fontSize:8, letterSpacing:2, marginBottom:6 }}>WHAT THE BRAIN RECEIVES</div>
              <div style={{ color:P.text, fontSize:9, lineHeight:1.8 }}>
                Each orbit sends: <span style={{color:P.cyan}}>slope, winding, chaos_ratio, diagRatio, grade</span>
                <br/>Your music apps react to <span style={{color:P.gold}}>winding</span> → chord shifts
                <br/>Atomic engine reacts to <span style={{color:P.magenta}}>chaos_ratio</span> → atom speed
                <br/>Spectral viewer maps <span style={{color:P.purple}}>x_norm</span> → wavelength color
              </div>
            </div>
          </div>
        )}

        {tab === "data" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ color:P.muted, fontSize:8, letterSpacing:2 }}>FIRST 20 EVENTS</div>
            <div style={{ background:P.panel, border:`1px solid ${P.border}`, borderRadius:8, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"36px 36px 36px 36px 80px 56px", padding:"6px 10px", borderBottom:`1px solid ${P.border}` }}>
                {["#","X","Y","D","Phase","Type"].map(h => <span key={h} style={{color:P.muted,fontSize:8}}>{h}</span>)}
              </div>
              {events.slice(0,20).map((e,i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"36px 36px 36px 36px 80px 56px", padding:"4px 10px", borderBottom:`1px solid ${P.dim}` }}>
                  <span style={{color:P.muted,fontSize:9}}>{e.t}</span>
                  <span style={{color:P.text,fontSize:9}}>{e.x}</span>
                  <span style={{color:P.text,fontSize:9}}>{e.y}</span>
                  <span style={{color:e.isDiag?P.cyan:P.muted,fontSize:9}}>{e.isDiag?"●":"○"}</span>
                  <span style={{color:P.purple,fontSize:8}}>{e.phase}</span>
                  <span style={{color:e.isCorner?P.gold:e.isDiag?P.cyan:P.muted,fontSize:8}}>
                    {e.isCorner?"CORNER":e.isDiag?"DIAG":"off"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop:`1px solid ${P.border}`, padding:"7px 18px", display:"flex", justifyContent:"space-between", background:P.panel }}>
        <span style={{ color:P.muted, fontSize:7, letterSpacing:2 }}>MOD {mod} · {ALL_ORBITS.length} ORBITS</span>
        <span style={{ color: autoRun ? P.green : P.muted, fontSize:7, letterSpacing:1 }}>
          {autoRun ? `AUTO ${autoIdx+1}/${ALL_ORBITS.length}` : "MANUAL MODE"}
        </span>
      </div>
    </div>
  );
}
