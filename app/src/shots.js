// Fixed scenes for screenshots: ?shot=editor shows the editor with sample
// photos loaded; ?shot=cover shows the cover alone, full frame. The query
// picks the scene apart: photo (or photos, comma-separated sample names),
// layout, grade, caption, subtitle, badge and heat. window.__shotReady is
// set once the scene has painted, so a screenshot run knows when to shoot.
import { createDefaultState } from './cover.js';

/**
 * Builds the scene's state from the query and hands it to the editor through
 * `hooks`: loadSample(name) loads a sample photo, apply(scene) shows it,
 * ready() fires once the scene has painted.
 */
export async function runShot(shot, query, hooks) {
  const scene = createDefaultState();
  scene.layout = query.get('layout') ?? 'hero-three';
  scene.grade = query.get('grade') ?? 'sunset';
  scene.title = query.get('caption') ?? 'Sunset Heist';
  scene.subtitle = query.get('subtitle') ?? 'vice city nights';
  scene.badge = query.get('badge') ?? 'EST. 2026';
  scene.heat = Math.max(0, Math.min(5, Number(query.get('heat') ?? 4) || 0));
  const names = (query.get('photos') ?? query.get('photo') ?? 'pier')
    .split(',').map((n) => n.trim()).filter(Boolean);
  scene.photos = [];
  for (const name of names) {
    try { scene.photos.push(await hooks.loadSample(name)); } catch { /* skip a missing sample */ }
  }
  if (!scene.photos.length) scene.photos.push(await hooks.loadSample('pier'));
  // Spread the photos over the panels with a slightly different crop each,
  // so a multi-panel cover looks varied even from one or two photos. The
  // subjects' faces sit in the top third of the sample photos, so most
  // panels are shifted up (positive y) to keep the face in frame; a couple
  // stay low for variety. The renderer's pan clamp keeps every crop covered.
  const yCycle = [0.3, 0.12, -0.08];
  for (let i = 0; i < scene.panels.length; i++) {
    scene.panels[i] = {
      photo: i % scene.photos.length,
      x: ((i % 3) - 1) * 0.08,
      y: yCycle[i % 3],
      zoom: 1 + (i % 3) * 0.06,
    };
  }
  hooks.apply(scene);
  hooks.ready();
}
