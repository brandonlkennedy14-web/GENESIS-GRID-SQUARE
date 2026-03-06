import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import GenesisGrid from '../genesis-grid.jsx'

function App() {
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!window.GenesisBrain) { console.warn('[billiard-feed] GenesisBrain not found'); return; }
      await window.GenesisBrain.connect();
      console.log('[billiard-feed] Connected to Genesis Brain ✓');

      const CONFIG = { sizeX: 3, sizeY: 3, vx: 3, vy: 4, mod: 1000003, stepsPerTick: 200 };
      let x = 1, y = 1, phase = 1, diagHits = 0, offDiagHits = 0, cornerHits = 0, totalSteps = 0;
      const recentEvents = [];
      const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);

      function tick() {
        const { sizeX, sizeY, vx, vy, mod, stepsPerTick } = CONFIG;
        for (let i = 0; i < stepsPerTick; i++) {
          const nx = ((x + vx - 1) % sizeX) + 1;
          const ny = ((y + vy - 1) % sizeY) + 1;
          phase = (phase * 30) % mod;
          const isDiag   = nx === ny;
          const isCorner = (nx===1&&ny===1)||(nx===sizeX&&ny===sizeY)||(nx===1&&ny===sizeY)||(nx===sizeX&&ny===1);
          if (isDiag) diagHits++; else offDiagHits++;
          if (isCorner) cornerHits++;
          recentEvents.push({ t: totalSteps, x: nx, y: ny, phase, isDiag, isCorner });
          if (recentEvents.length > 20) recentEvents.shift();
          x = nx; y = ny; totalSteps++;
        }
        const g = gcd(Math.abs(vx), Math.abs(vy));
        const diagRatio = diagHits / totalSteps;
        const winding   = (totalSteps * (vy / g)) / (sizeX * sizeY);
        window.GenesisBrain.write('billiard', {
          totalSteps, diagHits, offDiagHits, cornerHits,
          diagRatio:   parseFloat(diagRatio.toFixed(4)),
          sizeX, sizeY, vx, vy, slope: `${vy/g}/${vx/g}`, mod,
          x, y, phase,
          winding:     parseFloat(winding.toFixed(4)),
          x_norm:      (x - 1) / (sizeX - 1 || 1),
          y_norm:      (y - 1) / (sizeY - 1 || 1),
          chaos_ratio: parseFloat((offDiagHits / totalSteps).toFixed(4)),
          recentEvents: recentEvents.slice(-20),
          grade: diagRatio > 0.4 ? 'GRADE_A' : diagRatio > 0.25 ? 'GRADE_B' : 'GRADE_C',
        });
      }

      tick();
      setInterval(tick, 2000);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return <GenesisGrid />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
          
