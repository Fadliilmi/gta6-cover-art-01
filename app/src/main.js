// Neon Coast — the editor.
//
// Wires the page: photo uploads and thumbnails, the five layouts, the six
// grades, the caption fields, the heat meter, undo/redo, and the PNG exports
// in all four post sizes. The preview canvas is the same drawing the export
// makes, at a smaller size. A `?shot=` query sets up a fixed scene for a
// screenshot instead (./shots.js).
import {
  LAYOUTS, GRADES, SIZES, createDefaultState, snapshotState, restoreState,
  layoutPanels, drawCoverInto, renderCover, loadFonts,
} from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const statusEl = $('status');
const state = createDefaultState();
let selectedPanel = 0;
let lastGeo = null; // panel rects of the last preview draw, in preview pixels
let coverMode = false;

// ------------------------------------------------------------ small helpers

function status(text) { statusEl.textContent = text; }

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function usedPanelCount() {
  return LAYOUTS.find((l) => l.id === state.layout)?.panels ?? 4;
}

function currentSize() {
  const id = document.querySelector('input[name="size"]:checked')?.value ?? 'square';
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}

// ------------------------------------------------------------ preview

/** Sizes the preview canvas to the chosen export aspect and redraws. */
function redraw() {
  const size = coverMode
    ? { w: window.innerWidth, h: window.innerHeight }
    : currentSize();
  const longSide = coverMode ? Math.max(size.w, size.h) : 700;
  const scale = longSide / Math.max(size.w, size.h);
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
  const ctx = preview.getContext('2d');
  drawCoverInto(ctx, preview.width, preview.height, state);
  lastGeo = layoutPanels(state.layout, preview.width, preview.height);
  document.querySelectorAll('.panel-btn').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.panel) === selectedPanel);
  });
}

function scheduleRedraw() {
  requestAnimationFrame(redraw);
}

// ------------------------------------------------------------ undo / redo

let past = [];
let future = [];

/** Records the state before a change, so undo can bring it back. */
function checkpoint() {
  past.push(snapshotState(state));
  if (past.length > 50) past.shift();
  future = [];
  updateUndoButtons();
}

function undo() {
  if (!past.length) return;
  future.push(snapshotState(state));
  restoreState(state, past.pop());
  syncUI();
  redraw();
  updateUndoButtons();
  status('Undid the last change.');
}

function redo() {
  if (!future.length) return;
  past.push(snapshotState(state));
  restoreState(state, future.pop());
  syncUI();
  redraw();
  updateUndoButtons();
  status('Redid the change.');
}

function updateUndoButtons() {
  $('undo').disabled = past.length === 0;
  $('redo').disabled = future.length === 0;
}

// ------------------------------------------------------------ photos

const thumbsEl = $('thumbs');

function addThumb(img, src, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'thumb';
  button.title = `Use photo ${index + 1} in the selected panel`;
  const thumb = document.createElement('img');
  thumb.src = src;
  thumb.alt = `Photo ${index + 1}`;
  button.append(thumb);
  button.addEventListener('click', () => {
    checkpoint();
    state.panels[selectedPanel].photo = index;
    redraw();
    status(`Panel ${selectedPanel + 1} now shows photo ${index + 1}.`);
  });
  thumbsEl.append(button);
}

async function addPhotoFromURL(url, thumbSrc = url) {
  const img = await loadImage(url);
  state.photos.push(img);
  addThumb(img, thumbSrc, state.photos.length - 1);
  return img;
}

$('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  checkpoint();
  for (const file of files) {
    const url = URL.createObjectURL(file);
    await addPhotoFromURL(url, url);
  }
  redraw();
  status(`${files.length} photo${files.length > 1 ? 's' : ''} loaded — click a panel, then drag to position it.`);
  e.target.value = '';
});

// ------------------------------------------------------------ panel picking

function panelAt(px, py) {
  if (!lastGeo) return -1;
  const used = usedPanelCount();
  for (let i = used - 1; i >= 0; i--) {
    const r = lastGeo.panels[i];
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const dx = px - cx;
    const dy = py - cy;
    const cos = Math.cos(-r.rot);
    const sin = Math.sin(-r.rot);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
  }
  return -1;
}

function canvasPoint(e) {
  const rect = preview.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (preview.width / rect.width),
    y: (e.clientY - rect.top) * (preview.height / rect.height),
  };
}

let drag = null;

preview.addEventListener('pointerdown', (e) => {
  if (coverMode) return;
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  checkpoint();
  selectedPanel = hit;
  drag = { panel: hit, lastX: p.x, lastY: p.y, moved: false };
  preview.setPointerCapture(e.pointerId);
  redraw();
});

preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const rect = lastGeo.panels[drag.panel];
  const slot = state.panels[drag.panel];
  slot.x += (p.x - drag.lastX) / rect.w;
  slot.y += (p.y - drag.lastY) / rect.h;
  slot.x = Math.max(-0.6, Math.min(0.6, slot.x));
  slot.y = Math.max(-0.6, Math.min(0.6, slot.y));
  drag.lastX = p.x;
  drag.lastY = p.y;
  drag.moved = true;
  scheduleRedraw();
});

preview.addEventListener('pointerup', () => {
  if (drag?.moved) status(`Panel ${drag.panel + 1} repositioned.`);
  drag = null;
});

preview.addEventListener('wheel', (e) => {
  if (coverMode) return;
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  e.preventDefault();
  if (!drag) { checkpoint(); drag = { panel: hit, wheel: true }; }
  clearTimeout(preview._wheelTimer);
  preview._wheelTimer = setTimeout(() => { drag = null; }, 400);
  const slot = state.panels[hit];
  slot.zoom = Math.max(1, Math.min(4, slot.zoom * Math.exp(-e.deltaY * 0.0012)));
  selectedPanel = hit;
  scheduleRedraw();
}, { passive: false });

// ------------------------------------------------------------ panel bar

function buildPanelBar() {
  const bar = $('panelbar');
  for (let i = 0; i < 9; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-btn';
    b.dataset.panel = i;
    b.textContent = `${i + 1}`;
    b.title = `Select panel ${i + 1}`;
    b.addEventListener('click', () => { selectedPanel = i; redraw(); });
    bar.append(b);
  }
}

$('next-photo').addEventListener('click', () => {
  if (!state.photos.length) return;
  checkpoint();
  const slot = state.panels[selectedPanel];
  slot.photo = (slot.photo + 1) % state.photos.length;
  redraw();
  status(`Panel ${selectedPanel + 1} now shows photo ${slot.photo + 1}.`);
});

$('fill-all').addEventListener('click', () => {
  checkpoint();
  const photo = state.panels[selectedPanel].photo;
  state.panels.forEach((slot) => { slot.photo = photo; });
  redraw();
  status('Every panel now shows the same photo.');
});

$('reset-crop').addEventListener('click', () => {
  checkpoint();
  state.panels[selectedPanel] = { photo: state.panels[selectedPanel].photo, x: 0, y: 0, zoom: 1 };
  redraw();
  status(`Panel ${selectedPanel + 1} crop reset.`);
});

// ------------------------------------------------------------ controls

function buildLayoutButtons() {
  const wrap = $('layouts');
  for (const layout of LAYOUTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice layout-choice';
    b.dataset.layout = layout.id;
    b.innerHTML = `<span class="mini mini-${layout.id}" aria-hidden="true"></span>${layout.label}`;
    b.addEventListener('click', () => {
      checkpoint();
      state.layout = layout.id;
      selectedPanel = 0;
      syncUI();
      redraw();
    });
    wrap.append(b);
  }
}

function buildGradeButtons() {
  const wrap = $('grades');
  for (const [id, grade] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'choice grade-choice';
    b.dataset.grade = id;
    const stops = grade.stops.map(([t, c]) => `${c} ${Math.round(t * 100)}%`).join(', ');
    b.style.background = `linear-gradient(135deg, ${stops})`;
    b.innerHTML = `<span>${grade.label}</span>`;
    b.addEventListener('click', () => {
      checkpoint();
      state.grade = id;
      syncUI();
      redraw();
    });
    wrap.append(b);
  }
}

function buildSizeRadios() {
  const wrap = $('sizes');
  for (const size of SIZES) {
    const label = document.createElement('label');
    label.className = 'size-option';
    label.innerHTML = `<input type="radio" name="size" value="${size.id}"${size.id === 'square' ? ' checked' : ''}> ${size.label}`;
    wrap.append(label);
  }
  wrap.addEventListener('change', redraw);
}

function buildHeatButtons() {
  const wrap = $('heat');
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'heat-star';
    b.dataset.heat = i;
    b.textContent = '★';
    b.setAttribute('aria-label', `${i} star${i > 1 ? 's' : ''} of heat`);
    b.addEventListener('click', () => {
      checkpoint();
      state.heat = i;
      syncUI();
      redraw();
    });
    wrap.append(b);
  }
}

function wireText(id, key) {
  const input = $(id);
  input.addEventListener('focus', checkpoint);
  input.addEventListener('input', () => {
    state[key] = input.value;
    scheduleRedraw();
  });
}

function syncUI() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  document.querySelectorAll('.layout-choice').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('.grade-choice').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('.heat-star').forEach((b) => {
    b.classList.toggle('lit', Number(b.dataset.heat) <= state.heat);
  });
  document.querySelectorAll('.panel-btn').forEach((b) => {
    b.classList.toggle('hidden-panel', Number(b.dataset.panel) >= usedPanelCount());
    b.classList.toggle('active', Number(b.dataset.panel) === selectedPanel);
  });
  $('panel-label').textContent = `Panel ${selectedPanel + 1} of ${usedPanelCount()}`;
}

// ------------------------------------------------------------ export

async function exportSize(size) {
  await loadFonts();
  const canvas = renderCover(state, size.w, size.h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `neon-coast-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  status(`Saved neon-coast-${size.w}x${size.h}.png`);
}

$('export').addEventListener('click', () => { exportSize(currentSize()); });

$('export-all').addEventListener('click', async () => {
  for (const size of SIZES) {
    await exportSize(size);
    await new Promise((r) => setTimeout(r, 350));
  }
  status('Saved all four sizes — square, portrait, wide and story.');
});

$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault(); redo();
  }
});

/** Renders a cover at an exact size and returns its PNG as a data URL —
 *  the hook the verification run uses to prove exports work. */
window.__viceExport = async (w, h) => {
  await loadFonts();
  return renderCover(state, w, h).toDataURL('image/png');
};

// ------------------------------------------------------------ start

buildPanelBar();
buildLayoutButtons();
buildGradeButtons();
buildSizeRadios();
buildHeatButtons();
wireText('title', 'title');
wireText('subtitle', 'subtitle');
wireText('badge', 'badge');

const params = new URLSearchParams(location.search);
const shot = params.get('shot');

async function boot() {
  await loadFonts();
  if (shot) {
    await runShot(shot, params, {
      loadSample: (name) => loadImage(`samples/${name}.jpg`),
      apply: (scene) => {
        state.layout = scene.layout;
        state.grade = scene.grade;
        state.title = scene.title;
        state.subtitle = scene.subtitle;
        state.badge = scene.badge;
        state.heat = scene.heat;
        state.photos = scene.photos;
        state.panels = scene.panels;
        selectedPanel = 0;
        if (shot === 'cover') {
          coverMode = true;
          document.body.classList.add('shot-cover');
        } else {
          // The scene's photos get thumbnails too, like uploaded ones.
          thumbsEl.replaceChildren();
          state.photos.forEach((img, i) => addThumb(img, img.src, i));
        }
        syncUI();
        redraw();
      },
      ready: () => {
        requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
      },
    });
    return;
  }
  // The editor opens with the two sample photos already in place, so the
  // first thing a person sees is a finished-looking cover.
  await addPhotoFromURL('samples/pier.jpg');
  await addPhotoFromURL('samples/boulevard.jpg');
  syncUI();
  redraw();
}

boot();
