#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');

const {
  GENERATED_CLIP_DIR,
  inspectClipperEnvironment,
  listClipRuns,
  loadClipRunManifest,
  loadSegmentsFromFile,
  parseSegmentSpec,
  parseTimestamp,
  probeMedia,
  publishExistingClipRun,
  runClipPipeline,
} = require('../services/videoClipper');

const { DEFAULT_CONFIG_PATH, DEFAULT_PLATFORMS, parsePlatforms } = require('../services/socialAutomation');

function parseArgs(argv) {
  const args = { positionals: [], flags: {} };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      args.positionals.push(token);
      continue;
    }

    if (token.includes('=')) {
      const [key, ...rest] = token.slice(2).split('=');
      args.flags[key] = rest.join('=');
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.flags[key] = true;
      continue;
    }

    args.flags[key] = next;
    index += 1;
  }

  return args;
}

function boolFlag(value) {
  return value === true || value === 'true' || value === '1';
}

function resolveBaseDir(flags) {
  return flags['base-dir'] || GENERATED_CLIP_DIR;
}

function printHelp() {
  console.log(`AIWholesail Clipping CLI

Usage:
  node aiwholesail-api/bin/aiwholesail-clip.js <command> [flags]

Commands:
  help                Show this help text
  doctor              Check ffmpeg / publish env
  probe               Print ffprobe info for a source file
  make                Clip a source into one or more shorts
  runs                List clip runs
  show                Show a clip run manifest
  publish             Publish an existing clip run

Make examples:
  # Single clip 0:00 - 0:30 from a recording, vertical 9:16, no publish
  aiwholesail-clip make --source ./demo.mp4 --start 0:00 --end 0:30

  # Multiple clips in one pass
  aiwholesail-clip make --source ./demo.mp4 \\
    --segments "0:00-0:25,1:10-1:38,2:42-3:08" --aspect vertical

  # Clips from a JSON spec file (array of {start,end,label?,caption?})
  aiwholesail-clip make --source ./demo.mp4 --segments-file ./clips.json

  # Tag with a campaign topic so caption / hashtags / YT title come from config
  aiwholesail-clip make --source ./demo.mp4 --start 0:00 --end 0:30 \\
    --topic instant-deal-alerts --publish

  # Override caption (burned into video AND used as social caption fallback)
  aiwholesail-clip make --source ./demo.mp4 --start 0:00 --end 0:30 \\
    --caption "Stop comping deals by hand."

Publish:
  aiwholesail-clip publish --run 20260505-203011-demo-1 --platforms youtube,tiktok
  aiwholesail-clip publish --run <runId> --dry-run

Common flags:
  --source <path>          Source media file (required for make)
  --start, --end <ts>      Single segment timestamps (mm:ss, hh:mm:ss, or seconds)
  --segments "a-b,c-d"     Comma-separated start-end pairs
  --segments-file <path>   JSON file with segment objects
  --aspect <preset>        vertical (default) | square | horizontal | source
  --caption <text>         Burn caption + use as social caption fallback
  --hashtags "#a,#b"       Override hashtags
  --topic <slug>           Pull copy from social-short-campaign.json
  --config <path>          Campaign config file (default: ${path.relative(process.cwd(), DEFAULT_CONFIG_PATH)})
  --platforms a,b,c        Limit publish to subset (default: ${DEFAULT_PLATFORMS.join(',')})
  --publish                Push results to platforms
  --dry-run                Run publish flow without uploading
  --skip-render            Generate manifest only (cannot publish)
  --base-dir <path>        Override generated-clips dir
  --json                   Emit JSON output
`);
}

function printResults(results) {
  Object.entries(results || {}).forEach(([name, result]) => {
    console.log(`  - ${name}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
  });
}

function resolveSegments(flags) {
  if (flags['segments-file']) {
    return loadSegmentsFromFile(path.resolve(String(flags['segments-file'])));
  }
  if (flags.segments) {
    return parseSegmentSpec(String(flags.segments));
  }
  if (flags.start != null && flags.end != null) {
    const start = parseTimestamp(flags.start);
    const end = parseTimestamp(flags.end);
    if (end <= start) throw new Error('--end must be greater than --start.');
    return [{ start, end, duration: end - start }];
  }
  throw new Error('Provide --start/--end, --segments, or --segments-file.');
}

function parseHashtags(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveConfigPath(flags) {
  if (flags.config === false || flags.config === 'false') return null;
  if (flags.config === true) return DEFAULT_CONFIG_PATH;
  if (typeof flags.config === 'string') return path.resolve(flags.config);
  if (flags.topic) return DEFAULT_CONFIG_PATH;
  return null;
}

async function handleDoctor(parsed) {
  const checks = inspectClipperEnvironment();
  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({ checks }, null, 2));
    return;
  }
  checks.forEach((check) => {
    console.log(`${check.ok ? 'OK  ' : 'FAIL'} ${check.name}: ${check.detail}`);
  });
}

async function handleProbe(parsed) {
  const source = parsed.flags.source || parsed.positionals[1];
  if (!source) throw new Error('probe requires --source <path>.');
  const info = probeMedia(path.resolve(String(source)));
  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({ source, info }, null, 2));
    return;
  }
  console.log(`Source: ${source}`);
  console.log(`  Duration: ${info.durationSeconds.toFixed(2)}s`);
  console.log(`  Resolution: ${info.width || '?'}x${info.height || '?'}`);
  console.log(`  Video codec: ${info.videoCodec || 'n/a'}`);
  console.log(`  Audio codec: ${info.audioCodec || 'n/a'}`);
  console.log(`  Size: ${(info.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
}

async function handleMake(parsed) {
  const source = parsed.flags.source;
  if (!source) throw new Error('make requires --source <path>.');

  const segments = resolveSegments(parsed.flags);
  const result = await runClipPipeline({
    source: path.resolve(String(source)),
    segments,
    aspect: parsed.flags.aspect ? String(parsed.flags.aspect) : 'vertical',
    caption: parsed.flags.caption ? String(parsed.flags.caption) : null,
    hashtags: parseHashtags(parsed.flags.hashtags),
    configPath: resolveConfigPath(parsed.flags),
    topicSlug: parsed.flags.topic ? String(parsed.flags.topic) : null,
    publish: boolFlag(parsed.flags.publish),
    dryRun: boolFlag(parsed.flags['dry-run']),
    skipRender: boolFlag(parsed.flags['skip-render']),
    burnCaption: parsed.flags['burn-caption'] === 'false' || parsed.flags['burn-caption'] === false ? false : true,
    platforms: parsePlatforms(parsed.flags.platforms, DEFAULT_PLATFORMS),
    runIdPrefix: parsed.flags['run-prefix'] ? String(parsed.flags['run-prefix']) : null,
    baseDir: resolveBaseDir(parsed.flags),
  });

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({
      runs: result.runs.map((run) => ({
        runId: run.runId,
        manifest: run.manifest,
      })),
    }, null, 2));
    return;
  }

  console.log(`\n=== AIWholesail Clip: ${result.runs.length} clip(s) ===`);
  result.runs.forEach((run) => {
    const segment = run.manifest.segment;
    console.log(`\n${run.runId}`);
    console.log(`  Segment: ${segment.startTimecode} → ${segment.endTimecode} (${segment.duration.toFixed(2)}s)`);
    if (run.manifest.assets.videoPath) {
      console.log(`  Video:   ${run.manifest.assets.videoPath}`);
    } else {
      console.log('  Video:   skipped');
    }
    if (run.manifest.assets.publicVideoUrl) {
      console.log(`  Public:  ${run.manifest.assets.publicVideoUrl}`);
    }
    console.log('  Publish:');
    printResults(run.manifest.publishResults);
  });
}

async function handleRuns(parsed) {
  const runs = listClipRuns(resolveBaseDir(parsed.flags));
  const limit = parsed.flags.limit ? Number(parsed.flags.limit) : null;
  const selected = Number.isFinite(limit) && limit > 0 ? runs.slice(0, limit) : runs;

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({
      runs: selected.map((run) => ({
        runId: run.runId,
        runDir: run.runDir,
        manifest: run.manifest,
      })),
    }, null, 2));
    return;
  }

  if (selected.length === 0) {
    console.log('No clip runs found.');
    return;
  }

  selected.forEach((run) => {
    const manifest = run.manifest || {};
    const seg = manifest.segment || {};
    const statuses = Object.entries(manifest.publishResults || {})
      .map(([name, result]) => `${name}:${result.status}`)
      .join(', ');

    console.log(run.runId);
    console.log(`  Source:    ${manifest.sourcePath || 'unknown'}`);
    console.log(`  Segment:   ${seg.startTimecode || '?'} → ${seg.endTimecode || '?'} (${(seg.duration || 0).toFixed(2)}s)`);
    console.log(`  Generated: ${manifest.generatedAt || 'unknown'}`);
    console.log(`  Statuses:  ${statuses || 'none'}`);
  });
}

async function handleShow(parsed) {
  const runId = parsed.flags.run || parsed.positionals[1];
  if (!runId) throw new Error('show requires --run <runId>.');
  const { paths, manifest } = loadClipRunManifest(runId, resolveBaseDir(parsed.flags));

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({ paths, manifest }, null, 2));
    return;
  }

  console.log(`Run: ${manifest.runId}`);
  console.log(`  Source:   ${manifest.sourcePath}`);
  if (manifest.segment) {
    console.log(`  Segment:  ${manifest.segment.startTimecode} → ${manifest.segment.endTimecode} (${manifest.segment.duration.toFixed(2)}s)`);
  }
  console.log(`  Aspect:   ${manifest.aspect}`);
  console.log(`  Theme:    ${manifest.theme}`);
  console.log(`  Manifest: ${paths.manifestPath}`);
  if (manifest.assets?.videoPath) console.log(`  Video:    ${manifest.assets.videoPath}`);
  if (manifest.assets?.publicVideoUrl) console.log(`  Public:   ${manifest.assets.publicVideoUrl}`);
  console.log('  Publish:');
  printResults(manifest.publishResults);
}

async function handlePublish(parsed) {
  const runId = parsed.flags.run || parsed.positionals[1];
  if (!runId) throw new Error('publish requires --run <runId>.');

  const result = await publishExistingClipRun({
    runId,
    platforms: parsePlatforms(parsed.flags.platforms, DEFAULT_PLATFORMS),
    dryRun: boolFlag(parsed.flags['dry-run']),
    baseDir: resolveBaseDir(parsed.flags),
  });

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({
      runId,
      paths: result.paths,
      manifest: result.manifest,
    }, null, 2));
    return;
  }

  console.log(`Published clip run: ${runId}`);
  console.log('Results:');
  printResults(result.manifest.publishResults);
}

async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  const command = parsed.positionals[0] || 'help';

  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;
    case 'doctor':
      await handleDoctor(parsed);
      return;
    case 'probe':
      await handleProbe(parsed);
      return;
    case 'make':
      await handleMake(parsed);
      return;
    case 'runs':
      await handleRuns(parsed);
      return;
    case 'show':
      await handleShow(parsed);
      return;
    case 'publish':
      await handlePublish(parsed);
      return;
    default:
      throw new Error(`Unknown command "${command}". Run "help" for usage.`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\n[aiwholesail-clip] ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main };
