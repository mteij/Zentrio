
import { StreamProcessor } from './app/src/services/addons/stream-processor';
import { Stream, Manifest } from './app/src/services/addons/types';

// Mock config
const config = {
  filters: {
    cache: { cached: false, uncached: false, applyMode: 'OR' },
    resolution: {},
    encode: {},
    streamType: {},
    visualTag: {},
    audioTag: {},
    audioChannel: {},
    language: {},
    seeders: {},
    matching: { title: { enabled: false, mode: 'Exact' }, seasonEpisode: { enabled: false } },
    keyword: {},
    regex: {},
    size: {}
  },
  limits: {},
  deduplication: { mode: 'Single Result', detection: { filename: false, infoHash: false, smartDetect: false } },
  sorting: {}
};

// @ts-ignore
const processor = new StreamProcessor(config);

const testCases = [
  // Previous cases
  { title: "Movie.Title.2024.1080p.WEBRip.DDP5.1.x264-Group", expected: ['eac3', '5.1'] },
  { title: "Movie.Title.2024.1080p.BluRay.DTS-HD.MA.5.1.x264-Group", expected: ['dts', '5.1'] },
  { title: "Movie.Title.2024.1080p.BluRay.TrueHD.7.1.Atmos-Group", expected: ['truehd', 'atmos', '7.1'] },
  { title: "Some.Movie.AAC.2.0.x264", expected: ['aac', '2.0'] },
  { title: "Isaac.Newton.Documentary.1080p", expected: [] },
  { title: "Bad.Batch.S01E01.DDP.5.1.Atmos", expected: ['eac3', 'atmos', '5.1'] },
  
  // New variations that were failing or important
  { title: "Movie.With.AC-3.Sound", expected: ['ac3'] },
  { title: "Movie.With.DD.5.1", expected: ['ac3', '5.1'] },
  { title: "Movie.With.DD+.5.1", expected: ['eac3', '5.1'] },
  { title: "Movie.With.EAC-3.5.1", expected: ['eac3', '5.1'] },
  { title: "Movie.With.EAC3.5.1", expected: ['eac3', '5.1'] },
  { title: "Movie.With.DTSHD.MA.5.1", expected: ['dts', '5.1'] },
  
  // Boundaries checks (should NOT match)
  { title: "Movie.Version.5.1.2.Update", expected: [] }, // "5.1.2" might trigger 5.1 if not careful? regex \b5.1\b should avoid this if dot is boundary? dot is not boundary.
  
  // Actually \b5.1\b matches "Version 5.1" but maybe not "5.1.2"?
  // Let's test specific edge case
  { title: "Software.v5.1.2.zip", expected: [] }, 
  
  // False positive checks
  { title: "NOT_REAL_AAC_TEXT", expected: [] }, // "AAC" inside text without boundaries? regex \baac\b matches " AAC " or punct but not "TEXTAAC"
  { title: "DTS_SOUND_DEMO", expected: ['dts'] }, // Should match
  { title: "WORDS_WITH_AC3_INSIDE", expected: [] }, // "AC3" inside word
];

console.log("Running Stream Processor Audio Detection Tests...");

let failed = 0;

testCases.forEach(test => {
  // @ts-ignore
  const parsed = processor.parseStream({ title: test.title, name: test.title } as Stream, {} as Manifest);
  const detectedTags = parsed.parsed.audioTags || [];
  const detectedChannels = parsed.parsed.audioChannels || [];
  const allDetected = [...detectedTags, ...detectedChannels];
  
  const missing = test.expected.filter(e => !allDetected.includes(e));
  const unexpected = allDetected.filter(d => !test.expected.includes(d));
  
  // Basic check: we expect correct tags. Extra tags usually okay if they make sense, but for strict test let's warn.
  if (missing.length > 0) {
    console.log(`[FAIL] ${test.title}`);
    console.log(`   Missing: ${missing.join(', ')}`);
    console.log(`   Found: ${allDetected.join(', ')}`);
    failed++;
  } else if (unexpected.length > 0) {
     if (test.expected.length === 0 && unexpected.length > 0) {
        console.log(`[FAIL] ${test.title} (False Positive)`);
        console.log(`   Unexpected: ${unexpected.join(', ')}`);
        failed++;
     }
  }
});

if (failed > 0) {
    console.log(`\n${failed} tests failed.`);
    process.exit(1);
} else {
    console.log("\nAll tests passed!");
}
