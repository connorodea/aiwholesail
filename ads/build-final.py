"""
Build final composite ads using ffmpeg overlay (no drawtext).
Text overlays will be baked in via a separate HTML overlay pass.
"""
import os
import subprocess

ADS_DIR = os.path.dirname(os.path.abspath(__file__))
MP4_DIR = os.path.join(ADS_DIR, "mp4")
FINAL_DIR = os.path.join(ADS_DIR, "final")
os.makedirs(FINAL_DIR, exist_ok=True)

def get_duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())

def run(name, cmd):
    print(f"\n--- Building: {name} ---")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr[-300:]}")
        return False
    out = cmd[-1]
    size = os.path.getsize(out) / 1024 / 1024
    print(f"  Done: {out} ({size:.1f}MB)")
    return True

fb_dur = get_duration(os.path.join(MP4_DIR, "avatar-facebook.mp4"))
short_dur = get_duration(os.path.join(MP4_DIR, "avatar-short.mp4"))
story_dur = get_duration(os.path.join(MP4_DIR, "avatar-story.mp4"))
print(f"Durations: FB={fb_dur:.1f}s, Short={short_dur:.1f}s, Story={story_dur:.1f}s")

# ── AD 1: Facebook Square 1080x1080 ──
# Desktop demo upper 2/3, avatar bottom-right
run("FB Square 1080x1080", [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", f"color=c=0x0b1120:s=1080x1080:d={fb_dur},format=yuv420p",
    "-i", os.path.join(MP4_DIR, "aiwholesail-desktop-demo.mp4"),
    "-i", os.path.join(MP4_DIR, "avatar-facebook.mp4"),
    "-filter_complex",
    f"[1:v]scale=980:545:force_original_aspect_ratio=decrease,pad=980:545:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setpts=PTS-STARTPTS[desktop];"
    f"[2:v]scale=380:380:force_original_aspect_ratio=decrease,pad=380:380:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];"
    f"[0:v][desktop]overlay=50:50:shortest=1[bg1];"
    f"[bg1][avatar]overlay=660:660:shortest=1[out]",
    "-map", "[out]", "-map", "2:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-t", str(fb_dur),
    os.path.join(FINAL_DIR, "aiwholesail-fb-square-avatar.mp4")
])

# ── AD 2: Story/TikTok 1080x1920 ──
# Avatar top, mobile site demo bottom
run("Story 1080x1920", [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", f"color=c=0x0b1120:s=1080x1920:d={story_dur},format=yuv420p",
    "-i", os.path.join(MP4_DIR, "avatar-story.mp4"),
    "-i", os.path.join(MP4_DIR, "aiwholesail-mobile-demo.mp4"),
    "-filter_complex",
    f"[1:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];"
    f"[2:v]scale=580:760:force_original_aspect_ratio=decrease,pad=580:760:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setpts=PTS-STARTPTS[mobile];"
    f"[0:v][avatar]overlay=0:40:shortest=1[bg1];"
    f"[bg1][mobile]overlay=250:1100:shortest=1[out]",
    "-map", "[out]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-t", str(story_dur),
    os.path.join(FINAL_DIR, "aiwholesail-story-avatar.mp4")
])

# ── AD 3: Landscape 1200x628 ──
# Avatar left, desktop demo right
run("Landscape 1200x628", [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", f"color=c=0x0b1120:s=1200x628:d={short_dur},format=yuv420p",
    "-i", os.path.join(MP4_DIR, "avatar-short.mp4"),
    "-i", os.path.join(MP4_DIR, "aiwholesail-desktop-demo.mp4"),
    "-filter_complex",
    f"[1:v]scale=420:420:force_original_aspect_ratio=decrease,pad=420:420:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];"
    f"[2:v]scale=720:400:force_original_aspect_ratio=decrease,pad=720:400:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setpts=PTS-STARTPTS[desktop];"
    f"[0:v][avatar]overlay=20:104:shortest=1[bg1];"
    f"[bg1][desktop]overlay=460:114:shortest=1[out]",
    "-map", "[out]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-t", str(short_dur),
    os.path.join(FINAL_DIR, "aiwholesail-landscape-avatar.mp4")
])

# ── AD 4: Full avatar (1080x1080) ──
# Avatar centered, just scaled
run("Avatar Full 1080x1080", [
    "ffmpeg", "-y",
    "-i", os.path.join(MP4_DIR, "avatar-facebook.mp4"),
    "-filter_complex",
    f"[0:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[out]",
    "-map", "[out]", "-map", "0:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    os.path.join(FINAL_DIR, "aiwholesail-avatar-full.mp4")
])

# ── AD 5: Mobile site + avatar PiP (1080x1920) ──
# Full site recording with small avatar overlay bottom-right
run("Story PiP 1080x1920", [
    "ffmpeg", "-y",
    "-i", os.path.join(MP4_DIR, "aiwholesail-mobile-demo.mp4"),
    "-i", os.path.join(MP4_DIR, "avatar-story.mp4"),
    "-filter_complex",
    f"[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0b1120,setpts=PTS-STARTPTS[site];"
    f"[1:v]scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];"
    f"[site][avatar]overlay=720:1550:shortest=1[out]",
    "-map", "[out]", "-map", "1:a",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    "-t", str(story_dur),
    os.path.join(FINAL_DIR, "aiwholesail-story-pip.mp4")
])

print("\n=== All final ads built! ===")
for f in sorted(os.listdir(FINAL_DIR)):
    if f.endswith(".mp4"):
        size = os.path.getsize(os.path.join(FINAL_DIR, f)) / 1024 / 1024
        dur = get_duration(os.path.join(FINAL_DIR, f))
        print(f"  {f} ({size:.1f}MB, {dur:.0f}s)")
