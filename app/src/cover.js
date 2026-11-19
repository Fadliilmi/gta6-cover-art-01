// Neon Coast — the cover renderer.
//
// Everything a cover is made of lives here: the five panel layouts, the six
// gradient-map colour grades, the title block with its halftone, the badge
// ribbon, the heat-meter stars, and the grain and vignette that finish the
// poster. It draws on any 2D canvas at any size, so the live preview and the
// exported PNG are the same drawing at different resolutions.
//
// A cover's state is a plain object:
//   layout, grade, title, subtitle, badge, heat,
//   photos: [Image, ...]            (kept out of undo snapshots)
//   panels: [{ photo, x, y, zoom }] (one entry per panel slot, nine slots;
//            a layout only uses the first few)
// A panel's photo is positioned by x/y (fractions of the panel's width and
// height, 0 is centred) and zoom (1 is the tightest cover fit).

export const LAYOUTS = [
  { id: 'hero-three', label: 'Hero + three', panels: 4 },
  { id: 'grid4', label: 'Four-panel grid', panels: 4 },
  { id: 'grid9', label: 'Nine-panel grid', panels: 9 },
  { id: 'tilt', label: 'Tilted snapshots', panels: 3 },
  { id: 'fullbleed', label: 'Full bleed', panels: 1 },
];

export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    stops: [[0, '#16042e'], [0.3, '#6d2b8f'], [0.55, '#d6336c'], [0.78, '#ff7a3d'], [1, '#ffd166']],
    titleTop: '#fff6cf', titleBottom: '#ff9d5c', accent: '#ff5da2', neon: '#ff7ad9',
    skyTop: '#2a0a4a', skyBottom: '#ff7a3d', ink: '#16042e',
  },
  neon: {
    label: 'Neon Nights',
    stops: [[0, '#030312'], [0.3, '#1b2a6b'], [0.55, '#7b2ff7'], [0.78, '#ff2fb3'], [1, '#8ef6ff']],
    titleTop: '#eafcff', titleBottom: '#37e6ff', accent: '#ff2fb3', neon: '#37e6ff',
    skyTop: '#05051f', skyBottom: '#7b2ff7', ink: '#030312',
  },
  vice: {
    label: 'Vice Gold',
    stops: [[0, '#170a02'], [0.3, '#7a2e0d'], [0.55, '#e85d04'], [0.78, '#ffb703'], [1, '#fff3b0']],
    titleTop: '#fffbe8', titleBottom: '#ffb703', accent: '#ff8500', neon: '#ffd60a',
    skyTop: '#2b1204', skyBottom: '#ff8500', ink: '#170a02',
  },
  teal: {
    label: 'Tropic Teal',
    stops: [[0, '#02141a'], [0.3, '#0b5563'], [0.55, '#129c8a'], [0.78, '#7ee0a3'], [1, '#eafff0']],
    titleTop: '#f2fff6', titleBottom: '#5eead4', accent: '#2dd4bf', neon: '#5eead4',
    skyTop: '#04222b', skyBottom: '#129c8a', ink: '#02141a',
  },
  rose: {
    label: 'Rose Dusk',
    stops: [[0, '#1c0512'], [0.3, '#5e1a4d'], [0.55, '#c2276b'], [0.78, '#ff6b8a'], [1, '#ffd6de']],
    titleTop: '#fff0f3', titleBottom: '#ff8fab', accent: '#ff4d6d', neon: '#ff8fab',
    skyTop: '#2e0719', skyBottom: '#c2276b', ink: '#1c0512',
  },
  noir: {
    label: 'Noir Ink',
    stops: [[0, '#000000'], [0.3, '#1c1c22'], [0.55, '#55555e'], [0.78, '#a8a8b0'], [1, '#ffffff']],
    titleTop: '#ffffff', titleBottom: '#c9c9d1', accent: '#e8e8ee', neon: '#ffffff',
    skyTop: '#0a0a0e', skyBottom: '#55555e', ink: '#000000',
  },
};

export const SIZES = [
  { id: 'square', label: 'Square · 1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait · 1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide · 1920 × 1080', w: 1920, h: 1080 },
  { id: 'story', label: 'Story · 1080 × 1920', w: 1080, h: 1920 },
];

export function createDefaultState() {
  return {
    layout: 'hero-three',
    grade: 'sunset',
    title: 'SUNSET HEIST',
    subtitle: 'vice city nights',
    badge: 'EST. 2026',
    heat: 4,
    photos: [],
    panels: Array.from({ length: 9 }, (_, i) => ({ photo: 0, x: 0, y: 0, zoom: 1 })),
  };
}

/** A state without its images, so it can be stored for undo and redo. */
export function snapshotState(state) {
  return JSON.parse(JSON.stringify({
    layout: state.layout, grade: state.grade, title: state.title,
    subtitle: state.subtitle, badge: state.badge, heat: state.heat,
    panels: state.panels,
  }));
}

export function restoreState(state, snap) {
  state.layout = snap.layout; state.grade = snap.grade; state.title = snap.title;
  state.subtitle = snap.subtitle; state.badge = snap.badge; state.heat = snap.heat;
  state.panels = snap.panels.map((p) => ({ ...p }));
}

// ---------------------------------------------------------------- fonts

const FONT_FILES = [
  ['Anton', 'fonts/Anton-Regular.ttf'],
  ['Pacifico', 'fonts/Pacifico-Regular.ttf'],
  ['Inter', 'fonts/Inter.ttf'],
];

let fontsReady = null;

/** Loads the three vendored OFL fonts (Anton, Pacifico, Inter) once. */
export function loadFonts() {
  if (!fontsReady) {
    fontsReady = Promise.all(FONT_FILES.map(async ([family, url]) => {
      const face = new FontFace(family, `url(${url})`);
      document.fonts.add(face);
      try { await face.load(); } catch { /* the page still draws with fallbacks */ }
    })).then(() => document.fonts.ready);
  }
  return fontsReady;
}

// ---------------------------------------------------------------- geometry

/**
 * Panel rectangles for a layout at W x H. Returns the title block, the photo
 * area, and one rect per used panel: { x, y, w, h, rot, border } in pixels.
 * `border` is the white snapshot border for the tilted layout, 0 otherwise.
 */
export function layoutPanels(layout, w, h) {
  const overlayTitle = layout === 'fullbleed';
  const titleH = overlayTitle ? Math.round(h * 0.30) : Math.round(Math.min(Math.max(h * 0.26, 190), 360));
  const title = { x: 0, y: h - titleH, w, h: titleH };
  const area = { x: 0, y: 0, w, h: overlayTitle ? h : h - titleH };
  const g = Math.max(6, Math.min(16, Math.round(w * 0.012))); // the white gap
  const m = g;
  const panels = [];
  const inner = (x, y, pw, ph, rot = 0, border = 0) => ({ x, y, w: pw, h: ph, rot, border });

  if (layout === 'hero-three') {
    const heroW = Math.round((area.w - m * 2 - g) * 0.62);
    panels.push(inner(m, m, heroW, area.h - m * 2));
    const colX = m + heroW + g;
    const colW = area.w - colX - m;
    const ph = (area.h - m * 2 - g * 2) / 3;
    for (let i = 0; i < 3; i++) panels.push(inner(colX, m + i * (ph + g), colW, ph));
  } else if (layout === 'grid4' || layout === 'grid9') {
    const n = layout === 'grid4' ? 2 : 3;
    const cw = (area.w - m * 2 - g * (n - 1)) / n;
    const ch = (area.h - m * 2 - g * (n - 1)) / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        panels.push(inner(m + c * (cw + g), m + r * (ch + g), cw, ch));
      }
    }
  } else if (layout === 'tilt') {
    const bw = Math.round(w * 0.035); // snapshot white border
    panels.push(inner(w * 0.06, area.h * 0.05, w * 0.46, area.h * 0.60, -0.12, bw));
    panels.push(inner(w * 0.50, area.h * 0.03, w * 0.44, area.h * 0.56, 0.09, bw));
    panels.push(inner(w * 0.28, area.h * 0.52, w * 0.44, area.h * 0.44, -0.03, bw));
  } else { // fullbleed
    panels.push(inner(0, 0, w, h));
  }
  return { title, area, panels, overlayTitle };
}

// ---------------------------------------------------------------- grades

const lutCache = new Map();

/** A 256-step lookup table for a grade's gradient map, cached per grade. */
function gradeLUT(gradeId) {
  if (lutCache.has(gradeId)) return lutCache.get(gradeId);
  const stops = GRADES[gradeId].stops.map(([t, hex]) => [t, hexToRgb(hex)]);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = (b[0] - a[0]) || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    lut[i * 3] = a[1][0] + (b[1][0] - a[1][0]) * f;
    lut[i * 3 + 1] = a[1][1] + (b[1][1] - a[1][1]) * f;
    lut[i * 3 + 2] = a[1][2] + (b[1][2] - a[1][2]) * f;
  }
  lutCache.set(gradeId, lut);
  return lut;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Runs a photo through the grade's gradient map on a small offscreen canvas
 * (kept at most 720 px on its long side, so exports stay fast), then returns
 * that canvas. `mix` keeps a little of the photo's own colour in the grade.
 */
function gradedPhoto(img, rect, transform, gradeId, mix = 0.82) {
  const scale = Math.min(1, 720 / Math.max(rect.w, rect.h));
  const tw = Math.max(2, Math.round(rect.w * scale));
  const th = Math.max(2, Math.round(rect.h * scale));
  const off = document.createElement('canvas');
  off.width = tw; off.height = th;
  const octx = off.getContext('2d');
  drawPhotoInto(octx, img, { x: 0, y: 0, w: tw, h: th }, transform, true);
  const data = octx.getImageData(0, 0, tw, th);
  const px = data.data;
  const lut = gradeLUT(gradeId);
  const keep = 1 - mix;
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) | 0;
    const o = lum * 3;
    px[i] = px[i] * keep + lut[o] * mix;
    px[i + 1] = px[i + 1] * keep + lut[o + 1] * mix;
    px[i + 2] = px[i + 2] * keep + lut[o + 2] * mix;
  }
  octx.putImageData(data, 0, 0);
  return off;
}

/** Draws an image cover-fitting `rect`, panned and zoomed by `transform`.
 *  The pan is clamped so the photo always covers the panel — dragging or a
 *  stored offset can never expose the background behind it. */
function drawPhotoInto(ctx, img, rect, transform, boost = false) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih) * (transform.zoom || 1);
  const dw = iw * base;
  const dh = ih * base;
  // The furthest the photo may slide before a bare edge would show.
  const maxX = Math.max(0, (dw - rect.w) / 2 / rect.w);
  const maxY = Math.max(0, (dh - rect.h) / 2 / rect.h);
  const tx = Math.max(-maxX, Math.min(maxX, transform.x || 0));
  const ty = Math.max(-maxY, Math.min(maxY, transform.y || 0));
  const cx = rect.x + rect.w / 2 + tx * rect.w;
  const cy = rect.y + rect.h / 2 + ty * rect.h;
  if (boost) ctx.filter = 'saturate(1.25) contrast(1.07)';
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  if (boost) ctx.filter = 'none';
}

// ---------------------------------------------------------------- decoration

let grainTile = null;

/** A small random-noise tile, reused for the poster's grain. */
function grainPattern(ctx) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 160; grainTile.height = 160;
    const g = grainTile.getContext('2d');
    const d = g.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 96 + Math.random() * 96;
      d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }
  return ctx.createPattern(grainTile, 'repeat');
}

/** The placeholder a panel shows before a photo is dropped into it: a flat
 *  vector sunset — sky, sun disc, horizon stripes — in the grade's colours. */
function drawPlaceholder(ctx, rect, grade) {
  const sky = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(1, grade.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const sunR = Math.min(rect.w, rect.h) * 0.2;
  ctx.fillStyle = 'rgba(255, 240, 200, 0.95)';
  ctx.beginPath();
  ctx.arc(rect.x + rect.w / 2, rect.y + rect.h * 0.52, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10, 4, 20, 0.55)';
  const horizon = rect.y + rect.h * 0.62;
  for (let i = 0; i < 4; i++) {
    const y = horizon + i * rect.h * 0.07;
    ctx.fillRect(rect.x, y, rect.w, Math.max(2, rect.h * 0.018));
  }
}

/** Rows of dots, denser towards the bottom — the title block's halftone. */
function drawHalftone(ctx, rect, colour, alpha) {
  const step = Math.max(10, Math.round(rect.w / 72));
  ctx.fillStyle = colour;
  ctx.globalAlpha = alpha;
  for (let y = rect.y + step / 2; y < rect.y + rect.h; y += step) {
    const f = (y - rect.y) / rect.h; // 0 at the top, 1 at the bottom
    const r = Math.max(0.6, step * 0.32 * f);
    for (let x = rect.x + step / 2; x < rect.x + rect.w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function fitFont(ctx, text, family, startSize, maxWidth, weight = '') {
  let size = startSize;
  const set = () => { ctx.font = `${weight} ${size}px ${family}`; };
  set();
  while (ctx.measureText(text).width > maxWidth && size > 10) {
    size -= 2;
    set();
  }
  return size;
}

// ---------------------------------------------------------------- the cover

/**
 * Draws the whole cover — panels, title block, ribbon, stars, grain and
 * vignette — onto `ctx` at W x H from `state`.
 */
export function drawCoverInto(ctx, w, h, state) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const geo = layoutPanels(state.layout, w, h);
  const used = LAYOUTS.find((l) => l.id === state.layout)?.panels ?? 4;

  ctx.save();
  ctx.fillStyle = '#0d0716';
  ctx.fillRect(0, 0, w, h);

  // The tilted layout sits on a sunset sky, not on black.
  if (state.layout === 'tilt') {
    const sky = ctx.createLinearGradient(0, 0, 0, geo.area.h);
    sky.addColorStop(0, grade.skyTop);
    sky.addColorStop(1, grade.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, geo.area.h);
    const sunR = Math.min(w, geo.area.h) * 0.16;
    ctx.fillStyle = 'rgba(255, 244, 214, 0.9)';
    ctx.beginPath();
    ctx.arc(w * 0.5, geo.area.h * 0.3, sunR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Panels.
  for (let i = 0; i < used; i++) {
    const rect = geo.panels[i];
    const slot = state.panels[i] || { photo: 0, x: 0, y: 0, zoom: 1 };
    const img = state.photos[slot.photo];
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.save();
    if (rect.rot) { ctx.translate(cx, cy); ctx.rotate(rect.rot); ctx.translate(-cx, -cy); }
    if (rect.border) {
      ctx.fillStyle = '#f7f2ea';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = Math.round(w * 0.02);
      ctx.shadowOffsetY = Math.round(w * 0.008);
      ctx.fillRect(rect.x - rect.border, rect.y - rect.border,
        rect.w + rect.border * 2, rect.h + rect.border * 2 + rect.border * 2.4);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (img) {
      const graded = gradedPhoto(img, rect, slot, state.grade);
      ctx.drawImage(graded, rect.x, rect.y, rect.w, rect.h);
    } else {
      drawPlaceholder(ctx, rect, grade);
    }
    // A thin inner shade so panels read as separate plates.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = Math.max(2, Math.round(w * 0.002));
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  drawTitleBlock(ctx, w, h, geo, state, grade);
  drawBadgeRibbon(ctx, w, h, state, grade);

  // Grain, then vignette — the poster's finish, over everything.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawTitleBlock(ctx, w, h, geo, state, grade) {
  const t = geo.title;
  if (!geo.overlayTitle) {
    const bg = ctx.createLinearGradient(0, t.y, 0, t.y + t.h);
    bg.addColorStop(0, '#150826');
    bg.addColorStop(1, '#07030e');
    ctx.fillStyle = bg;
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = grade.accent;
    ctx.fillRect(t.x, t.y, t.w, Math.max(3, Math.round(h * 0.004)));
    drawHalftone(ctx, { x: t.x, y: t.y + t.h * 0.55, w: t.w, h: t.h * 0.45 }, grade.accent, 0.16);
  } else {
    const scrim = ctx.createLinearGradient(0, t.y - t.h * 0.5, 0, h);
    scrim.addColorStop(0, 'rgba(5, 2, 12, 0)');
    scrim.addColorStop(1, 'rgba(5, 2, 12, 0.88)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, t.y - t.h * 0.5, w, h - (t.y - t.h * 0.5));
  }

  const title = (state.title || '').trim().toUpperCase() || 'UNTITLED';
  const cx = w / 2;
  const titleSize = fitFont(ctx, title, 'Anton, sans-serif', Math.round(t.h * 0.44), w * 0.9);
  const titleGrad = ctx.createLinearGradient(0, t.y + t.h * 0.12, 0, t.y + t.h * 0.62);
  titleGrad.addColorStop(0, grade.titleTop);
  titleGrad.addColorStop(1, grade.titleBottom);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12, 3, 24, 0.9)';
  ctx.lineWidth = Math.max(2, titleSize * 0.07);
  const titleY = t.y + t.h * 0.36;
  ctx.strokeText(title, cx, titleY);
  ctx.fillStyle = titleGrad;
  ctx.fillText(title, cx, titleY);

  // Neon script subtitle, glowing under the title.
  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = fitFont(ctx, sub, 'Pacifico, cursive', Math.round(t.h * 0.21), w * 0.8);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = grade.neon;
    ctx.shadowColor = grade.neon;
    ctx.shadowBlur = Math.round(subSize * 0.55);
    ctx.fillText(sub, cx, t.y + t.h * 0.66);
    ctx.shadowBlur = 0;
  }

  // Heat meter: five stars and a label, centred under the subtitle.
  const starR = Math.max(7, Math.round(t.h * 0.075));
  const gap = starR * 2.4;
  const totalW = gap * 4 + starR * 2;
  const label = 'HEAT';
  ctx.font = `700 ${Math.round(starR * 1.15)}px Inter, sans-serif`;
  const labelW = ctx.measureText(label).width;
  let sx = cx - (totalW + labelW + starR * 1.6) / 2 + labelW + starR * 1.6 + starR;
  const sy = t.y + t.h * 0.88;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.textAlign = 'left';
  ctx.fillText(label, cx - (totalW + labelW + starR * 1.6) / 2, sy);
  for (let i = 0; i < 5; i++) {
    const x = sx + i * gap;
    starPath(ctx, x, sy, starR);
    if (i < state.heat) {
      ctx.fillStyle = '#ffc700';
      ctx.shadowColor = '#ff9d00';
      ctx.shadowBlur = starR * 0.8;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1.5, starR * 0.12);
      ctx.stroke();
    }
  }
}

/** The diagonal ribbon across the cover's top-right corner. */
function drawBadgeRibbon(ctx, w, h, state, grade) {
  const badge = (state.badge || '').trim();
  if (!badge) return;
  const bandH = Math.max(26, Math.round(Math.min(w, h) * 0.045));
  const text = badge.toUpperCase();
  ctx.save();
  ctx.translate(w, 0);
  ctx.rotate(Math.PI / 4);
  const bandW = Math.round(Math.max(w, h) * 0.62);
  const y = Math.round(Math.max(w, h) * 0.10);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(-bandW / 2, y, bandW, bandH);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(-bandW / 2, y + bandH - Math.max(3, bandH * 0.12), bandW, Math.max(3, bandH * 0.12));
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = fitFont(ctx, text, 'Inter, sans-serif', Math.round(bandH * 0.52), bandW * 0.92, '700');
  ctx.font = `700 ${size}px Inter, sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.14)}px`;
  ctx.fillText(text, 0, y + bandH / 2 + size * 0.04);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

/** Renders a cover to a fresh canvas at the exact size given. */
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCoverInto(canvas.getContext('2d'), w, h, state);
  return canvas;
}
