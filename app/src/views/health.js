// Health stats view — derives weekly averages from stored check-ins.
import { getState, weekKeys } from "../store.js";
import { icon, pocoImg, shell } from "../ui.js";

export function renderHealth(root) {
  const { checkins } = getState();
  const keys = weekKeys();
  const days = keys.map((k) => checkins[k]).filter(Boolean);

  const stepsSeries = keys.map((k) => (checkins[k]?.steps ?? null));
  const sleepSeries = keys.map((k) => (checkins[k]?.sleepHours ?? null));
  const moodSeries = keys.map((k) => (checkins[k]?.mood ?? null));

  const avgSteps = avg(days.map((d) => d.steps).filter((n) => n != null));
  const avgSleep = avg(days.map((d) => d.sleepHours).filter((n) => n != null));
  const avgMood = avg(days.map((d) => d.mood != null ? d.mood + 1 : null).filter((n) => n != null));

  const insight = buildInsight(days);

  const body = `
    <div class="mb-2">
      <h1 class="font-display-lg-mobile text-display-lg-mobile text-on-surface mb-1">Health</h1>
      <p class="font-body-lg text-body-lg text-on-surface-variant">Here's how you're feeling this week.</p>
    </div>

    ${statCard({
      bg: "bg-[#f8ffee]", label: "Movement", value: fmt(avgSteps, 0), unit: "steps avg",
      valueColor: "text-primary", trend: "+12%", trendUp: true, watermark: "directions_run",
      wmColor: "text-primary", stroke: "#3c6626", leaf: "#bef1a0",
      series: stepsSeries, max: 12000,
    })}

    ${statCard({
      bg: "bg-inverse-on-surface", label: "Sleep", value: sleepLabel(avgSleep), unit: "avg",
      valueColor: "text-inverse-surface", trend: "-2%", trendUp: false, watermark: "bedtime",
      wmColor: "text-inverse-surface", stroke: "#083542", leaf: "#c1e9fa",
      series: sleepSeries, max: 10,
    })}

    ${statCard({
      bg: "bg-secondary-fixed", label: "Happiness", value: fmt(avgMood, 1), unit: "/ 5 avg",
      valueColor: "text-tertiary", trend: "+0.5", trendUp: true, watermark: "mood",
      wmColor: "text-tertiary", stroke: "#864f00", leaf: "#ffdcbd",
      series: moodSeries.map((m) => (m == null ? null : m + 1)), max: 5,
    })}

    <div class="mt-2 p-6 bg-[#f2ebd4] chunky-border rounded-xl flex gap-4 items-start shadow-[inset_0px_4px_8px_rgba(112,90,73,0.1)]">
      <div class="w-12 h-12 rounded-full chunky-border overflow-hidden bg-secondary-container flex-shrink-0 flex items-center justify-center">${pocoImg(46)}</div>
      <p class="font-body-lg text-body-lg text-on-secondary-fixed-variant leading-relaxed">${insight}</p>
    </div>
  `;

  root.innerHTML = shell("health", body);
}

function statCard(o) {
  return `<article class="chunky-border rounded-[1.5rem] p-5 relative overflow-hidden ${o.bg} card-shadow">
    <div class="absolute -top-2 -right-2 opacity-20 ${o.wmColor}">
      <span class="material-symbols-outlined fill-icon" style="font-size:80px;">${o.watermark}</span>
    </div>
    <div class="flex justify-between items-start mb-2 relative z-10">
      <div>
        <h2 class="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider mb-1">${o.label}</h2>
        <div class="flex items-baseline gap-2">
          <span class="font-display-lg-mobile text-display-lg-mobile ${o.valueColor}">${o.value}</span>
          <span class="font-body-md text-body-md text-on-surface-variant">${o.unit}</span>
        </div>
      </div>
      <div class="${o.trendUp ? "bg-primary-container text-on-primary-container" : "bg-surface-variant text-on-surface"} px-3 py-1 rounded-full chunky-border flex items-center gap-1">
        ${icon(o.trendUp ? "trending_up" : "trending_flat", "text-sm")}
        <span class="font-label-bold text-label-bold">${o.trend}</span>
      </div>
    </div>
    <div class="w-full h-24 mt-2 relative z-10">${vineChart(o.series, o.max, o.stroke, o.leaf)}</div>
  </article>`;
}

// Builds a wobbly vine path from a data series, with leaves at data points.
function vineChart(series, max, stroke, leafFill) {
  const pts = series.map((v, i) => {
    const x = (i / 6) * 100;
    const y = v == null ? null : 38 - (Math.max(0, Math.min(max, v)) / max) * 34;
    return { x, y };
  }).filter((p) => p.y != null);

  if (pts.length < 2) {
    return `<svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 40">
      <line x1="0" y1="35" x2="100" y2="35" stroke="${stroke}" stroke-width="2" stroke-dasharray="3 3" opacity="0.4"/>
    </svg>`;
  }

  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const cx = (prev.x + cur.x) / 2;
    d += ` Q ${cx},${prev.y} ${cur.x},${cur.y}`;
  }

  const leaves = pts.map((p, i) =>
    i % 2 === 1
      ? `<path d="M ${p.x},${p.y} q 5,-5 3,-10 q -6,3 -3,10 z" fill="${leafFill}" stroke="${stroke}" stroke-width="1.2"/>`
      : ""
  ).join("");

  return `<svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 40">
    <path d="${d}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/>
    ${leaves}
  </svg>`;
}

function buildInsight(days) {
  if (days.length < 2) return '"Keep checking in and I\'ll start spotting your patterns. No rush."';
  const goodSleep = days.filter((d) => d.sleepHours >= 7);
  const restMood = avg(goodSleep.map((d) => d.mood).filter((n) => n != null));
  const allMood = avg(days.map((d) => d.mood).filter((n) => n != null));
  if (goodSleep.length && restMood > allMood) {
    return '"You smile more after 7+ hours of sleep. I\'m a fan of that. Keep it up!"';
  }
  return '"Steady progress this week. Poco sees you showing up — that\'s the whole game."';
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function fmt(n, dp) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function sleepLabel(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
