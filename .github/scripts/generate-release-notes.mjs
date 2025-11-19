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
  sections.push('🙏 **Thank you for using Zentrio!** Your continued support and feedback help us improve every day. If you encounter any issues or have suggestions, please don\'t hesitate to reach out.\n');

  return sections.join('\n');
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
    `Write engaging, comprehensive, and user-friendly GitHub release notes in Markdown for version ${tag}.`,
    prevTag ? `This release includes changes since ${prevTag}.` : `This is the first release of Zentrio!`,
    ``,
    `Inputs:`,
    `- Version: ${tag}`,
    prevTag ? `- Previous tag: ${prevTag}` : `- Previous tag: (none)`,
    `- Commits (tab-separated: hash, date, subject, body):`,
    commitLog || '(no commits detected)',
    ``,
    `Guidelines:`,
    `- Start with an engaging summary paragraph that highlights the most important changes`,
    `- Group changes into logical sections with emoji headers: 🚀 Features, 🐛 Bug Fixes, 💄 Improvements, 📝 Documentation, 🔧 Configuration, ⚙️ Chore`,
    `- Process ALL commits provided - every commit deserves attention`,
    `- Use commit bodies for additional context and technical details`,
    `- Write descriptive, user-friendly bullet points that explain the benefit of each change`,
    `- Include commit hashes and dates at the end of each bullet point for reference`,
    `- Use formatting like **bold** for emphasis and \`code\` for technical terms`,
    `- Add emojis and personality to make it more engaging`,
    `- If there are many similar commits, group them into a single meaningful point`,
    `- End with a friendly closing statement`,
    `- Do not invent changes - base everything strictly on provided commits`,
    `- Do not include a top-level title; the GitHub release title already includes the version`,
    `- Make it sound like it was written by a human who cares about the users`,
    `- Take your time to analyze each commit and understand its impact`,
  ].join('\n');

  const apiKeySource =
    process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY' :
    (process.env.GOOGLE_API_KEY ? 'GOOGLE_API_KEY' : '');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  let notes = '';
  let usedAi = false;

  if (apiKey) {
    console.log(`[release-notes] Using Gemini via ${apiKeySource}`);
    try {
      const ai = await generateWithGemini(prompt, apiKey);
      if (ai && ai.length > 20) {
        notes = ai.trim();
        usedAi = true;
      } else {
        console.log('[release-notes] Gemini returned empty or too-short output, falling back to conventional notes.');
      }
    } catch (e) {
      console.error('[release-notes] Gemini API call failed, falling back to conventional notes:', e?.message || e);
    }
  } else {
    console.log('[release-notes] No Gemini API key found (GEMINI_API_KEY / GOOGLE_API_KEY), using conventional notes.');
  }

  if (!notes) {
    notes = basicMarkdownNotes(version, prevTag, commitLog);
  }
  // Remove redundant top-level title; GitHub release already has one
  notes = notes.replace(/^\s*#{1,6}\s.*\r?\n+/, '').trimStart();

  const disclaimer = "\n\n> Notice: This project is developed with AI-assisted tooling. While maintained with care, releases may contain instabilities or security vulnerabilities; use at your own risk.";
  writeFileSync('RELEASE_NOTES.md', notes + disclaimer, 'utf8');
  // Emit a small marker file if AI was actually used
  if (usedAi) {
    writeFileSync('.release_notes_ai.txt', apiKeySource.toLowerCase() || 'gemini', 'utf8');
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