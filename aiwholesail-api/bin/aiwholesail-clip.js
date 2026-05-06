#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');

const {
  GENERATED_CLIP_DIR,
  extractThumbnail,
  fetchSource,
  formatTimestamp,
  inspectClipperEnvironment,
  listClipRuns,
  loadClipRunManifest,
  loadSegmentsFromFile,
  parseSegmentSpec,
  parseTimestamp,
  probeMedia,
  publishExistingClipRun,
  runClipPipeline,
  suggestClipsFromTranscript,
  transcribeAudio,
} = require('../services/videoClipper');

const { DEFAULT_CONFIG_PATH, DEFAULT_PLATFORMS, loadCampaignConfig, parsePlatforms, pickTopic } = require('../services/socialAutomation');

const { proposeSegmentsFromSilence } = require('../services/silenceDetect');

const {
  enqueue: enqueueClip,
  listQueue,
  removeFromQueue,
  processDueItems,
} = require('../services/clipScheduler');

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
  doctor              Check ffmpeg / yt-dlp / publish env
  fetch               Download a source from a URL via yt-dlp
  probe               Print ffprobe info for a source file
  transcribe          Generate an SRT from a source via OpenAI Whisper
  suggest             Propose clip segments from a transcript via GPT
  silence-suggest     Propose clip segments from audio silence (no API)
  queue add           Enqueue an existing run for deferred publish
  queue list          List queued items (optionally --status pending)
  queue remove        Remove an item by --id
  queue run           Process due items once (worker is in scripts/)
  make                Clip a source into one or more shorts
  thumbnail           Extract a single frame as a YT/IG cover image
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

  # Brand with logo watermark + master-transcript subtitles
  aiwholesail-clip make --source ./demo.mp4 --start 1:30 --end 2:00 \\
    --watermark ./public/logos/aiw-mark.png --watermark-position bottom-right \\
    --subtitles ./demo.srt

End-to-end auto pipeline:
  # 1. Transcribe a long-form recording
  aiwholesail-clip transcribe --source ./webinar.mp4 --out ./webinar.srt

  # 2. Get GPT to propose clip segments + captions
  aiwholesail-clip suggest --srt ./webinar.srt --topic instant-deal-alerts \\
    --count 3 --out ./suggestions.json

  # 3. Cut and publish
  aiwholesail-clip make --source ./webinar.mp4 \\
    --segments-file ./suggestions.json --subtitles ./webinar.srt \\
    --watermark ./public/logo-white.png --topic instant-deal-alerts --publish

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
  --burn-caption=false     Skip burn-in (caption still flows to social copy)
  --watermark <path>       PNG/SVG/JPG to overlay (logo)
  --watermark-position     bottom-right (default) | bottom-left | top-right |
                           top-left | top-center | bottom-center | center
  --watermark-opacity      0–1 (default 0.85)
  --watermark-scale        Logo width as fraction of video width (default 0.18)
  --subtitles <path.srt>   Burn subtitles; cues are auto-shifted to clip start
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

async function handleQueue(parsed) {
  const sub = parsed.positionals[1] || 'list';
  const baseDir = resolveBaseDir(parsed.flags);

  if (sub === 'add') {
    const runId = parsed.flags.run || parsed.positionals[2];
    if (!runId) throw new Error('queue add requires --run <runId>.');
    const item = enqueueClip({
      runId,
      scheduledFor: parsed.flags.at ? String(parsed.flags.at) : null,
      platforms: parsePlatforms(parsed.flags.platforms, DEFAULT_PLATFORMS),
      baseDir,
    });
    if (boolFlag(parsed.flags.json)) {
      console.log(JSON.stringify(item, null, 2));
    } else {
      console.log(`Queued ${item.runId} for ${item.scheduledFor} (id ${item.id})`);
    }
    return;
  }

  if (sub === 'list') {
    const items = listQueue({
      baseDir,
      status: parsed.flags.status ? String(parsed.flags.status) : null,
    });
    if (boolFlag(parsed.flags.json)) {
      console.log(JSON.stringify({ items }, null, 2));
      return;
    }
    if (items.length === 0) {
      console.log('Queue is empty.');
      return;
    }
    items.forEach((item) => {
      const platforms = (item.platforms || []).join(',') || '(default)';
      console.log(`${item.id}`);
      console.log(`  Run:        ${item.runId}`);
      console.log(`  When:       ${item.scheduledFor}`);
      console.log(`  Platforms:  ${platforms}`);
      console.log(`  Status:     ${item.status}${item.error ? ` (${item.error})` : ''}`);
    });
    return;
  }

  if (sub === 'remove') {
    const id = parsed.flags.id || parsed.positionals[2];
    if (!id) throw new Error('queue remove requires --id <id>.');
    const removed = removeFromQueue(id, baseDir);
    console.log(removed ? `Removed ${id}` : `No item with id ${id}`);
    return;
  }

  if (sub === 'run') {
    const results = await processDueItems({
      baseDir,
      dryRun: boolFlag(parsed.flags['dry-run']),
      max: parsed.flags.max != null ? Number(parsed.flags.max) : 25,
    });
    if (boolFlag(parsed.flags.json)) {
      console.log(JSON.stringify({ results }, null, 2));
      return;
    }
    if (results.length === 0) {
      console.log('No due items.');
      return;
    }
    results.forEach((entry) => {
      console.log(`${entry.runId} -> ${entry.status}${entry.error ? ` (${entry.error})` : ''}`);
    });
    return;
  }

  throw new Error(`Unknown queue subcommand "${sub}". Use add, list, remove, or run.`);
}

async function handleSilenceSuggest(parsed) {
  const source = parsed.flags.source || parsed.positionals[1];
  if (!source) throw new Error('silence-suggest requires --source <path>.');

  const segments = await proposeSegmentsFromSilence(path.resolve(String(source)), {
    noiseDb: parsed.flags['noise-db'] != null ? Number(parsed.flags['noise-db']) : -30,
    minSilenceSeconds: parsed.flags['min-silence'] != null ? Number(parsed.flags['min-silence']) : 0.6,
    minClipSeconds: parsed.flags['min-duration'] != null ? Number(parsed.flags['min-duration']) : 12,
    maxClipSeconds: parsed.flags['max-duration'] != null ? Number(parsed.flags['max-duration']) : 60,
    targetSeconds: parsed.flags['target-duration'] != null ? Number(parsed.flags['target-duration']) : 28,
    maxClips: parsed.flags['max-clips'] != null ? Number(parsed.flags['max-clips']) : 5,
    labelPrefix: parsed.flags['label-prefix'] ? String(parsed.flags['label-prefix']) : 'silent-cut',
  });

  const serializable = segments.map((entry) => ({
    label: entry.label,
    start: formatTimestamp(entry.start),
    end: formatTimestamp(entry.end),
    duration: entry.duration,
  }));

  if (parsed.flags.out) {
    fs.writeFileSync(path.resolve(String(parsed.flags.out)), JSON.stringify({ segments: serializable }, null, 2));
    if (!boolFlag(parsed.flags.json)) {
      console.log(`Suggestions written: ${path.resolve(String(parsed.flags.out))}`);
    }
  }

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({ segments: serializable }, null, 2));
    return;
  }

  if (!parsed.flags.out) {
    console.log(`\n=== ${serializable.length} silence-cut segment(s) ===`);
    serializable.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.label}  ${entry.start} → ${entry.end}  (${entry.duration.toFixed(1)}s)`);
    });
  }
}

async function handleFetch(parsed) {
  const url = parsed.flags.url || parsed.positionals[1];
  if (!url) throw new Error('fetch requires --url <url>.');

  const result = await fetchSource({
    url: String(url),
    outputPath: parsed.flags.out ? String(parsed.flags.out) : null,
    audioOnly: boolFlag(parsed.flags['audio-only']),
    maxHeight: parsed.flags['max-height'] != null ? Number(parsed.flags['max-height']) : null,
    format: parsed.flags.format ? String(parsed.flags.format) : null,
    cookiesFile: parsed.flags.cookies ? String(parsed.flags.cookies) : null,
  });

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Downloaded: ${result.downloadedPath}`);
}

async function handleThumbnail(parsed) {
  const source = parsed.flags.source || parsed.positionals[1];
  if (!source) throw new Error('thumbnail requires --source <path>.');

  const result = await extractThumbnail({
    source: path.resolve(String(source)),
    timestamp: parsed.flags.at != null ? parsed.flags.at : (parsed.flags.timestamp != null ? parsed.flags.timestamp : 0),
    outputPath: parsed.flags.out ? path.resolve(String(parsed.flags.out)) : null,
    watermark: parsed.flags.watermark ? String(parsed.flags.watermark) : null,
    watermarkPosition: parsed.flags['watermark-position'] ? String(parsed.flags['watermark-position']) : undefined,
    watermarkOpacity: parsed.flags['watermark-opacity'] != null ? Number(parsed.flags['watermark-opacity']) : undefined,
    watermarkScale: parsed.flags['watermark-scale'] != null ? Number(parsed.flags['watermark-scale']) : undefined,
    hook: parsed.flags.hook ? String(parsed.flags.hook) : null,
  });

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Thumbnail: ${result.thumbnailPath}  (frame at ${formatTimestamp(result.timestamp)})`);
}

async function handleTranscribe(parsed) {
  const source = parsed.flags.source || parsed.positionals[1];
  if (!source) throw new Error('transcribe requires --source <path>.');

  const result = await transcribeAudio({
    source: path.resolve(String(source)),
    outputPath: parsed.flags.out ? path.resolve(String(parsed.flags.out)) : null,
    language: parsed.flags.language ? String(parsed.flags.language) : null,
    model: parsed.flags.model ? String(parsed.flags.model) : null,
    prompt: parsed.flags.prompt ? String(parsed.flags.prompt) : null,
  });

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({ srtPath: result.srtPath }, null, 2));
    return;
  }

  console.log(`Transcript written: ${result.srtPath}`);
}

async function handleSuggest(parsed) {
  const srt = parsed.flags.srt || parsed.flags.subtitles;
  if (!srt) throw new Error('suggest requires --srt <path>.');

  const configPath = resolveConfigPath(parsed.flags);
  let config = {};
  let topic = null;
  if (configPath) {
    const loaded = loadCampaignConfig(configPath);
    config = loaded.config;
    if (parsed.flags.topic) {
      topic = pickTopic(config, String(parsed.flags.topic));
    }
  }

  const count = parsed.flags.count != null ? Number(parsed.flags.count) : 3;
  const minDuration = parsed.flags['min-duration'] != null ? Number(parsed.flags['min-duration']) : 18;
  const maxDuration = parsed.flags['max-duration'] != null ? Number(parsed.flags['max-duration']) : 35;

  const suggestions = await suggestClipsFromTranscript({
    srtPath: path.resolve(String(srt)),
    config,
    topic,
    count,
    durationRange: [minDuration, maxDuration],
    model: parsed.flags.model ? String(parsed.flags.model) : null,
  });

  const serializable = suggestions.map((entry) => ({
    label: entry.label,
    start: formatTimestamp(entry.start),
    end: formatTimestamp(entry.end),
    duration: entry.duration,
    caption: entry.caption,
    hook: entry.hook,
    reason: entry.reason,
  }));

  if (parsed.flags.out) {
    const outPath = path.resolve(String(parsed.flags.out));
    fs.writeFileSync(outPath, JSON.stringify({ segments: serializable }, null, 2));
    if (!boolFlag(parsed.flags.json)) {
      console.log(`Suggestions written: ${outPath}`);
    }
  }

  if (boolFlag(parsed.flags.json)) {
    console.log(JSON.stringify({ segments: serializable }, null, 2));
    return;
  }

  if (!parsed.flags.out) {
    console.log(`\n=== ${serializable.length} clip suggestion(s) ===`);
    serializable.forEach((entry, index) => {
      console.log(`\n${index + 1}. ${entry.label}  (${entry.start} → ${entry.end}, ${entry.duration.toFixed(1)}s)`);
      if (entry.hook) console.log(`   Hook:    ${entry.hook}`);
      if (entry.caption) console.log(`   Caption: ${entry.caption}`);
      if (entry.reason) console.log(`   Why:     ${entry.reason}`);
    });
  }
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
    watermark: parsed.flags.watermark ? String(parsed.flags.watermark) : null,
    watermarkPosition: parsed.flags['watermark-position'] ? String(parsed.flags['watermark-position']) : undefined,
    watermarkOpacity: parsed.flags['watermark-opacity'] != null ? Number(parsed.flags['watermark-opacity']) : undefined,
    watermarkScale: parsed.flags['watermark-scale'] != null ? Number(parsed.flags['watermark-scale']) : undefined,
    subtitlesPath: parsed.flags.subtitles ? path.resolve(String(parsed.flags.subtitles)) : null,
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
    case 'fetch':
      await handleFetch(parsed);
      return;
    case 'silence-suggest':
      await handleSilenceSuggest(parsed);
      return;
    case 'queue':
      await handleQueue(parsed);
      return;
    case 'thumbnail':
      await handleThumbnail(parsed);
      return;
    case 'transcribe':
      await handleTranscribe(parsed);
      return;
    case 'suggest':
      await handleSuggest(parsed);
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
