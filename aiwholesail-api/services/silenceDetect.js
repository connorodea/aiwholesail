const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

function probeDurationSeconds(sourcePath) {
  const args = [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    sourcePath,
  ];

  let raw;
  try {
    raw = execFileSync('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch (error) {
    throw new Error(`ffprobe failed for "${sourcePath}": ${error.stderr ? error.stderr.toString() : error.message}`);
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Could not determine duration for "${sourcePath}".`);
  }
  return value;
}

function runFfmpegCapture(args) {
  return new Promise((resolve, reject) => {
    const child = execFile('ffmpeg', args, { maxBuffer: 1024 * 1024 * 32 }, (error, stdout, stderr) => {
      // silencedetect emits to stderr and ffmpeg exits 0 even with -f null. Treat real spawn errors as failures.
      if (error && error.code !== 0 && !stderr) {
        reject(new Error(`ffmpeg failed: ${error.message}`));
        return;
      }
      resolve({ stdout: stdout ? stdout.toString() : '', stderr: stderr ? stderr.toString() : '' });
    });
    child.on('error', reject);
  });
}

function parseSilenceLog(stderr) {
  const lines = String(stderr || '').split('\n');
  const silences = [];
  let pendingStart = null;

  lines.forEach((line) => {
    const startMatch = line.match(/silence_start:\s*(-?\d+(?:\.\d+)?)/);
    if (startMatch) {
      pendingStart = Math.max(0, Number(startMatch[1]));
      return;
    }
    const endMatch = line.match(/silence_end:\s*(-?\d+(?:\.\d+)?)\s*\|\s*silence_duration:\s*(-?\d+(?:\.\d+)?)/);
    if (endMatch) {
      const end = Math.max(0, Number(endMatch[1]));
      const duration = Math.max(0, Number(endMatch[2]));
      const start = pendingStart != null ? pendingStart : Math.max(0, end - duration);
      silences.push({ start, end, duration });
      pendingStart = null;
    }
  });

  if (pendingStart != null) {
    silences.push({ start: pendingStart, end: null, duration: null });
  }

  return silences;
}

async function detectSilence(sourcePath, options = {}) {
  const { noiseDb = -30, minSilenceSeconds = 0.6 } = options;
  if (!sourcePath) throw new Error('sourcePath is required.');
  const resolved = path.resolve(sourcePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Source file not found: ${resolved}`);
  }

  const args = [
    '-hide_banner',
    '-i', resolved,
    '-af', `silencedetect=noise=${noiseDb}dB:d=${minSilenceSeconds}`,
    '-f', 'null',
    '-',
  ];

  const { stderr } = await runFfmpegCapture(args);
  return parseSilenceLog(stderr);
}

function invertToSpeechRegions(silences, durationSeconds) {
  const regions = [];
  let cursor = 0;

  const sorted = silences
    .map((entry) => ({
      start: Math.max(0, Number(entry.start) || 0),
      end: entry.end == null ? durationSeconds : Math.min(durationSeconds, Number(entry.end)),
    }))
    .filter((entry) => entry.end > entry.start)
    .sort((a, b) => a.start - b.start);

  sorted.forEach((silence) => {
    if (silence.start > cursor) {
      regions.push({ start: cursor, end: Math.min(silence.start, durationSeconds) });
    }
    cursor = Math.max(cursor, silence.end);
  });

  if (cursor < durationSeconds) {
    regions.push({ start: cursor, end: durationSeconds });
  }

  return regions
    .map((region) => ({ start: region.start, end: region.end, duration: region.end - region.start }))
    .filter((region) => region.duration > 0);
}

// Heuristic: glue tiny speech regions onto neighbors and break overly long ones at silence boundaries
// (or even chunks if no boundary is close) so downstream clip durations stay in the target band.
function shapeRegions(regions, { minClipSeconds, maxClipSeconds, targetSeconds }) {
  const merged = [];
  for (let i = 0; i < regions.length; i += 1) {
    const current = regions[i];
    const prev = merged[merged.length - 1];
    if (prev && current.duration < minClipSeconds && (current.start - prev.end) < minClipSeconds) {
      prev.end = current.end;
      prev.duration = prev.end - prev.start;
    } else {
      merged.push({ ...current });
    }
  }

  const shaped = [];
  merged.forEach((region) => {
    if (region.duration <= maxClipSeconds) {
      shaped.push(region);
      return;
    }
    let cursor = region.start;
    while (region.end - cursor > maxClipSeconds) {
      const chunkEnd = cursor + targetSeconds;
      shaped.push({ start: cursor, end: chunkEnd, duration: targetSeconds });
      cursor = chunkEnd;
    }
    if (region.end - cursor > 0) {
      shaped.push({ start: cursor, end: region.end, duration: region.end - cursor });
    }
  });

  return shaped.filter((region) => region.duration >= minClipSeconds);
}

async function proposeSegmentsFromSilence(sourcePath, options = {}) {
  const {
    noiseDb = -30,
    minSilenceSeconds = 0.6,
    minClipSeconds = 12,
    maxClipSeconds = 60,
    targetSeconds = 28,
    maxClips = 5,
    labelPrefix = 'silent-cut',
  } = options;

  if (!(minClipSeconds > 0 && maxClipSeconds >= minClipSeconds)) {
    throw new Error('minClipSeconds must be > 0 and <= maxClipSeconds.');
  }
  if (!(targetSeconds >= minClipSeconds && targetSeconds <= maxClipSeconds)) {
    throw new Error('targetSeconds must be between minClipSeconds and maxClipSeconds.');
  }

  const resolved = path.resolve(sourcePath);
  const durationSeconds = probeDurationSeconds(resolved);
  const silences = await detectSilence(resolved, { noiseDb, minSilenceSeconds });
  const speechRegions = invertToSpeechRegions(silences, durationSeconds);

  let candidates = shapeRegions(speechRegions, { minClipSeconds, maxClipSeconds, targetSeconds });

  // Fallback: if filtering eliminated everything but the source has audible content, keep the longest raw region.
  if (candidates.length === 0 && speechRegions.length > 0) {
    const longest = speechRegions.slice().sort((a, b) => b.duration - a.duration)[0];
    if (longest && longest.duration > 0) {
      const trimmed = Math.min(longest.duration, maxClipSeconds);
      candidates = [{ start: longest.start, end: longest.start + trimmed, duration: trimmed }];
    }
  }

  return candidates.slice(0, maxClips).map((region, index) => {
    const label = `${labelPrefix}-${String(index + 1).padStart(2, '0')}`;
    return {
      start: region.start,
      end: region.end,
      duration: region.duration,
      label,
      caption: null,
    };
  });
}

module.exports = {
  detectSilence,
  proposeSegmentsFromSilence,
};
