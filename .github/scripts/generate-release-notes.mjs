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
  // Try to find the last GitHub release first (to skip intermediate docker tags)
  try {
    // We want the latest release that is NOT the current tag (in case it was already created)
    // Since this runs before release creation usually, the latest release is the previous one.
    const lastRelease = sh('gh release list --limit 1 --exclude-drafts --exclude-pre-releases --json tagName -q ".[0].tagName"', '');
    if (lastRelease && lastRelease !== currentTag) {
      console.log(`[release-notes] Found previous release tag via GitHub CLI: ${lastRelease}`);
      return lastRelease;
    }
  } catch (e) {
    console.log('[release-notes] Could not determine previous release via GitHub CLI, falling back to git tags.');
  }

  // Prefer semantic tags sorted descending, then pick the one after current in the list
  const tags = sh('git tag --list --sort=-version:refname', '').split('\n').map(s => s.trim()).filter(Boolean);
  const currentIndex = tags.findIndex(t => t === currentTag);
  if (currentIndex !== -1 && currentIndex < tags.length - 1) {
    return tags[currentIndex + 1];
  }

  // Fallback: try to find any tag that's not the current one
  const prev = tags.find(t => t !== currentTag);
  if (prev) return prev;

  // Final fallback to describe
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
    return [
      '🎉 **Welcome to the first release of Zentrio!**',
      '',
      'We\'re excited to launch Zentrio with this initial release that brings you a powerful and feature-rich experience. This version includes the core functionality and features we\'ve been working hard to build.',
      '',
      'Thank you for being part of our early community! Your feedback and support help us shape the future of Zentrio.',
      ''
    ].join('\n');
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

  // Count total changes
  const totalChanges = commits.length;
  const hasFeatures = grouped['🚀 Features'].length > 0;
  const hasFixes = grouped['🐛 Bug Fixes'].length > 0;

  // Build engaging summary
  let summary = `🎉 **What\'s new in version ${version}**\n\n`;
  
  if (hasFeatures && hasFixes) {
    summary += `This release brings **exciting new features** and **important bug fixes** to improve your Zentrio experience. We\'ve carefully reviewed and implemented ${totalChanges} changes based on your feedback and our ongoing commitment to excellence.\n\n`;
  } else if (hasFeatures) {
    summary += `This release introduces **exciting new features** to enhance your Zentrio experience! We\'ve added ${totalChanges} improvements to make the platform even more powerful and user-friendly.\n\n`;
  } else if (hasFixes) {
    summary += `This release focuses on **stability and reliability** with important bug fixes and optimizations. We've addressed ${totalChanges} issues to ensure a smoother experience.\n\n`;
  } else {
    summary += `This release includes ${totalChanges} improvements and optimizations to make Zentrio even better. We've been working hard to enhance the platform based on your feedback.\n\n`;
  }

  // Build the final notes
  const sections = [summary];
  Object.entries(grouped).forEach(([title, items]) => {
    if (items.length > 0) {
      sections.push(`\n### ${title}\n`);
      sections.push(...items);
    }
  });

  sections.push('\n---\n');
  sections.push('**Links:**\n- 🌐 [Public Instance](https://zentrio.eu)\n- 📚 [Documentation](https://docs.zentrio.eu)\n');
  sections.push('\n🙏 **Thank you for using Zentrio!**\n');

  return sections.join('\n');
}

async function generateWithNanoGPT(prompt, apiKey) {
  // NanoGPT OpenAI-compatible API with GLM 4.7
  const endpoint = 'https://nano-gpt.com/api/v1/chat/completions';
  const body = {
    model: 'zai-org/glm-5:thinking',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
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

async function main() {
  const version = getVersion();
  const tag = version.startsWith('v') ? version : `v${version}`;
  const prevTag = getPrevTag(tag);
  const commitLog = getCommitRange(prevTag);

  // Parse semantic version to determine release type
  const semverMatch = version.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  const [, major, minor, patch] = semverMatch || ['0', '0', '0'];
  const prevSemverMatch = (prevTag || '').replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  const [, prevMajor, prevMinor] = prevSemverMatch || ['0', '0', '0'];

  let releaseType = 'patch';
  let releaseContext = '';

  if (prevSemverMatch && parseInt(major) > parseInt(prevMajor)) {
    releaseType = 'major';
    releaseContext = `This is a **MAJOR** release (${prevTag} → ${tag}). Major releases introduce significant new features, architectural changes, or breaking changes. The tone should be celebratory and highlight the milestone nature of this release.`;
  } else if (prevSemverMatch && parseInt(minor) > parseInt(prevMinor)) {
    releaseType = 'minor';
    releaseContext = `This is a **MINOR** release (${prevTag} → ${tag}). Minor releases add new features and notable improvements while maintaining backward compatibility. Focus on new capabilities and enhancements.`;
  } else {
    releaseContext = `This is a **PATCH** release (${prevTag} → ${tag}). Patch releases focus on bug fixes, security patches, and small improvements. Keep the notes concise and focused on stability improvements.`;
  }

  const releaseGuidelines = {
    major: [
      `- Lead with an exciting, milestone-focused summary paragraph`,
      `- Highlight breaking changes prominently with a dedicated "⚠️ Breaking Changes" section if applicable`,
      `- Emphasize new major features with detailed explanations`,
      `- Include a brief "Upgrade Guide" section if there are breaking changes`,
      `- The tone should be celebratory but professional`,
    ],
    minor: [
      `- Lead with a clear summary of new features and improvements`,
      `- Focus on new capabilities and how they benefit users`,
      `- Group changes logically with clear section headers`,
      `- The tone should be informative and forward-looking`,
    ],
    patch: [
      `- Keep the notes brief and to the point`,
      `- Focus on what was fixed and improved`,
      `- Consolidate related fixes into single bullet points where sensible`,
      `- The tone should be straightforward and reassuring`,
    ],
  };

  const prompt = [
    `You are an expert release notes writer for Zentrio, a modern streaming media application.`,
    `Write clean, professional GitHub release notes in Markdown for version ${tag}.`,
    ``,
    releaseContext,
    ``,
    `Inputs:`,
    `- Version: ${tag}`,
    prevTag ? `- Previous version: ${prevTag}` : `- Previous version: (first release)`,
    `- Commits (hash, date, subject, body):`,
    commitLog || '(no commits)',
    ``,
    `Format Guidelines:`,
    ...releaseGuidelines[releaseType],
    ``,
    `General Rules:`,
    `- Use these sections as needed: 🚀 Features, 🐛 Bug Fixes, 💄 Improvements, 🔧 Maintenance`,
    `- Write clear, scannable bullet points`,
    `- Use \`code formatting\` for technical terms, file names, and commands`,
    `- Include commit hash references in parentheses at the end: (abc1234)`,
    `- Do NOT include a title - GitHub adds one automatically`,
    `- Do NOT invent changes - only document what's in the commits`,
    `- Be concise - quality over quantity`,
  ].join('\n');

  const apiKey = process.env.NANOGPT_API_KEY || '';
  let notes = '';
  let usedAi = false;

  if (apiKey) {
    console.log('[release-notes] Using NanoGPT with GLM 4.7');
    try {
      const ai = await generateWithNanoGPT(prompt, apiKey);
      if (ai && ai.length > 20) {
        notes = ai.trim();
        usedAi = true;
      } else {
        console.log('[release-notes] NanoGPT returned empty or too-short output, falling back to conventional notes.');
      }
    } catch (e) {
      console.error('[release-notes] NanoGPT API call failed, falling back to conventional notes:', e?.message || e);
    }
  } else {
    console.log('[release-notes] No NANOGPT_API_KEY found, using conventional notes.');
  }

  if (!notes) {
    notes = basicMarkdownNotes(version, prevTag, commitLog);
  }
  // Remove redundant top-level title; GitHub release already has one
  notes = notes.replace(/^\s*#{1,6}\s.*\r?\n+/, '').trimStart();

  const links = '\n\n---\n\n**Links:**\n- 🌐 [Public Instance](https://zentrio.eu)\n- 📚 [Documentation](https://docs.zentrio.eu)';
  const disclaimer = "\n\n> Notice: This project is developed with AI-assisted tooling. While maintained with care, releases may contain instabilities or security vulnerabilities; use at your own risk.";
  writeFileSync('RELEASE_NOTES.md', notes + links + disclaimer, 'utf8');
  // Emit a small marker file if AI was actually used

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