# AIWholesail Clipping CLI

## Overview

The clipping CLI cuts long-form recordings into branded short-form clips for YouTube Shorts, Instagram Reels, Facebook Reels, and TikTok via the existing `socialAutomation` pipeline. It produces vertical (or square/horizontal) MP4s with optional burned-in caption, watermark, and subtitles, plus a per-platform brief (caption, hashtags, YT title/description). All artifacts land under `aiwholesail-api/generated-clips/<runId>/`.

## Install & Doctor

Required on PATH:

- `ffmpeg` and `ffprobe` (build with `libfreetype` for caption burn-in and `libass` for subtitle burn-in)
- `yt-dlp` (only for `fetch`)

Required env:

- `OPENAI_API_KEY` — needed for `transcribe` and `suggest`
- YouTube group: `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
- Instagram group: `INSTAGRAM_IG_USER_ID`, `INSTAGRAM_PAGE_ACCESS_TOKEN`, `SOCIAL_PUBLIC_BASE_URL`
- Facebook group: `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`
- TikTok group: `TIKTOK_ACCESS_TOKEN`

Run the environment check:

```bash
node aiwholesail-api/bin/aiwholesail-clip.js doctor
```

## Full Auto Pipeline

Fetch a recording, transcribe it, ask GPT for clip picks, then cut and publish — all tagged to the `instant-deal-alerts` topic from `aiwholesail-api/config/social-short-campaign.json`:

```bash
# 1. Fetch the source (skip if you already have a local file)
node aiwholesail-api/bin/aiwholesail-clip.js fetch \
  --url "https://www.youtube.com/watch?v=XXXXXXXXXXX" \
  --out ./webinar.mp4

# 2. Transcribe to SRT
node aiwholesail-api/bin/aiwholesail-clip.js transcribe \
  --source ./webinar.mp4 --out ./webinar.srt

# 3. Have GPT propose clip segments + captions
node aiwholesail-api/bin/aiwholesail-clip.js suggest \
  --srt ./webinar.srt \
  --topic instant-deal-alerts \
  --count 3 \
  --out ./suggestions.json

# 4. Cut, brand, and publish
node aiwholesail-api/bin/aiwholesail-clip.js make \
  --source ./webinar.mp4 \
  --segments-file ./suggestions.json \
  --subtitles ./webinar.srt \
  --watermark ./public/logo-white.png \
  --topic instant-deal-alerts \
  --publish
```

## Command Reference

### help

Show usage text.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js help
```

### doctor

Check `ffmpeg` / `ffprobe` / `yt-dlp` and the four publish env groups.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js doctor
```

- `--json` — emit JSON instead of human output

### fetch

Download a source from a URL via `yt-dlp`.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js fetch --url <url> --out ./source.mp4
```

- `--url` — source URL (required; positional also accepted)
- `--out` — output path (defaults to `%(title).80s-%(id)s.%(ext)s` in cwd)
- `--audio-only` — extract MP3 audio only
- `--max-height` — cap video height (e.g. `1080`)
- `--format` — explicit `yt-dlp` format selector
- `--cookies` — path to a cookies file
- `--json` — emit JSON

### probe

Print `ffprobe` info for a source.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js probe --source ./webinar.mp4
```

- `--source` — file path (required; positional also accepted)
- `--json` — emit JSON

### transcribe

Generate an SRT from a source via OpenAI Whisper.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js transcribe --source ./webinar.mp4 --out ./webinar.srt
```

- `--source` — file path (required)
- `--out` — output `.srt` path (defaults next to source)
- `--language` — language hint
- `--model` — Whisper model (default `whisper-1`, or `WHISPER_MODEL` env)
- `--prompt` — Whisper bias prompt
- `--json` — emit JSON

### suggest

Propose clip segments from an SRT via GPT.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js suggest \
  --srt ./webinar.srt --topic instant-deal-alerts --count 3 --out ./suggestions.json
```

- `--srt` (or `--subtitles`) — SRT path (required)
- `--topic` — campaign topic slug (loads `social-short-campaign.json`)
- `--config` — explicit campaign config path
- `--count` — number of clips (default `3`)
- `--min-duration` — seconds (default `18`)
- `--max-duration` — seconds (default `35`)
- `--model` — chat model (default `gpt-4.1`, or `CLIP_SUGGEST_MODEL` env)
- `--out` — write JSON file
- `--json` — emit JSON to stdout

### make

Clip a source into one or more shorts and (optionally) publish.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js make \
  --source ./webinar.mp4 --start 0:00 --end 0:30 \
  --topic instant-deal-alerts --publish
```

- `--source` — file path (required)
- `--start` / `--end` — single-segment timestamps
- `--segments` — `"a-b,c-d"` comma-separated start-end pairs
- `--segments-file` — JSON spec (`[{start,end,label?,caption?}]` or `{segments:[...]}`)
- `--aspect` — `vertical` (default) | `square` | `horizontal` | `source`
- `--caption` — burn caption + use as social caption fallback
- `--burn-caption=false` — skip burn-in (caption still flows to social copy)
- `--hashtags` — `"#a,#b"` override
- `--topic` — campaign topic slug
- `--config` — campaign config path
- `--watermark` — logo file path
- `--watermark-position` — `bottom-right` (default), `bottom-left`, `top-right`, `top-left`, `top-center`, `bottom-center`, `center`
- `--watermark-opacity` — `0`–`1` (default `0.85`)
- `--watermark-scale` — fraction of video width (default `0.18`)
- `--subtitles` — SRT to burn (auto-shifted to clip start)
- `--platforms` — `youtube,instagram,facebook,tiktok` subset
- `--publish` — push to platforms
- `--dry-run` — run publish flow without uploading
- `--skip-render` — write manifest only (cannot combine with `--publish`)
- `--run-prefix` — override run-id prefix
- `--base-dir` — override `generated-clips` dir
- `--json` — emit JSON

### thumbnail

Extract a single frame as a YT/IG cover image.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js thumbnail --source ./webinar.mp4 --at 12.5 --out ./cover.jpg
```

- `--source` — file path (required; positional also accepted)
- `--at` (or `--timestamp`) — frame time (seconds, `mm:ss`, or `hh:mm:ss`; default `0`)
- `--out` — output JPG path
- `--watermark`, `--watermark-position`, `--watermark-opacity`, `--watermark-scale` — same semantics as `make`
- `--hook` — overlay hook text via `drawtext`
- `--json` — emit JSON

### runs

List clip runs (newest first).

```bash
node aiwholesail-api/bin/aiwholesail-clip.js runs --limit 10
```

- `--limit` — cap result count
- `--base-dir` — override `generated-clips` dir
- `--json` — emit JSON

### show

Show a clip run manifest.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js show --run 20260505-203011-instant-deal-alerts-1
```

- `--run` — run id (required; positional also accepted)
- `--base-dir` — override `generated-clips` dir
- `--json` — emit JSON

### publish

Publish an existing clip run.

```bash
node aiwholesail-api/bin/aiwholesail-clip.js publish --run <runId> --platforms youtube,tiktok
```

- `--run` — run id (required; positional also accepted)
- `--platforms` — subset (default: `youtube,instagram,facebook,tiktok`)
- `--dry-run` — run publish flow without uploading
- `--base-dir` — override `generated-clips` dir
- `--json` — emit JSON

## Run Output

Each `make` invocation writes one run dir per segment under `aiwholesail-api/generated-clips/<runId>/`, where `<runId>` is `YYYYMMDD-HHMMSS-<slug>-<n>` in UTC. The dir contains `manifest.json` (full run record: source path, segment timecodes, aspect, theme, asset paths, public URL, per-platform publish results, brief), `brief.json` (caption + hashtags + per-platform copy that was sent to `socialAutomation`), `source-info.json` (probe output for the source plus the resolved segment), and `clip-NN.mp4` (the rendered short, unless `--skip-render` was passed). `runs` and `show` read these manifests; `publish` updates `manifest.json` in place with new `publishResults` and an `updatedAt` stamp.

## Troubleshooting

- `drawtext` filter missing → reinstall `ffmpeg` with `libfreetype`. Caption burn-in is silently skipped without it (caption still flows to social copy).
- `subtitles` filter missing → reinstall `ffmpeg` with `libass`. Subtitle burn-in is silently skipped without it.
- `yt-dlp` missing → `pip install yt-dlp` (or `brew install yt-dlp`). Required only for `fetch`.
- Instagram publish fails with no public URL → set `SOCIAL_PUBLIC_BASE_URL` so the IG Graph upload can reach the rendered MP4.
- `OPENAI_API_KEY is required` → set the key in `aiwholesail-api/.env` before running `transcribe` or `suggest`.
- Whitelisted IP / DNS errors are unrelated to this CLI; this tool only touches `ffmpeg`, `yt-dlp`, OpenAI, and the social publish APIs.
