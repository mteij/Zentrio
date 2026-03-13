// @ts-nocheck
/**
 * Generate release notes using NanoGPT if NANOGPT_API_KEY is available.
 * The prompt is grounded in real code changes (diffs + file churn) and
 * architecture context so notes do not rely only on commit messages.
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
const MAX_ARCH_CONTEXT_CHARS = 12000;
const MAX_DIFFSTAT_CHARS = 6000;
const MAX_PATCH_CONTEXT_CHARS = 28000;
const MAX_COMMIT_LINES = 120;
const MAX_FILES_EVIDENCE = 180;

const SUBSYSTEM_RULES = [
  ['.github/workflows/', 'CI / Workflows'],
  ['.github/scripts/', 'Release Tooling'],
  ['app/src/routes/api/', 'Backend API Routes'],
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
  ['llm/', 'LLM Docs'],
  ['docs/', 'Documentation'],
];

function sh(cmd, fallback = '') {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
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
  try {
    const lastRelease = sh(
      'gh release list --limit 1 --exclude-drafts --exclude-pre-releases --json tagName -q ".[0].tagName"',
      '',
    );
    if (lastRelease && lastRelease !== currentTag) {
      console.log(`[release-notes] Found previous release tag via GitHub CLI: ${lastRelease}`);
      return lastRelease;
    }
  } catch {
    console.log('[release-notes] Could not determine previous release via GitHub CLI, falling back to git tags.');
  }

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
    return sh(`git log --max-count=250 --pretty=format:%H%x09%ad%x09%s%x09%b --date=short ${rangeSpec}`, '');
  }
  return sh('git log --max-count=250 --pretty=format:%H%x09%ad%x09%s%x09%b --date=short', '');
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
    };
    existing.fileCount += 1;
    existing.churn += file.churn || 0;
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
  if (paths.some((p) => p.startsWith('.github/workflows/'))) keywords.add('canonical patterns');
  if (paths.some((p) => p.startsWith('.github/scripts/'))) keywords.add('canonical patterns');
  if (paths.some((p) => p.startsWith('llm/'))) keywords.add('architecture');

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

function basicMarkdownNotes(version, prevTag, analysis) {
  const { commits, changedFiles, subsystems } = analysis;
  if (!commits.length && !changedFiles.length) {
    return [
      `Release \`${version}\` has been published.`,
      '',
      'No commit or diff details were available at generation time.',
    ].join('\n');
  }

  const lines = [];
  lines.push(`Release \`${version}\` summarizes concrete code changes rather than commit text only.`);
  if (prevTag) {
    lines.push(`Compared against \`${prevTag}\`.`);
  }
  lines.push('');

  if (subsystems.length) {
    lines.push('### Highlights by area');
    for (const area of subsystems.slice(0, 8)) {
      lines.push(`- ${area.subsystem}: ${area.fileCount} files changed (churn ${area.churn})`);
    }
    lines.push('');
  }

  if (changedFiles.length) {
    lines.push('### Key file changes');
    for (const file of changedFiles.slice(0, 12)) {
      const churn = file.churn > 0 ? ` (+${file.added}/-${file.deleted})` : '';
      const renamed = file.previousPath ? ` (from ${file.previousPath})` : '';
      lines.push(`- [${file.status}] \`${file.path}\`${renamed}${churn}`);
    }
    lines.push('');
  }

  if (commits.length) {
    lines.push('### Notable commits');
    for (const commit of commits.slice(0, 12)) {
      const title = commit.subject || commit.body.split('\n')[0] || '(no subject)';
      lines.push(`- ${title} (${commit.hash})`);
    }
  }

  return lines.join('\n').trim();
}

async function generateWithNanoGPT(prompt, apiKey) {
  const endpoint = 'https://nano-gpt.com/api/v1/chat/completions';
  const body = {
    model: 'zai-org/glm-5:thinking',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
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
  return text.trim();
}

function getReleaseTypeContext(version, prevTag, tag) {
  const current = version.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  const previous = (prevTag || '').replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);

  const major = Number.parseInt(current?.[1] || '0', 10);
  const minor = Number.parseInt(current?.[2] || '0', 10);
  const prevMajor = Number.parseInt(previous?.[1] || '0', 10);
  const prevMinor = Number.parseInt(previous?.[2] || '0', 10);

  if (previous && major > prevMajor) {
    return {
      type: 'major',
      context: `This is a MAJOR release (${prevTag} -> ${tag}). Emphasize major capabilities, migration impact, and any breaking changes.`,
    };
  }

  if (previous && minor > prevMinor) {
    return {
      type: 'minor',
      context: `This is a MINOR release (${prevTag} -> ${tag}). Emphasize new capabilities and important improvements.`,
    };
  }

  return {
    type: 'patch',
    context: `This is a PATCH release (${prevTag || 'previous tag unavailable'} -> ${tag}). Keep notes concise and focus on fixes, reliability, and maintenance.`,
  };
}

function buildPrompt(input) {
  const {
    tag,
    prevTag,
    releaseType,
    releaseContext,
    commitEvidence,
    changedFilesEvidence,
    subsystemEvidence,
    diffStat,
    focusedPatch,
    architectureContext,
  } = input;

  const releaseGuidelines = {
    major: [
      '- Lead with a milestone summary.',
      '- Add a "Breaking Changes" section only when evidence supports it.',
      '- Include upgrade guidance when relevant.',
    ],
    minor: [
      '- Lead with the most important new capabilities.',
      '- Explain user impact for significant improvements.',
      '- Group related changes into coherent sections.',
    ],
    patch: [
      '- Keep the output tight and practical.',
      '- Prioritize bug fixes, stability, and maintenance work.',
      '- Avoid over-celebratory language.',
    ],
  };

  return [
    'You are writing GitHub release notes for Zentrio.',
    `Target version: ${tag}`,
    prevTag ? `Previous version: ${prevTag}` : 'Previous version: (first release or unavailable)',
    '',
    releaseContext,
    '',
    'Evidence handling rules:',
    '- Infer changes from code evidence first, not from commit wording.',
    '- Evidence priority: focused patch excerpts > diff stats > changed file list > commit subjects.',
    '- Use architecture context to interpret component purpose and user impact.',
    '- Do not invent features or breaking changes.',
    '- If something is uncertain, describe it as internal maintenance/refactor.',
    '',
    'Output constraints:',
    '- Markdown only.',
    '- No top-level title (GitHub already provides it).',
    '- Use concise bullets.',
    '- Include commit hash references when possible: (abc1234).',
    '- Use sections only when meaningful: Features, Bug Fixes, Improvements, Maintenance, Breaking Changes.',
    '',
    'Release-type guidance:',
    ...(releaseGuidelines[releaseType] || releaseGuidelines.patch),
    '',
    'Architecture context:',
    architectureContext || '(ARCHITECTURE.md not available)',
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

async function main() {
  const version = getVersion();
  const tag = version.startsWith('v') ? version : `v${version}`;
  const prevTag = getPrevTag(tag);
  const rangeSpec = getRangeSpec(prevTag);
  const commitLog = getCommitLog(prevTag, rangeSpec);

  const commits = parseCommits(commitLog);
  const changedFiles = getChangedFiles(rangeSpec);
  const subsystems = summarizeSubsystems(changedFiles);
  const architectureContext = getArchitectureContext(changedFiles);

  const commitEvidence = formatCommitEvidence(commits);
  const changedFilesEvidence = formatChangedFilesEvidence(changedFiles);
  const subsystemEvidence = formatSubsystemEvidence(subsystems);
  const diffStat = getDiffStat(rangeSpec);
  const focusedPatch = getFocusedPatch(rangeSpec, changedFiles);

  const { type: releaseType, context: releaseContext } = getReleaseTypeContext(version, prevTag, tag);
  const prompt = buildPrompt({
    tag,
    prevTag,
    releaseType,
    releaseContext,
    commitEvidence,
    changedFilesEvidence,
    subsystemEvidence,
    diffStat,
    focusedPatch,
    architectureContext,
  });

  const apiKey = process.env.NANOGPT_API_KEY || '';
  let notes = '';

  if (apiKey) {
    console.log('[release-notes] Using NanoGPT with diff-aware prompt and architecture context.');
    try {
      const ai = await generateWithNanoGPT(prompt, apiKey);
      if (ai && ai.length > 20) {
        notes = ai.trim();
      } else {
        console.log('[release-notes] NanoGPT returned empty or too-short output; using deterministic fallback.');
      }
    } catch (error) {
      console.error('[release-notes] NanoGPT API call failed; using deterministic fallback:', error?.message || error);
    }
  } else {
    console.log('[release-notes] No NANOGPT_API_KEY found; using deterministic fallback.');
  }

  if (!notes) {
    notes = basicMarkdownNotes(version, prevTag, { commits, changedFiles, subsystems });
  }

  notes = notes.replace(/^\s*#{1,6}\s.*\r?\n+/, '').trimStart();

  const links = '\n\n---\n\n**Links:**\n- [Public Instance](https://zentrio.eu)\n- [Documentation](https://docs.zentrio.eu)';
  const disclaimer =
    '\n\n> Notice: This project is developed with AI-assisted tooling. While maintained with care, releases may contain instabilities or security vulnerabilities; use at your own risk.';

  writeFileSync('RELEASE_NOTES.md', notes + links + disclaimer, 'utf8');
  console.log('Release notes written to RELEASE_NOTES.md');
}

main().catch((err) => {
  console.error(err);
  try {
    const version = getVersion();
    const disclaimer =
      '\n\n> Notice: This project is developed with AI-assisted tooling. While maintained with care, releases may contain instabilities or security vulnerabilities; use at your own risk.';
    writeFileSync(
      'RELEASE_NOTES.md',
      `- Automated release notes generation failed for version ${version}. See commit history and diff for details.\n${disclaimer}`,
      'utf8',
    );
  } catch {
    // no-op
  }
  process.exit(0);
});
