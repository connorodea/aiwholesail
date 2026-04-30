"""
Poll Replicate predictions until complete, download avatar videos,
then composite final ads with ffmpeg.
"""
import replicate
import os
import time
import requests
import subprocess

ADS_DIR = os.path.dirname(os.path.abspath(__file__))
MP4_DIR = os.path.join(ADS_DIR, "mp4")
AVATAR_DIR = os.path.join(ADS_DIR, "avatar")
FINAL_DIR = os.path.join(ADS_DIR, "final")
os.makedirs(FINAL_DIR, exist_ok=True)

# Get prediction IDs
PRED_IDS = {
    "avatar-story": "k459wxby05rmr0cxvkjt9ym20g",
    "avatar-short": "9xgsrxbtfdrmr0cxvkjtryy7pr",
    "avatar-facebook": "smqa8rkprdrmw0cxvkjsxb5bg0",
}

# Phase 1: Poll until all complete
print("=== Phase 1: Waiting for Kling avatar videos ===")
pending = dict(PRED_IDS)
while pending:
    time.sleep(15)
    still_waiting = {}
    for name, pid in pending.items():
        pred = replicate.predictions.get(pid)
        print(f"  {name}: {pred.status}")
        if pred.status == "succeeded":
            url = pred.output
            out_path = os.path.join(MP4_DIR, f"{name}.mp4")
            print(f"    Downloading: {url}")
            resp = requests.get(url)
            with open(out_path, "wb") as f:
                f.write(resp.content)
            print(f"    Saved: {out_path} ({len(resp.content)/1024/1024:.1f}MB)")
        elif pred.status == "failed":
            print(f"    FAILED: {pred.error}")
        else:
            still_waiting[name] = pid
    pending = still_waiting
    if pending:
        print(f"  ... {len(pending)} still processing, waiting 15s ...")

print("\n=== Phase 1 complete! All avatar videos downloaded. ===")

# Phase 2: Get video durations
def get_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())

fb_dur = get_duration(os.path.join(MP4_DIR, "avatar-facebook.mp4"))
short_dur = get_duration(os.path.join(MP4_DIR, "avatar-short.mp4"))
story_dur = get_duration(os.path.join(MP4_DIR, "avatar-story.mp4"))
print(f"\nDurations: FB={fb_dur:.1f}s, Short={short_dur:.1f}s, Story={story_dur:.1f}s")

# Phase 3: Build composite ads
print("\n=== Phase 2: Building composite ads ===")

def run_ffmpeg(name, cmd):
    print(f"\n--- Building: {name} ---")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(f"  FFMPEG ERROR: {result.stderr[-500:]}")
    else:
        out = cmd[-1]
        size = os.path.getsize(out) / 1024 / 1024
        print(f"  Done: {out} ({size:.1f}MB)")

# ── AD 1: Facebook Square 1080x1080 ──
# Split screen: site demo top, avatar bottom-right with dark bg
run_ffmpeg("FB Square 1080x1080", [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", f"color=c=0x0b1120:s=1080x1080:d={fb_dur},format=yuv420p",
    "-i", os.path.join(MP4_DIR, "aiwholesail-desktop-demo.mp4"),
    "-i", os.path.join(MP4_DIR, "avatar-facebook.mp4"),
    "-filter_complex",
    f"[1:v]scale=1000:556:force_original_aspect_ratio=decrease,pad=1000:556:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setpts=PTS-STARTPTS[desktop];"
    f"[2:v]scale=360:360:force_original_aspect_ratio=decrease,pad=360:360:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];"
    f"[0:v][desktop]overlay=40:40:shortest=1[bg1];"
    f"[bg1][avatar]overlay=680:680:shortest=1[base];"
    f"[base]drawtext=text='AIWHOLESAIL':fontsize=32:fontcolor=0x2dd4a3:x=40:y=h-50:fontfile=/System/Library/Fonts/Helvetica.ttc,"
    f"drawtext=text='aiwholesail.com':fontsize=24:fontcolor=0x2dd4a3@0.8:x=w-text_w-40:y=h-50:fontfile=/System/Library/Fonts/Helvetica.ttc,"
    f"drawtext=text='Start Your 7-Day Free Trial':fontsize=30:fontcolor=white:x=(w-text_w)/2:y=620:fontfile=/System/Library/Fonts/Helvetica.ttc:enable='gte(t,{fb_dur-10})'[out]",
    "-map", "[out]", "-map", "2:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-t", str(fb_dur),
    os.path.join(FINAL_DIR, "aiwholesail-fb-square-avatar.mp4")
])

# ── AD 2: Story/TikTok Vertical 1080x1920 ──
# Avatar upper portion, mobile site demo lower portion
run_ffmpeg("Story/TikTok 1080x1920", [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", f"color=c=0x0b1120:s=1080x1920:d={story_dur},format=yuv420p",
    "-i", os.path.join(MP4_DIR, "avatar-story.mp4"),
    "-i", os.path.join(MP4_DIR, "aiwholesail-mobile-demo.mp4"),
    "-filter_complex",
    f"[1:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];"
    f"[2:v]scale=600:780:force_original_aspect_ratio=decrease,pad=600:780:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setpts=PTS-STARTPTS[mobile];"
    f"[0:v][avatar]overlay=0:60:shortest=1[bg1];"
    f"[bg1][mobile]overlay=240:1080:shortest=1[base];"
    f"[base]drawtext=text='AIWHOLESAIL':fontsize=36:fontcolor=0x2dd4a3:x=(w-text_w)/2:y=20:fontfile=/System/Library/Fonts/Helvetica.ttc,"
    f"drawtext=text='aiwholesail.com | Free Trial':fontsize=28:fontcolor=0x2dd4a3:x=(w-text_w)/2:y=h-50:fontfile=/System/Library/Fonts/Helvetica.ttc[out]",
    "-map", "[out]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-t", str(story_dur),
    os.path.join(FINAL_DIR, "aiwholesail-story-avatar.mp4")
])

# ── AD 3: Landscape 1200x628 ──
# Avatar left, desktop demo right
run_ffmpeg("Landscape 1200x628", [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", f"color=c=0x0b1120:s=1200x628:d={short_dur},format=yuv420p",
    "-i", os.path.join(MP4_DIR, "avatar-short.mp4"),
    "-i", os.path.join(MP4_DIR, "aiwholesail-desktop-demo.mp4"),
    "-filter_complex",
    f"[1:v]scale=400:400:force_original_aspect_ratio=decrease,pad=400:400:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];"
    f"[2:v]scale=740:420:force_original_aspect_ratio=decrease,pad=740:420:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setpts=PTS-STARTPTS[desktop];"
    f"[0:v][avatar]overlay=20:114:shortest=1[bg1];"
    f"[bg1][desktop]overlay=440:104:shortest=1[base];"
    f"[base]drawtext=text='AIWHOLESAIL':fontsize=24:fontcolor=0x2dd4a3:x=20:y=h-40:fontfile=/System/Library/Fonts/Helvetica.ttc,"
    f"drawtext=text='aiwholesail.com':fontsize=20:fontcolor=0x2dd4a3@0.8:x=w-text_w-20:y=h-40:fontfile=/System/Library/Fonts/Helvetica.ttc[out]",
    "-map", "[out]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-t", str(short_dur),
    os.path.join(FINAL_DIR, "aiwholesail-landscape-avatar.mp4")
])

# ── AD 4: Full avatar with branding (1080x1080) ──
# Avatar fills frame, branding overlay
run_ffmpeg("Avatar Full Square 1080x1080", [
    "ffmpeg", "-y",
    "-i", os.path.join(MP4_DIR, "avatar-facebook.mp4"),
    "-filter_complex",
    f"[0:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[base];"
    f"[base]drawtext=text='AIWHOLESAIL':fontsize=36:fontcolor=0x2dd4a3:x=(w-text_w)/2:y=30:fontfile=/System/Library/Fonts/Helvetica.ttc,"
    f"drawtext=text='Find Profitable Real Estate Deals with AI':fontsize=26:fontcolor=white@0.9:x=(w-text_w)/2:y=h-90:fontfile=/System/Library/Fonts/Helvetica.ttc:enable='lte(t,8)',"
    f"drawtext=text='Smart Search | AI Analysis | Deal Alerts':fontsize=24:fontcolor=white@0.8:x=(w-text_w)/2:y=h-90:fontfile=/System/Library/Fonts/Helvetica.ttc:enable='between(t,10,20)',"
    f"drawtext=text='Start Your 7-Day Free Trial':fontsize=30:fontcolor=white:x=(w-text_w)/2:y=h-100:fontfile=/System/Library/Fonts/Helvetica.ttc:enable='gte(t,{fb_dur-10})',"
    f"drawtext=text='aiwholesail.com':fontsize=28:fontcolor=0x2dd4a3:x=(w-text_w)/2:y=h-50:fontfile=/System/Library/Fonts/Helvetica.ttc[out]",
    "-map", "[out]", "-map", "0:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    os.path.join(FINAL_DIR, "aiwholesail-avatar-full.mp4")
])

# ── AD 5: Avatar circle overlay on site recording (1080x1920 story) ──
# Full mobile site recording with avatar circle bottom-right
run_ffmpeg("Story Site + Avatar PiP 1080x1920", [
    "ffmpeg", "-y",
    "-i", os.path.join(MP4_DIR, "aiwholesail-mobile-demo.mp4"),
    "-i", os.path.join(MP4_DIR, "avatar-story.mp4"),
    "-filter_complex",
    f"[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setpts=PTS-STARTPTS[site];"
    f"[1:v]scale=300:300:force_original_aspect_ratio=decrease,pad=300:300:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];"
    f"[site][avatar]overlay=740:1560:shortest=1[base];"
    f"[base]drawtext=text='AIWHOLESAIL':fontsize=32:fontcolor=0x2dd4a3:x=40:y=40:fontfile=/System/Library/Fonts/Helvetica.ttc,"
    f"drawtext=text='aiwholesail.com':fontsize=24:fontcolor=0x2dd4a3:x=40:y=80:fontfile=/System/Library/Fonts/Helvetica.ttc[out]",
    "-map", "[out]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-t", str(story_dur),
    os.path.join(FINAL_DIR, "aiwholesail-story-pip-avatar.mp4")
])

print("\n=== All composite ads complete! ===")
print(f"\nFiles in {FINAL_DIR}:")
for f in sorted(os.listdir(FINAL_DIR)):
    if f.endswith(".mp4"):
        size = os.path.getsize(os.path.join(FINAL_DIR, f)) / 1024 / 1024
        print(f"  {f} ({size:.1f}MB)")
