const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

const {
  DEFAULT_PLATFORMS,
  buildPublicVideoUrl,
  loadCampaignConfig,
  parsePlatforms,
  pickTopic,
  publishToPlatforms,
  readJson,
  writeJson,
  ensureDir,
} = require('./socialAutomation');

const API_DIR = path.join(__dirname, '..');
const GENERATED_CLIP_DIR = path.join(API_DIR, 'generated-clips');

const ASPECT_PRESETS = {
  vertical: { width: 1080, height: 1920, label: '9:16' },
  square: { width: 1080, height: 1080, label: '1:1' },
  horizontal: { width: 1920, height: 1080, label: '16:9' },
  source: null,
};

const RUN_FILES = {
  manifest: 'manifest.json',
  brief: 'brief.json',
  source: 'source-info.json',
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function parseTimestamp(input) {
  if (input == null || input === '') return null;
  if (typeof input === 'number' && Number.isFinite(input)) return Math.max(0, input);

  const raw = String(input).trim();
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (/^\d+(\.\d+)?s$/i.test(raw)) return Number(raw.slice(0, -1));
  if (/^\d+(\.\d+)?m$/i.test(raw)) return Number(raw.slice(0, -1)) * 60;

  const parts = raw.split(':');
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`Invalid timestamp "${input}". Use seconds, "mm:ss", or "hh:mm:ss".`);
  }

  const numbers = parts.map((part) => {
    const value = Number(part);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid timestamp "${input}".`);
    }
    return value;
  });

  if (numbers.length === 2) return numbers[0] * 60 + numbers[1];
  return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
}

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.round(seconds * 1000) / 1000);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total - hh * 3600 - mm * 60;
  const ssStr = ss.toFixed(3).padStart(6, '0');
  if (hh > 0) {
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${ssStr}`;
  }
  return `${String(mm).padStart(2, '0')}:${ssStr}`;
}

function parseSegmentSpec(spec) {
  if (!spec) return [];
  const items = Array.isArray(spec) ? spec : String(spec).split(',');
  return items
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item, index) => {
      const [start, end] = item.split('-').map((part) => part && part.trim());
      if (!start || !end) {
        throw new Error(`Invalid segment "${item}". Use "start-end" e.g. "0:00-0:30".`);
      }
      const startSec = parseTimestamp(start);
      const endSec = parseTimestamp(end);
      if (endSec <= startSec) {
        throw new Error(`Segment ${index + 1} end must be greater than start.`);
      }
      return { start: startSec, end: endSec, duration: endSec - startSec };
    });
}

function loadSegmentsFromFile(filePath) {
  const data = readJson(filePath);
  const list = Array.isArray(data) ? data : data.segments;
  if (!Array.isArray(list)) {
    throw new Error(`Segments file "${filePath}" must be an array or contain a "segments" array.`);
  }
  return list.map((entry, index) => {
    const startSec = parseTimestamp(entry.start);
    const endSec = parseTimestamp(entry.end);
    if (endSec <= startSec) {
      throw new Error(`Segment ${index + 1} end must be greater than start.`);
    }
    return {
      start: startSec,
      end: endSec,
      duration: endSec - startSec,
      label: entry.label || entry.title || null,
      caption: entry.caption || null,
    };
  });
}

function probeMedia(filePath) {
  const args = [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ];

  let raw;
  try {
    raw = execFileSync('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (error) {
    throw new Error(`ffprobe failed for "${filePath}": ${error.stderr ? error.stderr.toString() : error.message}`);
  }

  const parsed = JSON.parse(raw);
  const videoStream = (parsed.streams || []).find((stream) => stream.codec_type === 'video');
  const audioStream = (parsed.streams || []).find((stream) => stream.codec_type === 'audio');

  return {
    durationSeconds: Number(parsed.format?.duration) || 0,
    width: videoStream ? Number(videoStream.width) : null,
    height: videoStream ? Number(videoStream.height) : null,
    videoCodec: videoStream?.codec_name || null,
    audioCodec: audioStream?.codec_name || null,
    sizeBytes: Number(parsed.format?.size) || 0,
  };
}

function buildAspectFilter(presetKey) {
  if (!presetKey || presetKey === 'source') return null;
  const preset = ASPECT_PRESETS[presetKey];
  if (!preset) {
    throw new Error(`Unknown aspect preset "${presetKey}". Use vertical, square, horizontal, or source.`);
  }
  const { width, height } = preset;
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`,
    'setsar=1',
  ].join(',');
}

let cachedFilters = null;
function ffmpegFilters() {
  if (cachedFilters !== null) return cachedFilters;
  try {
    cachedFilters = execFileSync('ffmpeg', ['-hide_banner', '-filters'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (error) {
    cachedFilters = '';
  }
  return cachedFilters;
}

function ffmpegSupportsFilter(name) {
  return new RegExp(`\\b${name}\\b`).test(ffmpegFilters());
}

function ffmpegSupportsDrawText() {
  return ffmpegSupportsFilter('drawtext');
}

const WATERMARK_POSITIONS = {
  'top-left': { x: 'main_w*0.04', y: 'main_h*0.04' },
  'top-right': { x: 'main_w-overlay_w-main_w*0.04', y: 'main_h*0.04' },
  'bottom-left': { x: 'main_w*0.04', y: 'main_h-overlay_h-main_h*0.04' },
  'bottom-right': { x: 'main_w-overlay_w-main_w*0.04', y: 'main_h-overlay_h-main_h*0.04' },
  'top-center': { x: '(main_w-overlay_w)/2', y: 'main_h*0.04' },
  'bottom-center': { x: '(main_w-overlay_w)/2', y: 'main_h-overlay_h-main_h*0.04' },
  'center': { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' },
};

function resolveWatermarkPosition(position) {
  const key = String(position || 'bottom-right').toLowerCase();
  if (!WATERMARK_POSITIONS[key]) {
    throw new Error(`Unknown watermark position "${position}". Use one of: ${Object.keys(WATERMARK_POSITIONS).join(', ')}.`);
  }
  return WATERMARK_POSITIONS[key];
}

function escapeDrawText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function buildCaptionFilter(caption) {
  if (!caption) return null;
  const text = escapeDrawText(caption);
  return [
    `drawtext=text='${text}'`,
    'fontcolor=white',
    'fontsize=64',
    'box=1',
    'boxcolor=black@0.55',
    'boxborderw=24',
    'x=(w-text_w)/2',
    'y=h*0.08',
  ].join(':');
}

function parseSrtTimestamp(value) {
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) throw new Error(`Invalid SRT timestamp "${value}"`);
  const [, hh, mm, ss, ms] = match;
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, '0')) / 1000;
}

function formatSrtTimestamp(seconds) {
  const total = Math.max(0, seconds);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)},${pad(ms, 3)}`;
}

function shiftSrtForSegment(srtPath, segmentStart, segmentDuration) {
  const raw = fs.readFileSync(srtPath, 'utf8');
  const blocks = raw.replace(/\r\n/g, '\n').split(/\n\n+/);
  const segmentEnd = segmentStart + segmentDuration;
  const shifted = [];
  let counter = 1;

  blocks.forEach((block) => {
    const lines = block.split('\n').filter((line) => line.length > 0);
    if (lines.length < 2) return;
    const headerIndex = lines.findIndex((line) => line.includes('-->'));
    if (headerIndex === -1) return;

    const [startStr, endStr] = lines[headerIndex].split('-->').map((part) => part.trim());
    const start = parseSrtTimestamp(startStr);
    const end = parseSrtTimestamp(endStr);
    if (end <= segmentStart || start >= segmentEnd) return;

    const newStart = Math.max(0, start - segmentStart);
    const newEnd = Math.min(segmentEnd - segmentStart, end - segmentStart);
    if (newEnd <= newStart) return;

    const text = lines.slice(headerIndex + 1).join('\n');
    shifted.push(
      `${counter}\n${formatSrtTimestamp(newStart)} --> ${formatSrtTimestamp(newEnd)}\n${text}`
    );
    counter += 1;
  });

  return shifted.join('\n\n') + (shifted.length > 0 ? '\n' : '');
}

function escapeSubtitlePath(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = execFile('ffmpeg', args, { maxBuffer: 1024 * 1024 * 32 }, (error, stdout, stderr) => {
      if (error) {
        const reason = stderr ? stderr.toString().split('\n').slice(-15).join('\n') : error.message;
        reject(new Error(`ffmpeg failed: ${reason}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    child.on('error', reject);
  });
}

async function clipSegment({
  source,
  start,
  duration,
  outputPath,
  aspect,
  caption,
  burnCaption = true,
  watermark,
  watermarkPosition = 'bottom-right',
  watermarkOpacity = 0.85,
  watermarkScale = 0.18,
  subtitlesPath,
}) {
  ensureDir(path.dirname(outputPath));

  const videoChain = [];
  const aspectFilter = buildAspectFilter(aspect);
  if (aspectFilter) videoChain.push(aspectFilter);

  let captionBurned = false;
  if (caption && burnCaption) {
    if (ffmpegSupportsDrawText()) {
      videoChain.push(buildCaptionFilter(caption));
      captionBurned = true;
    } else {
      console.warn('[videoClipper] ffmpeg drawtext filter unavailable — skipping caption burn-in. Reinstall ffmpeg with libfreetype to enable.');
    }
  }

  let subtitlesBurned = false;
  let tempSrtPath = null;
  if (subtitlesPath) {
    if (!ffmpegSupportsFilter('subtitles')) {
      console.warn('[videoClipper] ffmpeg subtitles filter unavailable — skipping subtitle burn-in.');
    } else if (!fs.existsSync(subtitlesPath)) {
      throw new Error(`Subtitles file not found: ${subtitlesPath}`);
    } else {
      tempSrtPath = path.join(path.dirname(outputPath), `.subs-${path.basename(outputPath, path.extname(outputPath))}.srt`);
      fs.writeFileSync(tempSrtPath, shiftSrtForSegment(subtitlesPath, start, duration));
      videoChain.push(`subtitles=filename='${escapeSubtitlePath(tempSrtPath)}':force_style='Fontsize=22,Outline=2,Shadow=0'`);
      subtitlesBurned = true;
    }
  }

  let watermarkApplied = false;
  let watermarkResolved = null;
  if (watermark) {
    watermarkResolved = path.resolve(watermark);
    if (!fs.existsSync(watermarkResolved)) {
      throw new Error(`Watermark file not found: ${watermarkResolved}`);
    }
    watermarkApplied = true;
  }

  const args = [
    '-y',
    '-ss', String(start),
    '-i', source,
  ];

  if (watermarkApplied) {
    args.push('-loop', '1', '-i', watermarkResolved);

    const baseChain = videoChain.length > 0 ? videoChain.join(',') : 'null';
    const pos = resolveWatermarkPosition(watermarkPosition);
    const opacity = Math.max(0, Math.min(1, Number(watermarkOpacity)));
    const scale = Math.max(0.02, Math.min(1, Number(watermarkScale)));

    const filterComplex = [
      `[0:v]${baseChain}[base]`,
      `[1:v]format=rgba,colorchannelmixer=aa=${opacity},scale=iw*${scale}:-1[wm]`,
      `[base][wm]overlay=${pos.x}:${pos.y}:format=auto:shortest=1[v]`,
    ].join(';');

    args.push('-filter_complex', filterComplex, '-map', '[v]', '-map', '0:a?');
  } else if (videoChain.length > 0) {
    args.push('-vf', videoChain.join(','));
  }

  args.push(
    '-t', String(duration),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputPath
  );

  try {
    await runFfmpeg(args);
  } finally {
    if (tempSrtPath && fs.existsSync(tempSrtPath)) {
      try { fs.unlinkSync(tempSrtPath); } catch (error) { /* ignore */ }
    }
  }

  return { outputPath, captionBurned, subtitlesBurned, watermarkApplied };
}

function buildBrief({ config, topic, caption, hashtags }) {
  const brand = config.brandName || 'AIWholesail';
  const cta = config.primaryCta || 'Start your 7-day free trial';
  const website = (config.website || 'https://aiwholesail.com').replace(/^https?:\/\//, '');
  const tags = (hashtags && hashtags.length ? hashtags : (topic?.hashtags || config.defaultHashtags || []))
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));

  const baseHook = caption || topic?.hook || `Use ${brand} to find better real estate deals faster.`;
  const captionLine = `${baseHook}\n\n${cta}\n${website}`;
  const captionWithTags = tags.length ? `${captionLine}\n${tags.join(' ')}` : captionLine;

  return {
    theme: topic?.title || 'AIWholesail clip',
    caption: captionWithTags,
    hashtags: tags,
    youtube: {
      title: (topic?.youtubeTitle || baseHook).slice(0, 95) + ' #shorts',
      description: [
        topic?.promise || `${brand} helps real estate investors search markets, score deals, and act faster.`,
        cta,
        website,
      ].join('\n\n'),
      tags: (topic?.keywords || config.youtubeTags || []).slice(0, 12),
    },
    instagram: {
      caption: captionWithTags,
    },
    facebook: {
      title: (topic?.facebookTitle || baseHook).slice(0, 100),
      description: `${topic?.promise || `${brand} helps you search, analyze, and filter deals faster.`}\n\n${cta}\n${website}`,
    },
    tiktok: {
      caption: `${baseHook} ${tags.slice(0, 6).join(' ')}`.trim(),
    },
  };
}

function buildRunId(prefix) {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    '-',
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('');
  return `${stamp}-${slugify(prefix || 'clip')}`;
}

function buildClipRunPaths(runId, baseDir = GENERATED_CLIP_DIR) {
  const runDir = path.join(baseDir, runId);
  return {
    runId,
    runDir,
    manifestPath: path.join(runDir, RUN_FILES.manifest),
    briefPath: path.join(runDir, RUN_FILES.brief),
    sourceInfoPath: path.join(runDir, RUN_FILES.source),
  };
}

function listClipRuns(baseDir = GENERATED_CLIP_DIR) {
  if (!fs.existsSync(baseDir)) return [];

  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const paths = buildClipRunPaths(entry.name, baseDir);
      let manifest = null;
      if (fs.existsSync(paths.manifestPath)) {
        try {
          manifest = readJson(paths.manifestPath);
        } catch (error) {
          manifest = { runId: entry.name, readError: error.message };
        }
      }
      return { runId: entry.name, runDir: paths.runDir, manifest };
    })
    .sort((left, right) => right.runId.localeCompare(left.runId));
}

function loadClipRunManifest(runId, baseDir = GENERATED_CLIP_DIR) {
  const paths = buildClipRunPaths(runId, baseDir);
  if (!fs.existsSync(paths.manifestPath)) {
    throw new Error(`Manifest not found for clip run "${runId}".`);
  }
  return { paths, manifest: readJson(paths.manifestPath) };
}

function clampSegmentToDuration(segment, durationSeconds) {
  if (!durationSeconds || !Number.isFinite(durationSeconds)) return segment;
  const end = Math.min(segment.end, durationSeconds);
  const start = Math.min(segment.start, end);
  return { ...segment, start, end, duration: Math.max(0, end - start) };
}

async function runClipPipeline(options = {}) {
  const {
    source,
    segments,
    aspect = 'vertical',
    caption,
    captions,
    hashtags,
    configPath,
    topicSlug,
    publish = false,
    dryRun = false,
    skipRender = false,
    burnCaption = true,
    watermark,
    watermarkPosition,
    watermarkOpacity,
    watermarkScale,
    subtitlesPath,
    platforms,
    runIdPrefix,
    baseDir = GENERATED_CLIP_DIR,
  } = options;

  if (!source) throw new Error('source is required.');
  const sourcePath = path.resolve(source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('At least one segment is required.');
  }

  if (skipRender && publish) {
    throw new Error('--skip-render cannot be combined with publish.');
  }

  const sourceInfo = probeMedia(sourcePath);
  const normalizedSegments = segments
    .map((segment) => clampSegmentToDuration(segment, sourceInfo.durationSeconds))
    .filter((segment) => segment.duration > 0);

  if (normalizedSegments.length === 0) {
    throw new Error('All segments are out of range for this source.');
  }

  let config = {};
  let resolvedConfigPath = null;
  let topic = null;
  if (configPath) {
    const loaded = loadCampaignConfig(configPath);
    config = loaded.config;
    resolvedConfigPath = loaded.configPath;
    if (topicSlug) {
      topic = pickTopic(config, topicSlug);
    }
  }

  const selectedPlatforms = parsePlatforms(
    platforms,
    Array.isArray(config.defaultPlatforms) ? config.defaultPlatforms : DEFAULT_PLATFORMS
  );

  const runs = [];
  const sourceBase = path.basename(sourcePath, path.extname(sourcePath));
  const baseSlug = slugify(topic?.slug || sourceBase || 'clip');

  for (let index = 0; index < normalizedSegments.length; index += 1) {
    const segment = normalizedSegments[index];
    const labelSlug = segment.label ? slugify(segment.label) : null;
    const prefix = `${runIdPrefix || baseSlug}${labelSlug ? `-${labelSlug}` : `-${index + 1}`}`;
    const runId = buildRunId(prefix);
    const paths = buildClipRunPaths(runId, baseDir);
    ensureDir(paths.runDir);

    const videoFileName = `clip-${String(index + 1).padStart(2, '0')}.mp4`;
    const videoPath = path.join(paths.runDir, videoFileName);
    const segmentCaption = segment.caption
      || (Array.isArray(captions) ? captions[index] : null)
      || caption
      || null;

    let captionBurned = false;
    let subtitlesBurned = false;
    let watermarkApplied = false;
    if (!skipRender) {
      const result = await clipSegment({
        source: sourcePath,
        start: segment.start,
        duration: segment.duration,
        outputPath: videoPath,
        aspect,
        caption: segmentCaption,
        burnCaption,
        watermark,
        watermarkPosition,
        watermarkOpacity,
        watermarkScale,
        subtitlesPath,
      });
      captionBurned = result.captionBurned;
      subtitlesBurned = result.subtitlesBurned;
      watermarkApplied = result.watermarkApplied;
    }

    const brief = buildBrief({ config, topic, caption: segmentCaption, hashtags });
    writeJson(paths.briefPath, brief);
    writeJson(paths.sourceInfoPath, {
      sourcePath,
      sourceInfo,
      segment: {
        start: segment.start,
        end: segment.end,
        duration: segment.duration,
        startTimecode: formatTimestamp(segment.start),
        endTimecode: formatTimestamp(segment.end),
        label: segment.label || null,
      },
      aspect,
    });

    const publicVideoUrl = skipRender ? null : buildPublicVideoUrl(runId, videoFileName);

    let publishResults;
    if (publish) {
      publishResults = await publishToPlatforms({
        platforms: selectedPlatforms,
        filePath: videoPath,
        publicVideoUrl,
        brief,
        config,
        dryRun,
      });
    } else {
      publishResults = Object.fromEntries(
        selectedPlatforms.map((platform) => [platform, { status: 'not-requested' }])
      );
    }

    const manifest = {
      runId,
      kind: 'clip',
      generatedAt: new Date().toISOString(),
      sourcePath,
      sourceInfo,
      segment: {
        index,
        start: segment.start,
        end: segment.end,
        duration: segment.duration,
        startTimecode: formatTimestamp(segment.start),
        endTimecode: formatTimestamp(segment.end),
        label: segment.label || null,
      },
      aspect,
      captionBurned,
      subtitlesBurned,
      watermarkApplied,
      watermark: watermarkApplied ? path.resolve(watermark) : null,
      configPath: resolvedConfigPath,
      topicSlug: topic?.slug || null,
      theme: brief.theme,
      assets: {
        videoPath: skipRender ? null : videoPath,
        videoFileName,
        publicVideoUrl,
      },
      brief,
      publishResults,
    };

    writeJson(paths.manifestPath, manifest);
    runs.push({ runId, paths, manifest });
  }

  return { runs, sourceInfo, selectedPlatforms };
}

async function publishExistingClipRun({ runId, platforms, dryRun = false, baseDir = GENERATED_CLIP_DIR }) {
  const { paths, manifest } = loadClipRunManifest(runId, baseDir);
  if (!manifest.assets?.videoPath || !fs.existsSync(manifest.assets.videoPath)) {
    throw new Error(`Rendered clip missing for run "${runId}".`);
  }

  let config = { labelAiGeneratedContent: true };
  if (manifest.configPath && fs.existsSync(manifest.configPath)) {
    try {
      config = loadCampaignConfig(manifest.configPath).config;
    } catch (error) {
      config = { labelAiGeneratedContent: true };
    }
  }

  const selectedPlatforms = parsePlatforms(platforms, DEFAULT_PLATFORMS);
  const publicVideoUrl = manifest.assets.publicVideoUrl
    || buildPublicVideoUrl(runId, manifest.assets.videoFileName || 'clip-01.mp4');

  const publishResults = await publishToPlatforms({
    platforms: selectedPlatforms,
    filePath: manifest.assets.videoPath,
    publicVideoUrl,
    brief: manifest.brief,
    config,
    dryRun,
  });

  const updatedManifest = {
    ...manifest,
    assets: { ...manifest.assets, publicVideoUrl },
    publishResults: { ...(manifest.publishResults || {}), ...publishResults },
    updatedAt: new Date().toISOString(),
  };
  writeJson(paths.manifestPath, updatedManifest);

  return { paths, manifest: updatedManifest, selectedPlatforms };
}

function inspectClipperEnvironment() {
  const checks = [];

  const probe = (binary) => {
    try {
      execFileSync(binary, ['-version'], { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  };

  const ffmpegOk = probe('ffmpeg');
  const ffprobeOk = probe('ffprobe');

  checks.push({ name: 'ffmpeg', ok: ffmpegOk, detail: ffmpegOk ? 'Installed' : 'Missing from PATH' });
  checks.push({ name: 'ffprobe', ok: ffprobeOk, detail: ffprobeOk ? 'Installed' : 'Missing from PATH' });

  const groups = [
    { name: 'youtube', vars: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'] },
    { name: 'instagram', vars: ['INSTAGRAM_IG_USER_ID', 'INSTAGRAM_PAGE_ACCESS_TOKEN', 'SOCIAL_PUBLIC_BASE_URL'] },
    { name: 'facebook', vars: ['FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN'] },
    { name: 'tiktok', vars: ['TIKTOK_ACCESS_TOKEN'] },
  ];

  groups.forEach((group) => {
    const missing = group.vars.filter((name) => !process.env[name]);
    checks.push({
      name: `${group.name}-env`,
      ok: missing.length === 0,
      detail: missing.length === 0 ? 'Configured' : `Missing: ${missing.join(', ')}`,
    });
  });

  return checks;
}

module.exports = {
  ASPECT_PRESETS,
  GENERATED_CLIP_DIR,
  RUN_FILES,
  buildBrief,
  buildClipRunPaths,
  clipSegment,
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
};
