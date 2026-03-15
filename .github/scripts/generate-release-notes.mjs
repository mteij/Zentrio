// @ts-nocheck
/**
 * Generate consistent, user-facing GitHub release notes.
 *
 * The output follows a fixed structure inspired by Immich's release notes:
 * - short welcome/introduction
 * - Highlights
 * - optional Breaking Changes
 * - a few narrative spotlight sections
 * - What's Changed buckets
 * - Contributors
 * - Full Changelog link
 *
 * Usage (from repo root in CI):
 *   node .github/scripts/generate-release-notes.mjs
 *
 * Outputs:
 *   RELEASE_NOTES.md in the repo root
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ARCHITECTURE_PATH = './llm/ARCHITECTURE.md';
const FALLBACK_REPOSITORY_URL = 'https://github.com/mteij/Zentrio';
const MAX_COMMITS = 250;
const MAX_HIGHLIGHTS = 4;
const MAX_SPOTLIGHTS = 3;
const MAX_BUCKET_ITEMS = 6;
const MAX_CONTRIBUTORS = 12;
const MAX_ARCH_CONTEXT_CHARS = 12000;
const MAX_DIFFSTAT_CHARS = 6000;
const MAX_PATCH_CONTEXT_CHARS = 28000;
const MAX_COMMIT_LINES = 120;
const MAX_FILES_EVIDENCE = 180;

const SUBSYSTEM_RULES = [
  ['.github/workflows/', 'CI / Workflows'],
  ['.github/scripts/', 'Release Tooling'],
  ['app/src-tauri/', 'Desktop Runtime'],
  ['app/scripts/', 'App Tooling'],
  ['app/src/routes/api/', 'Backend API'],
  ['app/src/services/', 'Backend Services'],
  ['app/src/middleware/', 'Backend Middleware'],
  ['app/src/hooks/', 'Frontend Hooks'],
  ['app/src/components/', 'Frontend Components'],
  ['app/src/pages/', 'Frontend Pages'],
  ['app/src/stores/', 'Frontend State'],
  ['app/src/lib/', 'Frontend Core Lib'],
  ['app/src/utils/', 'Frontend Utilities'],
  ['app/src/styles/', 'Frontend Styles'],
  ['app/src/', 'App Core'],
  ['landing/', 'Landing Site'],
  ['llm/', 'Architecture Docs'],
  ['docs/', 'Documentation'],
];

const CATEGORY_ORDER = ['feature', 'fix', 'ui', 'maintenance'];

const STOPWORDS = new Set([
  'app',
  'apps',
  'assets',
  'component',
  'components',
  'conf',
  'config',
  'core',
  'dist',
  'doc',
  'docs',
  'feature',
  'features',
  'file',
  'files',
  'frontend',
  'github',
  'hook',
  'hooks',
  'index',
  'landing',
  'lib',
  'libs',
  'main',
  'manager',
  'middleware',
  'model',
  'models',
  'module',
  'modules',
  'page',
  'pages',
  'route',
  'routes',
  'script',
  'scripts',
  'service',
  'services',
  'shared',
  'src',
  'store',
  'stores',
  'style',
  'styles',
  'system',
  'tauri',
  'test',
  'tests',
  'types',
  'util',
  'utils',
  'view',
  'views',
  'workflow',
  'workflows',
]);

const TOKEN_ALIASES = new Map([
  ['downloads', 'download'],
  ['subtitles', 'subtitle'],
  ['releases', 'release'],
  ['settings', 'setting'],
  ['players', 'player'],
  ['images', 'image'],
  ['updates', 'update'],
  ['installers', 'installer'],
  ['streams', 'stream'],
  ['streaming', 'streaming'],
]);

const FEATURE_RULES = [
  {
    id: 'introdb',
    patterns: [/introdb/i, /\/segments\/submit/i, /skipIntrosOutros/i, /introdb_cache/i],
    title: 'Intro skipping powered by IntroDB',
    highlight:
      'TV playback can now surface skip controls for intros, recaps, and outros using IntroDB segment data.',
    summary:
      'Zentrio now fetches episode segment timings from IntroDB, caches them server-side, and feeds them into the player so users can skip intros, recaps, and outros more cleanly. Streaming settings also expose controls for unconfirmed segments, and contributors can submit better timings directly from the app with an IntroDB API key.',
    bucket:
      'Added IntroDB-backed segment support so TV episodes can offer skip intro, recap, and outro controls, with caching and in-app contribution support.',
  },
];

function sh(cmd, fallback = '') {
  try {
    return execSync(cmd, {
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 20 * 1024 * 1024,
    })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

function truncate(text, maxChars, label) {
  if (!text || text.length <= maxChars) return text || '';
  const omitted = text.length - maxChars;
  return `${text.slice(0, maxChars)}\n\n...[${label} truncated: ${omitted} chars omitted]`;
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function sentenceCase(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeMarkdown(value) {
  return String(value || '').replace(/[\\`]/g, '\\$&');
}

function listToSentence(items) {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

function formatCodeList(items, maxItems = 3) {
  const clean = items.filter(Boolean).slice(0, maxItems).map((item) => `\`${escapeMarkdown(item)}\``);
  return listToSentence(clean);
}

function normalizeToken(token) {
  const lower = String(token || '').toLowerCase();
  if (!lower) return '';
  return TOKEN_ALIASES.get(lower) || lower;
}

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/');
}

function isStoryNoiseFile(path) {
  const normalized = normalizePath(path);
  return (
    normalized.startsWith('app/src-tauri/gen/') ||
    normalized.endsWith('/bun.lock') ||
    normalized.endsWith('/package-lock.json') ||
    normalized.endsWith('/pnpm-lock.yaml') ||
    normalized.endsWith('/yarn.lock')
  );
}

function getStoryChangedFiles(changedFiles) {
  const filtered = changedFiles.filter((file) => !isStoryNoiseFile(file.path));
  return filtered.length ? filtered : changedFiles;
}

function dedupeStrings(items, maxItems) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    const value = String(item || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (maxItems && output.length >= maxItems) break;
  }

  return output;
}

function dedupeSpotlights(items, maxItems) {
  const seen = new Set();
  const output = [];

  for (const item of items) {
    if (!item?.title || !item?.summary) continue;
    const key = item.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      title: item.title.trim(),
      summary: item.summary.trim(),
    });
    if (maxItems && output.length >= maxItems) break;
  }

  return output;
}

function extractFeatureCandidates(changedFiles, featurePatch) {
  const fileEvidence = changedFiles
    .slice(0, 24)
    .map((file) => {
      try {
        const path = file.path;
        if (!existsSync(path)) return '';
        return readFileSync(path, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');

  const evidence = [featurePatch, ...changedFiles.map((file) => file.path), fileEvidence].join('\n');
  const candidates = [];

  for (const rule of FEATURE_RULES) {
    const hits = rule.patterns.filter((pattern) => pattern.test(evidence)).length;
    if (hits === 0) continue;
    candidates.push({
      id: rule.id,
      title: rule.title,
      highlight: rule.highlight,
      summary: rule.summary,
      bucket: rule.bucket,
    });
  }

  return candidates;
}

function getVersion() {
  try {
    const txt = readFileSync('./app/package.json', 'utf8');
    const pkg = JSON.parse(txt);
    return String(pkg.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
}

function getPrevTag(currentTag) {
  const lastRelease = sh(
    'gh release list --limit 2 --exclude-drafts --json tagName -q ".[].tagName"',
    '',
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .find((tag) => tag !== currentTag);

  if (lastRelease) return lastRelease;

  const tags = sh('git tag --list --sort=-version:refname', '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const currentIndex = tags.findIndex((t) => t === currentTag);
  if (currentIndex !== -1 && currentIndex < tags.length - 1) {
    return tags[currentIndex + 1];
  }

  const prev = tags.find((t) => t !== currentTag);
  if (prev) return prev;

  const described = sh('git describe --abbrev=0 --tags HEAD~1', '');
  if (described && described !== currentTag) return described;
  return '';
}

function getRangeSpec(prevTag) {
  if (prevTag) return `${prevTag}..HEAD`;
  const root = sh('git rev-list --max-parents=0 HEAD', '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (root) return `${root}..HEAD`;
  return 'HEAD~100..HEAD';
}

function getCommitLog(prevTag, rangeSpec) {
  if (prevTag) {
    return sh(
      `git log --max-count=${MAX_COMMITS} --pretty=format:%H%x09%ad%x09%s%x09%b --date=short ${rangeSpec}`,
      '',
    );
  }
  return sh(
    `git log --max-count=${MAX_COMMITS} --pretty=format:%H%x09%ad%x09%s%x09%b --date=short`,
    '',
  );
}

function parseCommits(commitLog) {
  if (!commitLog) return [];
  return commitLog
    .split('\n')
    .map((line) => {
      const [hash, date, subject, body] = line.split('\t');
      return {
        hash: hash?.slice(0, 7) || '',
        date: date || '',
        subject: (subject || '').trim(),
        body: (body || '').trim(),
      };
    })
    .filter((entry) => entry.subject || entry.body);
}

function getChangedFiles(rangeSpec) {
  const byPath = new Map();

  const statusRaw = sh(`git diff --name-status ${rangeSpec}`, '');
  for (const line of statusRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = trimmed.split('\t');
    const statusRawValue = cols[0] || 'M';
    const status = statusRawValue[0] || 'M';

    let path = cols[1] || '';
    let previousPath = '';
    if ((status === 'R' || status === 'C') && cols.length >= 3) {
      previousPath = cols[1] || '';
      path = cols[2] || '';
    }

    if (!path) continue;
    byPath.set(path, {
      path,
      previousPath,
      status,
      statusRaw: statusRawValue,
      added: 0,
      deleted: 0,
      churn: 0,
    });
  }

  const numStatRaw = sh(`git diff --numstat ${rangeSpec}`, '');
  for (const line of numStatRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = trimmed.split('\t');
    if (cols.length < 3) continue;

    const added = cols[0] === '-' ? 0 : Number.parseInt(cols[0], 10) || 0;
    const deleted = cols[1] === '-' ? 0 : Number.parseInt(cols[1], 10) || 0;
    const path = cols.slice(2).join('\t');
    if (!path) continue;

    const existing = byPath.get(path) || {
      path,
      previousPath: '',
      status: 'M',
      statusRaw: 'M',
      added: 0,
      deleted: 0,
      churn: 0,
    };

    existing.added = added;
    existing.deleted = deleted;
    existing.churn = added + deleted;
    byPath.set(path, existing);
  }

  return Array.from(byPath.values()).sort((a, b) => {
    if (b.churn !== a.churn) return b.churn - a.churn;
    return a.path.localeCompare(b.path);
  });
}

function detectSubsystem(path) {
  const normalized = (path || '').replace(/\\/g, '/');
  for (const [prefix, name] of SUBSYSTEM_RULES) {
    if (normalized.startsWith(prefix)) return name;
  }
  return 'Other';
}

function summarizeSubsystems(changedFiles) {
  const map = new Map();
  for (const file of changedFiles) {
    const subsystem = detectSubsystem(file.path);
    const existing = map.get(subsystem) || {
      subsystem,
      fileCount: 0,
      churn: 0,
      samplePaths: [],
      files: [],
    };
    existing.fileCount += 1;
    existing.churn += file.churn || 0;
    existing.files.push(file);
    if (existing.samplePaths.length < 4) {
      existing.samplePaths.push(file.path);
    }
    map.set(subsystem, existing);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.churn !== a.churn) return b.churn - a.churn;
    return b.fileCount - a.fileCount;
  });
}

function formatCommitEvidence(commits, maxLines = MAX_COMMIT_LINES) {
  if (!commits.length) return '(no commits)';
  const rows = commits.slice(0, maxLines).map((commit) => {
    const title = commit.subject || commit.body.split('\n')[0] || '(no subject)';
    return `- ${commit.hash} | ${commit.date} | ${title}`;
  });
  if (commits.length > maxLines) {
    rows.push(`- ... (${commits.length - maxLines} more commits omitted)`);
  }
  return rows.join('\n');
}

function formatChangedFilesEvidence(changedFiles, maxFiles = MAX_FILES_EVIDENCE) {
  if (!changedFiles.length) return '(no changed files)';
  const rows = changedFiles.slice(0, maxFiles).map((file) => {
    const churn = file.churn > 0 ? ` +${file.added}/-${file.deleted}` : '';
    const renamed = file.previousPath ? ` (from ${file.previousPath})` : '';
    return `- [${file.status}] ${file.path}${renamed}${churn}`;
  });
  if (changedFiles.length > maxFiles) {
    rows.push(`- ... (${changedFiles.length - maxFiles} more files omitted)`);
  }
  return rows.join('\n');
}

function formatSubsystemEvidence(subsystems) {
  if (!subsystems.length) return '(no subsystem summary)';
  return subsystems
    .map((item) => {
      const samples = item.samplePaths.length ? ` | examples: ${item.samplePaths.join(', ')}` : '';
      return `- ${item.subsystem}: ${item.fileCount} files, churn ${item.churn}${samples}`;
    })
    .join('\n');
}

function getDiffStat(rangeSpec) {
  return truncate(sh(`git diff --stat ${rangeSpec}`, ''), MAX_DIFFSTAT_CHARS, 'diffstat');
}

function getFocusedPatch(rangeSpec, changedFiles) {
  if (!changedFiles.length) return '';
  const focusFiles = changedFiles
    .filter((file) => file.churn > 0)
    .slice(0, 12)
    .map((file) => file.path);

  const selectedFiles = focusFiles.length ? focusFiles : changedFiles.slice(0, 12).map((file) => file.path);
  const fileArgs = selectedFiles.map(shellEscape).join(' ');
  const patch = fileArgs
    ? sh(`git diff --unified=1 --no-color ${rangeSpec} -- ${fileArgs}`, '')
    : sh(`git diff --unified=1 --no-color ${rangeSpec}`, '');

  return truncate(patch, MAX_PATCH_CONTEXT_CHARS, 'patch excerpts');
}

function architectureKeywordsForChanges(changedFiles) {
  const paths = changedFiles.map((file) => file.path.replace(/\\/g, '/'));
  const keywords = new Set();

  if (paths.some((p) => p.startsWith('app/src/routes/api/'))) keywords.add('src/routes/api/');
  if (paths.some((p) => p.startsWith('app/src/services/'))) keywords.add('src/services/');
  if (paths.some((p) => p.startsWith('app/src/middleware/'))) keywords.add('src/middleware/');
  if (paths.some((p) => p.startsWith('app/src/hooks/'))) keywords.add('src/hooks/');
  if (paths.some((p) => p.startsWith('app/src/components/'))) keywords.add('src/components/');
  if (paths.some((p) => p.startsWith('app/src/pages/'))) keywords.add('src/pages/');
  if (paths.some((p) => p.startsWith('app/src/lib/'))) keywords.add('src/lib/');
  if (paths.some((p) => p.startsWith('app/src/stores/'))) keywords.add('src/stores/');
  if (paths.some((p) => p.startsWith('app/src-tauri/'))) keywords.add('runtime environments');
  if (paths.some((p) => p.startsWith('.github/workflows/'))) keywords.add('canonical patterns');
  if (paths.some((p) => p.startsWith('.github/scripts/'))) keywords.add('canonical patterns');
  if (paths.some((p) => p.startsWith('llm/'))) keywords.add('architecture');
  if (paths.some((p) => p.includes('/downloads/'))) keywords.add('src/services/downloads/');
  if (paths.some((p) => p.includes('/stream'))) keywords.add('stream-resolver.ts');
  if (paths.some((p) => p.includes('/player'))) keywords.add('player/');

  return Array.from(keywords);
}

function getArchitectureContext(changedFiles) {
  if (!existsSync(ARCHITECTURE_PATH)) return '';
  const architectureText = readFileSync(ARCHITECTURE_PATH, 'utf8');
  const keywords = architectureKeywordsForChanges(changedFiles);
  if (!keywords.length) {
    return truncate(architectureText, MAX_ARCH_CONTEXT_CHARS, 'architecture context');
  }

  const sections = architectureText.split('\n## ');
  const intro = sections[0] || '';
  const matched = [];

  for (let i = 1; i < sections.length; i += 1) {
    const section = `## ${sections[i]}`;
    const lower = section.toLowerCase();
    if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
      matched.push(section);
    }
  }

  const merged = [intro.trim(), ...matched].filter(Boolean).join('\n\n');
  return truncate(merged || architectureText, MAX_ARCH_CONTEXT_CHARS, 'architecture context');
}

function classifyCommit(commit) {
  const text = `${commit.subject}\n${commit.body}`.toLowerCase();

  if (/\b(breaking|migration|migrate|deprecated|deprecate|rename|renamed|remove support|requires?)\b/.test(text)) {
    return 'breaking';
  }
  if (/\b(feat|feature|features|add|added|new|introduce|support|allow|enable)\b/.test(text)) {
    return 'feature';
  }
  if (/\b(fix|fixed|bug|bugs|issue|issues|crash|error|errors|correct|correctly|resolve|resolved|prevent|repair|handle)\b/.test(text)) {
    return 'fix';
  }
  if (/\b(ui|ux|design|layout|style|modal|screen|page|view|responsive)\b/.test(text)) {
    return 'ui';
  }
  if (/\b(refactor|chore|build|deps|dependency|cleanup|test|tests|release|workflow|ci|docs?)\b/.test(text)) {
    return 'maintenance';
  }
  return 'unknown';
}

function summarizeCommitIntents(commits) {
  const counts = {
    feature: 0,
    fix: 0,
    ui: 0,
    maintenance: 0,
    breaking: 0,
    unknown: 0,
  };

  for (const commit of commits) {
    counts[classifyCommit(commit)] += 1;
  }

  return counts;
}

function collectTokensFromFiles(files) {
  const counts = new Map();

  for (const file of files) {
    const parts = String(file.path || '')
      .replace(/\\/g, '/')
      .split(/[\/_.-]/g)
      .map((part) => normalizeToken(part))
      .filter((part) => part && /^[a-z][a-z0-9]+$/.test(part))
      .filter((part) => part.length >= 3)
      .filter((part) => !STOPWORDS.has(part));

    for (const part of parts) {
      counts.set(part, (counts.get(part) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([token, count]) => ({ token, count }));
}

function tokensToSet(tokens) {
  return new Set(tokens.map((item) => item.token));
}

function inferFocusPhrase(subsystem, tokenSet) {
  if (tokenSet.has('subtitle') && tokenSet.has('download')) return 'subtitles and downloads';
  if (tokenSet.has('update') && tokenSet.has('release')) return 'updates and release delivery';
  if (tokenSet.has('setting') && tokenSet.has('update')) return 'settings and update prompts';
  if (tokenSet.has('streaming') || tokenSet.has('stream') || tokenSet.has('player')) return 'streaming and playback';
  if (tokenSet.has('installer') || tokenSet.has('download')) return 'downloads and installers';
  if (tokenSet.has('admin')) return 'admin tooling';
  if (tokenSet.has('docker')) return 'Docker deployment';
  if (tokenSet.has('subtitle')) return 'subtitles';
  if (tokenSet.has('download')) return 'downloads';
  if (tokenSet.has('release')) return 'release delivery';
  if (tokenSet.has('setting')) return 'settings';

  switch (subsystem) {
    case 'Desktop Runtime':
      return 'the desktop runtime';
    case 'Backend API':
      return 'the backend API';
    case 'Backend Services':
      return 'backend services';
    case 'Backend Middleware':
      return 'request handling';
    case 'Frontend Components':
    case 'Frontend Hooks':
    case 'Frontend Pages':
    case 'Frontend Styles':
      return 'the app interface';
    case 'Landing Site':
      return 'the landing site';
    case 'CI / Workflows':
      return 'build automation';
    case 'Release Tooling':
      return 'release tooling';
    case 'Documentation':
    case 'Architecture Docs':
      return 'documentation';
    default:
      return 'core product flows';
  }
}

function inferAreaTitle(subsystem, tokenSet) {
  if (tokenSet.has('subtitle') && tokenSet.has('download')) return 'Subtitles and downloads';
  if (tokenSet.has('update') && tokenSet.has('release')) return 'Update and release flow';
  if (tokenSet.has('setting') && tokenSet.has('update')) return 'Settings and updates';
  if (tokenSet.has('streaming') || tokenSet.has('stream') || tokenSet.has('player')) return 'Streaming and playback';
  if (tokenSet.has('installer') || tokenSet.has('download')) return 'Downloads and installers';
  if (tokenSet.has('admin')) return 'Admin tooling';
  if (tokenSet.has('docker')) return 'Docker deployment';

  switch (subsystem) {
    case 'Desktop Runtime':
      return 'Desktop runtime polish';
    case 'Backend API':
      return 'Backend API improvements';
    case 'Backend Services':
      return 'Backend service reliability';
    case 'Backend Middleware':
      return 'Backend request handling';
    case 'Frontend Components':
    case 'Frontend Hooks':
    case 'Frontend Pages':
    case 'Frontend Styles':
      return 'Interface polish';
    case 'Frontend State':
      return 'State management';
    case 'Frontend Core Lib':
    case 'Frontend Utilities':
      return 'Core app utilities';
    case 'App Core':
      return 'Core app behavior';
    case 'Landing Site':
      return 'Landing site and downloads';
    case 'CI / Workflows':
      return 'Build and CI automation';
    case 'Release Tooling':
      return 'Release tooling';
    case 'App Tooling':
      return 'App tooling';
    case 'Documentation':
      return 'Documentation updates';
    case 'Architecture Docs':
      return 'Architecture updates';
    default:
      return `${subsystem} updates`;
  }
}

function inferAreaCategory(subsystem, tokenSet, releaseType) {
  if (tokenSet.has('breaking') || tokenSet.has('migration')) return 'breaking';

  if (
    subsystem === 'CI / Workflows' ||
    subsystem === 'Release Tooling' ||
    subsystem === 'Documentation' ||
    subsystem === 'Architecture Docs' ||
    subsystem === 'App Tooling'
  ) {
    return 'maintenance';
  }

  if (
    subsystem === 'Frontend Components' ||
    subsystem === 'Frontend Hooks' ||
    subsystem === 'Frontend Pages' ||
    subsystem === 'Frontend Styles' ||
    subsystem === 'Landing Site'
  ) {
    return 'ui';
  }

  if (releaseType === 'minor' || releaseType === 'major') {
    return 'feature';
  }

  return 'fix';
}

function buildAreaSummary(area, releaseType) {
  const filesText = formatCodeList(area.samplePaths, 3);
  const focus = area.focusPhrase;

  switch (area.category) {
    case 'feature':
      return `A big share of this release lands in ${focus}. The heaviest changes show up in ${filesText}, which suggests broader capabilities or deeper coverage in that part of the product.`;
    case 'ui':
      return `This release puts visible polish into ${focus}. The busiest files were ${filesText}, so users should notice a cleaner or more predictable experience in those surfaces.`;
    case 'maintenance':
      return `A meaningful slice of the work went into ${focus}. Changes centered on ${filesText}, tightening the project plumbing that supports future releases.`;
    case 'fix':
    default:
      return `Most of the churn here is about stability around ${focus}. The main touch points were ${filesText}, so this release should feel more reliable in that workflow.`;
  }
}

function buildAreaBullet(area) {
  const base = sentenceCase(area.title.toLowerCase());
  switch (area.category) {
    case 'feature':
      return `${base} received the biggest product-facing work in this release.`;
    case 'ui':
      return `${base} picked up the most visible polish in this release.`;
    case 'maintenance':
      return `${base} was tightened up behind the scenes to make the project easier to ship and maintain.`;
    case 'fix':
    default:
      return `${base} was a major focus for fixes and day-to-day reliability.`;
  }
}

function finalizeArea(area) {
  return {
    ...area,
    summary: buildAreaSummary(area),
    bullet: buildAreaBullet(area),
  };
}

function categoryPriority(category) {
  switch (category) {
    case 'feature':
      return 4;
    case 'ui':
      return 3;
    case 'fix':
      return 2;
    case 'maintenance':
      return 1;
    default:
      return 0;
  }
}

function getAreaDetails(subsystems, changedFiles, releaseType) {
  return subsystems.map((subsystem) => {
    const files = changedFiles.filter((file) => detectSubsystem(file.path) === subsystem.subsystem);
    const tokens = collectTokensFromFiles(files.slice(0, 10));
    const tokenSet = tokensToSet(tokens);

    const area = {
      subsystem: subsystem.subsystem,
      fileCount: subsystem.fileCount,
      churn: subsystem.churn,
      files,
      samplePaths: files.slice(0, 3).map((file) => file.path),
      tokens,
      focusPhrase: inferFocusPhrase(subsystem.subsystem, tokenSet),
      title: inferAreaTitle(subsystem.subsystem, tokenSet),
      category: inferAreaCategory(subsystem.subsystem, tokenSet, releaseType),
    };

    return finalizeArea(area);
  });
}

function mergeAreas(areaDetails) {
  const merged = new Map();

  for (const area of areaDetails) {
    const key = `${area.title}|${area.focusPhrase}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...area,
        samplePaths: [...area.samplePaths],
      });
      continue;
    }

    existing.fileCount += area.fileCount;
    existing.churn += area.churn;
    existing.files.push(...area.files);
    existing.samplePaths = Array.from(new Set([...existing.samplePaths, ...area.samplePaths])).slice(0, 3);
    if (categoryPriority(area.category) > categoryPriority(existing.category)) {
      existing.category = area.category;
    }
  }

  return Array.from(merged.values())
    .map((area) => finalizeArea(area))
    .sort((a, b) => {
      if (b.churn !== a.churn) return b.churn - a.churn;
      return a.title.localeCompare(b.title);
    });
}

function pickHighlightAreas(areaDetails) {
  const usable = areaDetails.filter((area) => !(area.subsystem === 'Other' && area.title === 'Other updates'));
  const sourceAreas = usable.length ? usable : areaDetails;
  const preferred = sourceAreas.filter((area) => area.category !== 'maintenance' && area.category !== 'breaking');
  const source = preferred.length ? preferred : sourceAreas.filter((area) => area.category !== 'breaking');
  const selected = [];
  const seenTitles = new Set();

  for (const area of source) {
    const key = area.title.toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    selected.push(area);
    if (selected.length >= MAX_HIGHLIGHTS) break;
  }

  return selected;
}

function collectBreakingChanges(commits, changedFiles) {
  const seen = new Set();
  const items = [];

  for (const commit of commits) {
    const text = `${commit.subject}\n${commit.body}`.trim();
    if (!text) continue;
    if (!/\b(breaking|migration|migrate|deprecated|deprecate|rename|renamed|remove support|requires?)\b/i.test(text)) {
      continue;
    }

    const summary = commit.subject || commit.body.split('\n')[0] || '';
    if (!summary) continue;
    const cleaned = summary.replace(/^[a-z]+(\(.+\))?:\s*/i, '').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(`${sentenceCase(cleaned)} (${commit.hash})`);
  }

  if (items.length) return items.slice(0, 5);

  for (const file of changedFiles) {
    if (!/\b(migration|migrate|breaking|deprecated|deprecate)\b/i.test(file.path)) continue;
    const label = `Review \`${escapeMarkdown(file.path)}\` for migration or compatibility changes.`;
    if (seen.has(label)) continue;
    seen.add(label);
    items.push(label);
  }

  return items.slice(0, 5);
}

function getRepositoryUrl() {
  const remote = sh('git config --get remote.origin.url', '');
  if (!remote) return FALLBACK_REPOSITORY_URL;

  const httpsMatch = remote.match(/https:\/\/github\.com\/(.+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return `https://github.com/${httpsMatch[1].replace(/\.git$/i, '')}`;
  }

  const sshMatch = remote.match(/git@github\.com:(.+?)(?:\.git)?$/i);
  if (sshMatch) {
    return `https://github.com/${sshMatch[1].replace(/\.git$/i, '')}`;
  }

  return FALLBACK_REPOSITORY_URL;
}

function parseGitHubRepo(repoUrl) {
  const httpsMatch = repoUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2],
    };
  }

  const sshMatch = repoUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2],
    };
  }

  return null;
}

function sanitizeHandleCandidate(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const withoutAt = trimmed.replace(/^@+/, '');
  const handle = withoutAt
    .replace(/\+.*$/, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return handle ? `@${handle}` : '';
}

function handleFromEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return '';

  const noreplyWithId = normalized.match(/^\d+\+([^@]+)@users\.noreply\.github\.com$/);
  if (noreplyWithId) return sanitizeHandleCandidate(noreplyWithId[1]);

  const noreply = normalized.match(/^([^@]+)@users\.noreply\.github\.com$/);
  if (noreply) return sanitizeHandleCandidate(noreply[1]);

  const localPart = normalized.split('@')[0] || '';
  return sanitizeHandleCandidate(localPart);
}

function formatContributorHandle(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.startsWith('@')) return normalized;
  return sanitizeHandleCandidate(normalized);
}

async function resolveGitHubLogin(owner, repo, sha, token) {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}`, {
      headers: {
        'User-Agent': 'zentrio-release-notes',
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) return '';
    const data = await response.json();
    const login = data?.author?.login || data?.committer?.login || '';
    return sanitizeHandleCandidate(login);
  } catch {
    return '';
  }
}

async function getContributors(rangeSpec, repoUrl) {
  const raw = sh(`git log ${rangeSpec} --pretty=format:%H%x09%an%x09%ae`, '');
  if (!raw) return [];

  const repo = parseGitHubRepo(repoUrl);
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
  const seen = new Set();
  const contributors = [];

  for (const line of raw.split('\n')) {
    const [sha, name, email] = line.split('\t');
    if (!sha) continue;
    if (/\[bot\]$/i.test(name || '') || /\[bot\]@/i.test(email || '')) continue;

    let handle = '';
    if (repo) {
      handle = await resolveGitHubLogin(repo.owner, repo.repo, sha, token);
    }
    if (!handle) {
      handle = handleFromEmail(email);
    }

    if (!handle) continue;
    const key = handle.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    contributors.push(handle);
    if (contributors.length >= MAX_CONTRIBUTORS) break;
  }

  return contributors;
}

async function generateWithNanoGPT(prompt, apiKey) {
  const endpoint = 'https://nano-gpt.com/api/v1/chat/completions';
  const body = {
    model: 'zai-org/glm-5:thinking',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.15,
    max_tokens: 4096,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`NanoGPT API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  if (!text) {
    throw new Error('NanoGPT returned empty content');
  }
  return text.trim();
}

function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain a JSON object');
  }
  return candidate.slice(start, end + 1);
}

function coerceStringArray(value, maxItems) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeAiNotesPayload(raw) {
  const parsed = JSON.parse(extractJsonObject(raw));
  const spotlights = Array.isArray(parsed?.spotlights)
    ? parsed.spotlights
        .map((item) => ({
          title: typeof item?.title === 'string' ? item.title.trim() : '',
          summary: typeof item?.summary === 'string' ? item.summary.trim() : '',
        }))
        .filter((item) => item.title && item.summary)
        .slice(0, MAX_SPOTLIGHTS)
    : [];

  return {
    intro: typeof parsed?.intro === 'string' ? parsed.intro.trim() : '',
    highlights: coerceStringArray(parsed?.highlights, MAX_HIGHLIGHTS),
    breakingChanges: coerceStringArray(parsed?.breakingChanges, 5),
    spotlights,
    buckets: {
      feature: coerceStringArray(parsed?.buckets?.feature, MAX_BUCKET_ITEMS),
      fix: coerceStringArray(parsed?.buckets?.fix, MAX_BUCKET_ITEMS),
      ui: coerceStringArray(parsed?.buckets?.ui, MAX_BUCKET_ITEMS),
      maintenance: coerceStringArray(parsed?.buckets?.maintenance, MAX_BUCKET_ITEMS),
    },
  };
}

function getReleaseTypeContext(version, prevTag, tag) {
  const current = version.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  const previous = (prevTag || '').replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);

  const major = Number.parseInt(current?.[1] || '0', 10);
  const minor = Number.parseInt(current?.[2] || '0', 10);
  const prevMajor = Number.parseInt(previous?.[1] || '0', 10);
  const prevMinor = Number.parseInt(previous?.[2] || '0', 10);

  if (previous && major > prevMajor) return { type: 'major' };
  if (previous && minor > prevMinor) return { type: 'minor' };
  return { type: 'patch' };
}

function buildReleaseTypeContext(tag, prevTag, releaseType) {
  if (releaseType === 'major') {
    return `This is a MAJOR release (${prevTag || 'previous tag unavailable'} -> ${tag}). Focus on major new capabilities, migrations, and user-visible impact.`;
  }
  if (releaseType === 'minor') {
    return `This is a MINOR release (${prevTag || 'previous tag unavailable'} -> ${tag}). Focus on meaningful feature additions, workflow improvements, and practical user impact.`;
  }
  return `This is a PATCH release (${prevTag || 'previous tag unavailable'} -> ${tag}). Focus on reliability, polish, bug fixes, and why the affected flows feel better after updating.`;
}

function buildStructuredAIPrompt(input) {
  const {
    tag,
    prevTag,
    releaseType,
    releaseTypeContext,
    featureCandidates,
    architectureContext,
    subsystemEvidence,
    changedFilesEvidence,
    diffStat,
    focusedPatch,
    commitEvidence,
  } = input;

  return [
    'You are writing polished GitHub release notes for Zentrio.',
    'Your job is to explain what changed inside the product and why users or self-hosters should care.',
    '',
    `Target version: ${tag}`,
    prevTag ? `Previous version: ${prevTag}` : 'Previous version: unavailable',
    `Release type: ${releaseType}`,
    releaseTypeContext,
    '',
    'Important instructions:',
    '- Use the architecture context to understand what each subsystem does in Zentrio.',
    '- Use changed files and patch excerpts as the primary evidence for what actually changed.',
    '- Commit messages are secondary evidence only because they may be vague or low quality.',
    '- Do not say "files changed" or list filenames in the final prose unless absolutely necessary.',
    '- Translate technical changes into product behavior, workflow changes, reliability improvements, or operator impact.',
    '- If evidence is weak, omit the claim instead of guessing.',
    '- Keep the tone like Immich release notes: warm, informative, concise, and user-facing.',
    '- Prefer explaining impact such as faster, clearer, more stable, easier to manage, safer, smoother playback, better downloads, etc.',
    '- High-priority feature candidates listed below should be included when the patch evidence supports them.',
    '',
    'Return strict JSON only, with this exact shape:',
    '{',
    '  "intro": "string",',
    '  "highlights": ["string"],',
    '  "breakingChanges": ["string"],',
    '  "spotlights": [{"title": "string", "summary": "string"}],',
    '  "buckets": {',
    '    "feature": ["string"],',
    '    "fix": ["string"],',
    '    "ui": ["string"],',
    '    "maintenance": ["string"]',
    '  }',
    '}',
    '',
    'JSON rules:',
    `- intro: 1 short paragraph, mention the main product areas affected in ${tag}.`,
    `- highlights: up to ${MAX_HIGHLIGHTS} bullets, each concrete and user-facing.`,
    '- breakingChanges: only include items if the evidence clearly supports them.',
    `- spotlights: up to ${MAX_SPOTLIGHTS} sections, each with a short title and a 2-4 sentence summary.`,
    `- buckets.feature/fix/ui/maintenance: up to ${MAX_BUCKET_ITEMS} bullets each.`,
    '- Every bullet must describe a real change and its impact, not just a vague area name.',
    '',
    'Architecture context:',
    architectureContext || '(not available)',
    '',
    'High-priority feature candidates:',
    featureCandidates?.length
      ? featureCandidates.map((candidate) => `- ${candidate.title}: ${candidate.summary}`).join('\n')
      : '(none detected)',
    '',
    'Subsystem summary:',
    subsystemEvidence || '(none)',
    '',
    'Changed files:',
    changedFilesEvidence || '(none)',
    '',
    'Diff stat:',
    diffStat || '(none)',
    '',
    'Focused patch excerpts:',
    focusedPatch || '(none)',
    '',
    'Commits (secondary evidence):',
    commitEvidence || '(none)',
  ].join('\n');
}

function buildIntro(tag, releaseType, highlightAreas, intentCounts, featureCandidates = []) {
  const focusAreas = highlightAreas.slice(0, 3).map((area) => area.focusPhrase);
  const focusLine = focusAreas.length ? ` across ${listToSentence(focusAreas)}` : '';
  const headlineFeature = featureCandidates[0];
  const headlineFeatureLabel = headlineFeature
    ? sentenceCase(headlineFeature.title).replace(/\bintrodb\b/g, 'IntroDB')
    : '';

  if (releaseType === 'major') {
    return `Welcome to release \`${tag}\` of Zentrio. This is a broader milestone release with meaningful work${focusLine}, plus the kind of cleanup we want in place before the next stretch of development.`;
  }

  if (releaseType === 'minor') {
    if (headlineFeature) {
      return `Welcome to release \`${tag}\` of Zentrio. The headline addition in this release is ${headlineFeatureLabel}, alongside polish${focusLine} to round out the overall experience.`;
    }
    return `Welcome to release \`${tag}\` of Zentrio. This release leans into new capabilities and polish${focusLine}, while still tightening a few rough edges along the way.`;
  }

  if (headlineFeature) {
    return `Welcome to release \`${tag}\` of Zentrio. This patch is headlined by ${headlineFeatureLabel}, with supporting improvements${focusLine} that make playback and day-to-day usage feel more complete.`;
  }

  if (intentCounts.fix >= intentCounts.feature && intentCounts.fix >= intentCounts.ui) {
    return `Welcome to release \`${tag}\` of Zentrio. This patch is mainly about polish and reliability${focusLine}, with a handful of focused improvements that should make day-to-day usage smoother.`;
  }

  return `Welcome to release \`${tag}\` of Zentrio. This patch keeps things focused${focusLine}, mixing targeted improvements with the maintenance work needed to keep the project moving cleanly.`;
}

function buildBuckets(areaDetails) {
  const buckets = {
    feature: [],
    fix: [],
    ui: [],
    maintenance: [],
  };

  for (const area of areaDetails) {
    if (!buckets[area.category]) continue;
    if (area.subsystem === 'Other' && area.title === 'Other updates') continue;

    let bullet = '';
    if (area.category === 'feature') {
      bullet = `${area.title}: work concentrated around ${area.focusPhrase}.`;
    } else if (area.category === 'fix') {
      bullet = `${area.title}: reliability work landed around ${area.focusPhrase}.`;
    } else if (area.category === 'ui') {
      bullet = `${area.title}: visible polish touched ${area.focusPhrase}.`;
    } else {
      bullet = `${area.title}: internal work tightened up ${area.focusPhrase}.`;
    }

    buckets[area.category].push(bullet);
  }

  return buckets;
}

function mergeAiNotesWithFallback(aiNotes, fallbackNotes) {
  if (!aiNotes) return fallbackNotes;
  return {
    intro: aiNotes.intro || fallbackNotes.intro,
    highlights: aiNotes.highlights?.length ? aiNotes.highlights : fallbackNotes.highlights,
    breakingChanges: aiNotes.breakingChanges?.length ? aiNotes.breakingChanges : fallbackNotes.breakingChanges,
    spotlights: aiNotes.spotlights?.length ? aiNotes.spotlights : fallbackNotes.spotlights,
    buckets: {
      feature: aiNotes.buckets?.feature?.length ? aiNotes.buckets.feature : fallbackNotes.buckets.feature,
      fix: aiNotes.buckets?.fix?.length ? aiNotes.buckets.fix : fallbackNotes.buckets.fix,
      ui: aiNotes.buckets?.ui?.length ? aiNotes.buckets.ui : fallbackNotes.buckets.ui,
      maintenance: aiNotes.buckets?.maintenance?.length
        ? aiNotes.buckets.maintenance
        : fallbackNotes.buckets.maintenance,
    },
  };
}

function renderReleaseNotes(input) {
  const {
    tag,
    prevTag,
    repoUrl,
    intro,
    highlights,
    breakingChanges,
    spotlights,
    buckets,
    contributors,
  } = input;

  const lines = [];
  lines.push(intro);
  lines.push('');

  if (highlights.length) {
    lines.push('## Highlights');
    for (const highlight of highlights) {
      lines.push(`- ${highlight}`);
    }
    lines.push('');
  }

  if (breakingChanges.length) {
    lines.push('## Breaking Changes');
    for (const item of breakingChanges) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  for (const spotlight of spotlights) {
    lines.push(`### ${spotlight.title}`);
    lines.push(spotlight.summary);
    lines.push('');
  }

  const bucketLabels = {
    feature: '### Features',
    fix: '### Fixes',
    ui: '### UI / UX',
    maintenance: '### Under the Hood',
  };

  const usedBuckets = CATEGORY_ORDER.filter((category) => buckets[category]?.length);
  if (usedBuckets.length) {
    lines.push("## What's Changed");
    for (const category of usedBuckets) {
      lines.push(bucketLabels[category]);
      for (const item of buckets[category].slice(0, MAX_BUCKET_ITEMS)) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

  if (contributors.length) {
    lines.push('## Contributors');
    const contributorHandles = contributors.map((contributor) => formatContributorHandle(contributor)).filter(Boolean);
    lines.push(`Thanks to ${listToSentence(contributorHandles)}.`);
    lines.push('');
  }

  if (prevTag) {
    lines.push(`Full Changelog: ${repoUrl}/compare/${prevTag}...${tag}`);
  } else {
    lines.push(`Full Changelog: ${repoUrl}/releases`);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function basicFallback(tag, prevTag, repoUrl) {
  const compareLine = prevTag
    ? `Full Changelog: ${repoUrl}/compare/${prevTag}...${tag}`
    : `Full Changelog: ${repoUrl}/releases`;

  return [
    `Welcome to release \`${tag}\` of Zentrio.`,
    '',
    'Release metadata was available, but there was not enough diff information to build a detailed summary for this version.',
    '',
    compareLine,
  ].join('\n');
}

async function main() {
  const version = getVersion();
  const tag = version.startsWith('v') ? version : `v${version}`;
  const prevTag = getPrevTag(tag);
  const rangeSpec = getRangeSpec(prevTag);
  const repoUrl = getRepositoryUrl();

  const commits = parseCommits(getCommitLog(prevTag, rangeSpec));
  const changedFiles = getChangedFiles(rangeSpec);
  const storyChangedFiles = getStoryChangedFiles(changedFiles);

  if (!commits.length && !changedFiles.length) {
    writeFileSync('RELEASE_NOTES.md', basicFallback(tag, prevTag, repoUrl), 'utf8');
    return;
  }

  const { type: releaseType } = getReleaseTypeContext(version, prevTag, tag);
  const subsystems = summarizeSubsystems(storyChangedFiles);
  const areaDetails = mergeAreas(getAreaDetails(subsystems, storyChangedFiles, releaseType));
  const highlightAreas = pickHighlightAreas(areaDetails);
  const intentCounts = summarizeCommitIntents(commits);
  const breakingChanges = collectBreakingChanges(commits, storyChangedFiles);
  const contributors = await getContributors(rangeSpec, repoUrl);
  const buckets = buildBuckets(areaDetails);
  const architectureContext = getArchitectureContext(storyChangedFiles);
  const commitEvidence = formatCommitEvidence(commits);
  const changedFilesEvidence = formatChangedFilesEvidence(storyChangedFiles);
  const subsystemEvidence = formatSubsystemEvidence(subsystems);
  const diffStat = getDiffStat(rangeSpec);
  const focusedPatch = getFocusedPatch(rangeSpec, storyChangedFiles);
  const featurePatch = sh(`git diff --unified=0 --no-color ${rangeSpec}`, '');
  const releaseTypeContext = buildReleaseTypeContext(tag, prevTag, releaseType);
  const featureCandidates = extractFeatureCandidates(storyChangedFiles, featurePatch);

  const fallbackNotes = {
    intro: buildIntro(tag, releaseType, highlightAreas, intentCounts, featureCandidates),
    highlights: dedupeStrings(
      [...featureCandidates.map((candidate) => candidate.highlight), ...highlightAreas.map((area) => area.bullet)],
      MAX_HIGHLIGHTS,
    ),
    breakingChanges,
    spotlights: dedupeSpotlights(
      [...featureCandidates.map((candidate) => ({ title: candidate.title, summary: candidate.summary })), ...highlightAreas],
      MAX_SPOTLIGHTS,
    ),
    buckets: {
      ...buckets,
      feature: dedupeStrings(
        [...featureCandidates.map((candidate) => candidate.bucket), ...buckets.feature],
        MAX_BUCKET_ITEMS,
      ),
    },
  };

  let content = fallbackNotes;
  const apiKey = process.env.NANOGPT_API_KEY || '';
  if (apiKey) {
    try {
      const aiPrompt = buildStructuredAIPrompt({
        tag,
        prevTag,
        releaseType,
        releaseTypeContext,
        featureCandidates,
        architectureContext,
        subsystemEvidence,
        changedFilesEvidence,
        diffStat,
        focusedPatch,
        commitEvidence,
      });
      const aiRaw = await generateWithNanoGPT(aiPrompt, apiKey);
      const aiNotes = normalizeAiNotesPayload(aiRaw);
      content = mergeAiNotesWithFallback(aiNotes, fallbackNotes);
    } catch (error) {
      console.error('[release-notes] AI generation failed, falling back to deterministic notes:', error?.message || error);
    }
  } else {
    console.log('[release-notes] No NANOGPT_API_KEY found; using deterministic fallback.');
  }

  const notes = renderReleaseNotes({
    tag,
    prevTag,
    repoUrl,
    intro: content.intro,
    highlights: content.highlights,
    breakingChanges: content.breakingChanges,
    spotlights: content.spotlights,
    buckets: content.buckets,
    contributors,
  });

  writeFileSync('RELEASE_NOTES.md', notes, 'utf8');
  console.log('Release notes written to RELEASE_NOTES.md');
}

main().catch((err) => {
  console.error(err);
  try {
    const version = getVersion();
    const tag = version.startsWith('v') ? version : `v${version}`;
    writeFileSync('RELEASE_NOTES.md', basicFallback(tag, '', getRepositoryUrl()), 'utf8');
  } catch {
    // no-op
  }
  process.exit(0);
});
