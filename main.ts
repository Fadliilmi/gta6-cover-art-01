// Neon Coast Cover Studio — the hand-in program for gta6-cover-art-01.
//
// Node 22, standard library only. It gathers the entry — the offline app in
// app/ and the screenshots in screenshots/ — and writes them to /output
// together with /output/dossier.json, the summary the judge reads, built by
// the vendored make.fun library (vendor/makefun-app.ts, the kit's copy,
// unchanged). Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run must be deterministic: the same repository state writes the same
// bytes every time, so the grader's two runs match.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's own caps, from the kit's reference/gate.json: the app stays
// under 993 files and 48 MiB with paths under 1,000 bytes, the screenshots
// under 4 files of 256 KiB each, and the dossier text under 160 KiB — the
// whole of /output shares the platform's 1,000-entry, 64 MiB ceiling.
const GATE = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

writeFileSync(join(outputDir, 'dossier.json'), buildDossier(outputDir, GATE));
