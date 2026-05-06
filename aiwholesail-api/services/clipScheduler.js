const fs = require('fs');
const path = require('path');

const {
  GENERATED_CLIP_DIR,
  publishExistingClipRun,
} = require('./videoClipper');

const QUEUE_FILE_NAME = '.publish-queue.json';

function queueFilePath(baseDir = GENERATED_CLIP_DIR) {
  return path.join(baseDir, QUEUE_FILE_NAME);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function generateItemId(runId) {
  return `${runId}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function toIsoString(value) {
  if (value == null) return new Date().toISOString();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('scheduledFor is an invalid Date.');
    }
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`scheduledFor "${value}" is not a valid date/ISO string.`);
  }
  return parsed.toISOString();
}

function loadQueue(baseDir = GENERATED_CLIP_DIR) {
  const filePath = queueFilePath(baseDir);
  if (!fs.existsSync(filePath)) {
    return { items: [] };
  }
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`[clipScheduler] Failed to read queue at ${filePath}: ${error.message}`);
    return { items: [] };
  }
  if (!raw || !raw.trim()) {
    return { items: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      console.error(`[clipScheduler] Queue file ${filePath} is malformed; treating as empty.`);
      return { items: [] };
    }
    return parsed;
  } catch (error) {
    console.error(`[clipScheduler] Queue file ${filePath} is corrupt (${error.message}); treating as empty.`);
    return { items: [] };
  }
}

function saveQueue(queue, baseDir = GENERATED_CLIP_DIR) {
  const safeQueue = queue && typeof queue === 'object' && Array.isArray(queue.items)
    ? queue
    : { items: [] };
  ensureDir(baseDir);
  const target = queueFilePath(baseDir);
  const tmp = `${target}.tmp-${process.pid}-${Date.now().toString(36)}`;
  const data = JSON.stringify(safeQueue, null, 2);
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, target);
  return target;
}

function runDirExists(runId, baseDir) {
  if (!runId) return false;
  const runDir = path.join(baseDir, runId);
  return fs.existsSync(runDir) && fs.statSync(runDir).isDirectory();
}

function enqueue({ runId, scheduledFor, platforms, baseDir = GENERATED_CLIP_DIR } = {}) {
  if (!runId || typeof runId !== 'string') {
    throw new Error('enqueue requires a runId string.');
  }
  if (!runDirExists(runId, baseDir)) {
    throw new Error(`Run directory for "${runId}" not found under ${baseDir}.`);
  }

  const platformList = Array.isArray(platforms)
    ? platforms.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : null;

  const scheduledIso = toIsoString(scheduledFor);
  const nowIso = new Date().toISOString();

  const item = {
    id: generateItemId(runId),
    runId,
    scheduledFor: scheduledIso,
    platforms: platformList,
    createdAt: nowIso,
    status: 'pending',
    lastAttemptAt: null,
    result: null,
    error: null,
  };

  const queue = loadQueue(baseDir);
  queue.items.push(item);
  saveQueue(queue, baseDir);
  return item;
}

function listQueue({ baseDir = GENERATED_CLIP_DIR, status } = {}) {
  const queue = loadQueue(baseDir);
  if (!status) return queue.items.slice();
  return queue.items.filter((item) => item.status === status);
}

function removeFromQueue(id, baseDir = GENERATED_CLIP_DIR) {
  if (!id) return false;
  const queue = loadQueue(baseDir);
  const before = queue.items.length;
  queue.items = queue.items.filter((item) => item.id !== id);
  if (queue.items.length === before) {
    return false;
  }
  saveQueue(queue, baseDir);
  return true;
}

function summarizePublishResults(publishResults) {
  if (!publishResults || typeof publishResults !== 'object') return null;
  const summary = {};
  for (const [platform, value] of Object.entries(publishResults)) {
    if (value && typeof value === 'object') {
      summary[platform] = {
        status: value.status || 'unknown',
        ...(value.reason ? { reason: value.reason } : {}),
        ...(value.url ? { url: value.url } : {}),
        ...(value.videoId ? { videoId: value.videoId } : {}),
        ...(value.mediaId ? { mediaId: value.mediaId } : {}),
        ...(value.publishId ? { publishId: value.publishId } : {}),
      };
    } else {
      summary[platform] = { status: String(value) };
    }
  }
  return summary;
}

async function processDueItems({
  baseDir = GENERATED_CLIP_DIR,
  now = new Date(),
  dryRun = false,
  max = 25,
} = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : 25;
  const results = [];

  if (!fs.existsSync(baseDir)) {
    return results;
  }

  const queue = loadQueue(baseDir);
  const dueIds = queue.items
    .filter((item) => item.status === 'pending')
    .filter((item) => {
      const scheduled = new Date(item.scheduledFor);
      if (Number.isNaN(scheduled.getTime())) return true;
      return scheduled.getTime() <= nowDate.getTime();
    })
    .slice(0, limit)
    .map((item) => item.id);

  for (const id of dueIds) {
    // Re-load fresh each iteration so the on-disk queue stays canonical.
    const currentQueue = loadQueue(baseDir);
    const index = currentQueue.items.findIndex((entry) => entry.id === id);
    if (index === -1) continue;

    const item = currentQueue.items[index];
    if (item.status !== 'pending') continue;

    const attemptAt = new Date().toISOString();
    item.lastAttemptAt = attemptAt;

    try {
      const publishResult = await publishExistingClipRun({
        runId: item.runId,
        platforms: item.platforms,
        dryRun,
        baseDir,
      });
      const summary = summarizePublishResults(publishResult?.manifest?.publishResults);
      item.status = 'published';
      item.result = summary;
      item.error = null;
    } catch (error) {
      item.status = 'failed';
      item.error = error && error.message ? error.message : String(error);
    }

    currentQueue.items[index] = item;
    saveQueue(currentQueue, baseDir);

    results.push({
      id: item.id,
      runId: item.runId,
      status: item.status,
      platforms: item.platforms,
      lastAttemptAt: item.lastAttemptAt,
      result: item.result,
      error: item.error,
    });
  }

  return results;
}

module.exports = {
  QUEUE_FILE_NAME,
  loadQueue,
  saveQueue,
  enqueue,
  listQueue,
  removeFromQueue,
  processDueItems,
};
