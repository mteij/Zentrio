 // @ts-nocheck
/**
 * Generate release notes using Gemini if GEMINI_API_KEY is available, otherwise
 * fall back to a conventional commit summary.
 *
 * Usage (from repo root in CI):
 *   node .github/scripts/generate-release-notes.mjs
 *
 * Outputs:
 *   RELEASE_NOTES.md in the repo root
 */
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

function sh(cmd, fallback = '') {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return fallback;
  }
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
  // Prefer semantic tags sorted descending, then pick first not equal to current.
  const tags = sh('git tag --list --sort=-version:refname', '').split('\n').map(s => s.trim()).filter(Boolean);
  const prev = tags.find(t => t !== currentTag);
  if (prev) return prev;

  // Fallback to describe
  const d = sh('git describe --abbrev=0 --tags HEAD~1 2>/dev/null', '');
  if (d && d !== currentTag) return d;
  return '';
}

function getCommitRange(prevTag) {
  if (prevTag) {
    return sh(`git log --pretty=format:%H%x09%ad%x09%s%x09%b --date=short ${prevTag}..HEAD`, '');
  }
  // First release: collect last 100 commits
  return sh('git log -n 100 --pretty=format:%H%x09%ad%x09%s%x09%b --date=short', '');
}

function basicMarkdownNotes(version, prevTag, commitLog) {
  if (!commitLog) {
    return ['- Welcome to the first release of Zentrio! This release includes the initial set of features and functionality.', ''].join('\n');
  }

  const commits = commitLog.split('\n').map(l => {
    const [hash, date, subject, body] = l.split('\t');
    const cleanSubject = (subject || '').trim();
    const cleanBody = (body || '').trim();
    const fullMessage = cleanBody ? `${cleanSubject}\n\n${cleanBody}` : cleanSubject;
    return {
      hash: hash?.slice(0, 7) || '',
      date: date || '',
      message: fullMessage
    };
  }).filter(c => c.message);

  // Group commits by type (conventional commits)
  const grouped = {
    '🚀 Features': [],
    '🐛 Bug Fixes': [],
    '💄 Improvements': [],
    '📝 Documentation': [],
    '🔧 Configuration': [],
    '⚙️ Chore': [],
    '🔄 Other': []
  };

  commits.forEach(commit => {
    const msg = commit.message.toLowerCase();
    let category = '🔄 Other';
    
    if (msg.startsWith('feat') || msg.includes('add') || msg.includes('new') || msg.includes('implement')) {
      category = '🚀 Features';
    } else if (msg.startsWith('fix') || msg.includes('bug') || msg.includes('issue') || msg.includes('resolve')) {
      category = '🐛 Bug Fixes';
    } else if (msg.startsWith('refactor') || msg.startsWith('perf') || msg.includes('improve') || msg.includes('optimize')) {
      category = '💄 Improvements';
    } else if (msg.startsWith('docs') || msg.includes('documentation') || msg.includes('readme')) {
      category = '📝 Documentation';
    } else if (msg.includes('config') || msg.includes('setting') || msg.includes('env')) {
      category = '🔧 Configuration';
    } else if (msg.startsWith('chore') || msg.startsWith('build') || msg.startsWith('ci') || msg.includes('update')) {
      category = '⚙️ Chore';
    }

    grouped[category].push(`- ${commit.message} (${commit.date}, ${commit.hash})`);
  });

  // Build the final notes
  const sections = [];
  Object.entries(grouped).forEach(([title, items]) => {
    if (items.length > 0) {
      sections.push(`\n### ${title}\n`);
      sections.push(...items);
    }
  });

  return sections.join('\n') + '\n';
}

async function generateWithGemini(prompt, apiKey) {
  // Gemini 1.5 Flash REST API
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 4096,
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts) && parts.length ? parts.map(p => p?.text || '').join('\n') : '';
  return text.trim();
}

async function main() {
  const version = getVersion();
  const tag = version.startsWith('v') ? version : `v${version}`;
  const prevTag = getPrevTag(tag);
  const commitLog = getCommitRange(prevTag);

  const prompt = [
    `You are an expert release notes writer for a developer tool web application (Zentrio).`,
    `Write comprehensive, well-structured GitHub release notes in Markdown for version ${tag}.`,
    prevTag ? `Changes since ${prevTag}.` : `This is the first release.`,
    ``,
    `Inputs:`,
    `- Version: ${tag}`,
    prevTag ? `- Previous tag: ${prevTag}` : `- Previous tag: (none)`,
    `- Commits (tab-separated: hash, date, subject, body):`,
    commitLog || '(no commits detected)',
    ``,
    `Guidelines:`,
    `- Include a brief summary paragraph at the start.`,
    `- Group changes into logical sections: Features, Bug Fixes, Improvements, Documentation, Configuration, etc.`,
    `- Process ALL commits provided - don't skip any important changes.`,
    `- Use commit bodies for additional context when available.`,
    `- Use bullet points for individual changes.`,
    `- Include commit hashes and dates for reference.`,
    `- Keep it concise but comprehensive - aim for quality over brevity.`,
    `- Do not invent changes. Base content strictly on provided commits.`,
    `- Do not include a top-level title or heading; the GitHub release title already includes the version.`,
    `- Take your time to analyze each commit properly.`,
  ].join('\n');

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  let notes = '';

  if (apiKey) {
    try {
      const ai = await generateWithGemini(prompt, apiKey);
      notes = ai && ai.length > 20 ? ai : '';
    } catch (e) {
      // Fallback to basic notes if AI fails
      notes = '';
    }
  }

  if (!notes) {
    notes = basicMarkdownNotes(version, prevTag, commitLog);
  }
  // Remove redundant top-level title; GitHub release already has one
  notes = notes.replace(/^\s*#{1,6}\s.*\r?\n+/, '').trimStart();

  const disclaimer = "\n\n> Notice: This project is developed with AI-assisted tooling. While maintained with care, releases may contain instabilities or security vulnerabilities; use at your own risk.";
writeFileSync('RELEASE_NOTES.md', notes + disclaimer, 'utf8');
  // Emit a small marker file if AI was used
  if (apiKey) {
    writeFileSync('.release_notes_ai.txt', 'gemini', 'utf8');
  }
  console.log('Release notes written to RELEASE_NOTES.md');
}

main().catch(err => {
  console.error(err);
  // Still write a minimal fallback to avoid failing the workflow
  try {
    const v = getVersion();
    const disclaimer = "\n\n> Notice: This project is developed with AI-assisted tooling. While maintained with care, releases may contain instabilities or security vulnerabilities; use at your own risk.";
writeFileSync('RELEASE_NOTES.md', `- Automated release notes generation failed. See commit history for details.\n` + disclaimer, 'utf8');
  } catch {}
  process.exit(0);
});