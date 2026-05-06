'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  parseTimestamp,
  formatTimestamp,
  parseSegmentSpec,
  loadSegmentsFromFile,
} = require('../services/videoClipper');

const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}

function describe(group, fn) {
  fn((name, body) => test(`${group} > ${name}`, body));
}

async function run() {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (e) {
      failed += 1;
      console.error(`  FAIL ${name}: ${e.message}`);
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
}

// ---------------------------------------------------------------------------
// 1. parseTimestamp
// ---------------------------------------------------------------------------
describe('parseTimestamp', (it) => {
  it('parses bare seconds string "30" as 30', () => {
    assert.equal(parseTimestamp('30'), 30);
  });

  it('parses "30s" suffix as 30', () => {
    assert.equal(parseTimestamp('30s'), 30);
  });

  it('parses "1m" suffix as 60', () => {
    assert.equal(parseTimestamp('1m'), 60);
  });

  it('parses "1:30" mm:ss as 90', () => {
    assert.equal(parseTimestamp('1:30'), 90);
  });

  it('parses "1:23.5" with fractional seconds as 83.5', () => {
    assert.equal(parseTimestamp('1:23.5'), 83.5);
  });

  it('parses "01:02:03" hh:mm:ss as 3723', () => {
    assert.equal(parseTimestamp('01:02:03'), 3723);
  });

  it('throws on non-numeric "abc"', () => {
    assert.throws(() => parseTimestamp('abc'));
  });

  it('throws on too many colon segments "1:2:3:4"', () => {
    assert.throws(() => parseTimestamp('1:2:3:4'));
  });
});

// ---------------------------------------------------------------------------
// 2. formatTimestamp
// ---------------------------------------------------------------------------
describe('formatTimestamp', (it) => {
  it('formats 0 as "00:00.000"', () => {
    assert.equal(formatTimestamp(0), '00:00.000');
  });

  it('formats 90 as "01:30.000"', () => {
    assert.equal(formatTimestamp(90), '01:30.000');
  });

  it('formats 3723 as "01:02:03.000"', () => {
    assert.equal(formatTimestamp(3723), '01:02:03.000');
  });

  it('round-trips parse(format(x)) === x for representative values', () => {
    const values = [0, 1.234, 90, 3723.5];
    for (const x of values) {
      const formatted = formatTimestamp(x);
      const parsed = parseTimestamp(formatted);
      assert.equal(parsed, x, `round-trip failed for ${x} (formatted="${formatted}", parsed=${parsed})`);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. parseSegmentSpec
// ---------------------------------------------------------------------------
describe('parseSegmentSpec', (it) => {
  it('parses single "0:00-0:30" into one segment', () => {
    const result = parseSegmentSpec('0:00-0:30');
    assert.equal(result.length, 1);
    assert.deepEqual(result[0], { start: 0, end: 30, duration: 30 });
  });

  it('parses two comma-separated segments', () => {
    const result = parseSegmentSpec('0:00-0:30,1:00-1:15');
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { start: 0, end: 30, duration: 30 });
    assert.deepEqual(result[1], { start: 60, end: 75, duration: 15 });
  });

  it('throws when end <= start ("0:30-0:00")', () => {
    assert.throws(() => parseSegmentSpec('0:30-0:00'));
  });

  it('throws when no dash is present ("0:00")', () => {
    assert.throws(() => parseSegmentSpec('0:00'));
  });
});

// ---------------------------------------------------------------------------
// 4. loadSegmentsFromFile (uses repo example file, no writes)
// ---------------------------------------------------------------------------
describe('loadSegmentsFromFile', (it) => {
  it('loads exactly 4 segments from clip-segments.example.json with valid durations', () => {
    const exampleFile = path.join(__dirname, '..', 'config', 'clip-segments.example.json');
    const segments = loadSegmentsFromFile(exampleFile);
    assert.equal(segments.length, 4, `expected 4 segments, got ${segments.length}`);
    for (const seg of segments) {
      assert.ok(seg.duration > 0, `duration should be > 0, got ${seg.duration}`);
      assert.ok(seg.end > seg.start, `end (${seg.end}) should be > start (${seg.start})`);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Integration: temp SRT lifecycle
//    shiftSrtForSegment is NOT exported; we cannot test it directly.
//    This test only exercises temp-file creation/cleanup as the integration
//    surface area allowed by the task.
// ---------------------------------------------------------------------------
describe('integration:srt-temp-file', (it) => {
  it('writes a tiny SRT to a temp file and cleans it up', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiwhsl-clip-test-'));
    const srtPath = path.join(tempDir, 'tiny.srt');
    const srtBody = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'first cue',
      '',
      '2',
      '00:00:05,000 --> 00:00:06,000',
      'second cue',
      '',
      '3',
      '00:00:09,000 --> 00:00:10,000',
      'third cue',
      '',
    ].join('\n');

    try {
      fs.writeFileSync(srtPath, srtBody, 'utf8');
      assert.ok(fs.existsSync(srtPath), 'temp SRT should exist after write');
      const readBack = fs.readFileSync(srtPath, 'utf8');
      assert.ok(readBack.includes('-->'), 'SRT body should contain a cue header');
      assert.ok(readBack.includes('first cue'), 'SRT should contain first cue text');
    } finally {
      try { fs.unlinkSync(srtPath); } catch (_) { /* ignore */ }
      try { fs.rmdirSync(tempDir); } catch (_) { /* ignore */ }
    }

    assert.equal(fs.existsSync(srtPath), false, 'temp SRT should be removed after cleanup');
  });
});

run();
