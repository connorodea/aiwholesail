#!/bin/bash
set -euo pipefail

ADS_DIR="$(cd "$(dirname "$0")" && pwd)"
MP4_DIR="$ADS_DIR/mp4"
AVATAR_DIR="$ADS_DIR/avatar"
FINAL_DIR="$ADS_DIR/final"
mkdir -p "$FINAL_DIR"

# Check that avatar videos exist
if [ ! -f "$MP4_DIR/avatar-facebook.mp4" ]; then
  echo "ERROR: Avatar videos not yet ready. Run generate-avatar-videos.py first."
  exit 1
fi

echo "=== Building Final Composite Ads ==="

# Get durations
FB_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$MP4_DIR/avatar-facebook.mp4" | cut -d. -f1)
SHORT_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$MP4_DIR/avatar-short.mp4" | cut -d. -f1)
STORY_DUR=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$MP4_DIR/avatar-story.mp4" | cut -d. -f1)

echo "Avatar durations: FB=${FB_DUR}s, Short=${SHORT_DUR}s, Story=${STORY_DUR}s"

# ═══════════════════════════════════════════════════════
# AD 1: Facebook Square (1080x1080)
# Avatar bottom-right circle + desktop demo fills the rest
# Agenforce aesthetic: dark bg, dotted pattern, cyan glow
# ═══════════════════════════════════════════════════════
echo ""
echo "--- Building: Facebook Square 1080x1080 ---"

# Trim the desktop demo to match avatar duration
ffmpeg -y -i "$MP4_DIR/aiwholesail-desktop-demo.mp4" -t "$FB_DUR" \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  "$FINAL_DIR/tmp-desktop-trimmed.mp4" 2>/dev/null

# Scale desktop demo to fit the upper portion (1080x720)
# Avatar circle in bottom area (1080x360)
ffmpeg -y \
  -f lavfi -i "color=c=0x0b1120:s=1080x1080:d=$FB_DUR,format=yuv420p" \
  -i "$FINAL_DIR/tmp-desktop-trimmed.mp4" \
  -i "$MP4_DIR/avatar-facebook.mp4" \
  -filter_complex "
    [1:v]scale=1000:556:force_original_aspect_ratio=decrease,pad=1000:556:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[desktop];
    [desktop]format=yuva420p,
      geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='255*if(gt(X,10)*gt(Y,10)*lt(X,990)*lt(Y,546),255,0)/255'[desktop_masked];
    [2:v]scale=360:360:force_original_aspect_ratio=decrease[avatar_raw];
    [avatar_raw]format=yuva420p,
      geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':
      a='if(lte(pow(X-180,2)+pow(Y-180,2),pow(175,2)),255,0)'[avatar_circle];
    [0:v][desktop_masked]overlay=40:40[bg1];
    [bg1][avatar_circle]overlay=680:680[out]
  " \
  -map "[out]" -map 2:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  -t "$FB_DUR" \
  "$FINAL_DIR/aiwholesail-fb-square-avatar.mp4" 2>/dev/null

echo "  Done: aiwholesail-fb-square-avatar.mp4"

# ═══════════════════════════════════════════════════════
# AD 2: Instagram Story / TikTok (1080x1920)
# Avatar top half + mobile demo bottom half
# ═══════════════════════════════════════════════════════
echo ""
echo "--- Building: Story/TikTok 1080x1920 ---"

# Trim mobile demo
ffmpeg -y -i "$MP4_DIR/aiwholesail-mobile-demo.mp4" -t "$STORY_DUR" \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  "$FINAL_DIR/tmp-mobile-trimmed.mp4" 2>/dev/null

ffmpeg -y \
  -f lavfi -i "color=c=0x0b1120:s=1080x1920:d=$STORY_DUR,format=yuv420p" \
  -i "$MP4_DIR/avatar-story.mp4" \
  -i "$FINAL_DIR/tmp-mobile-trimmed.mp4" \
  -filter_complex "
    [1:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];
    [2:v]scale=700:1400:force_original_aspect_ratio=decrease[mobile];
    [0:v][avatar]overlay=0:0[bg1];
    [bg1][mobile]overlay=(1080-700)/2:1000[out]
  " \
  -map "[out]" -map 1:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  -t "$STORY_DUR" \
  "$FINAL_DIR/aiwholesail-story-avatar.mp4" 2>/dev/null

echo "  Done: aiwholesail-story-avatar.mp4"

# ═══════════════════════════════════════════════════════
# AD 3: Facebook Landscape (1200x628)
# Avatar left side + desktop demo right side
# ═══════════════════════════════════════════════════════
echo ""
echo "--- Building: Landscape 1200x628 ---"

ffmpeg -y -i "$MP4_DIR/aiwholesail-desktop-demo.mp4" -t "$SHORT_DUR" \
  -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p \
  "$FINAL_DIR/tmp-desktop-short.mp4" 2>/dev/null

ffmpeg -y \
  -f lavfi -i "color=c=0x0b1120:s=1200x628:d=$SHORT_DUR,format=yuv420p" \
  -i "$MP4_DIR/avatar-short.mp4" \
  -i "$FINAL_DIR/tmp-desktop-short.mp4" \
  -filter_complex "
    [1:v]scale=420:420:force_original_aspect_ratio=decrease,pad=420:420:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];
    [2:v]scale=720:400:force_original_aspect_ratio=decrease,pad=720:400:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[desktop];
    [0:v][avatar]overlay=20:104[bg1];
    [bg1][desktop]overlay=460:114[out]
  " \
  -map "[out]" -map 1:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  -t "$SHORT_DUR" \
  "$FINAL_DIR/aiwholesail-landscape-avatar.mp4" 2>/dev/null

echo "  Done: aiwholesail-landscape-avatar.mp4"

# ═══════════════════════════════════════════════════════
# AD 4: Standalone avatar with text overlays (1080x1080)
# Full avatar with animated text burned in
# ═══════════════════════════════════════════════════════
echo ""
echo "--- Building: Avatar-only square 1080x1080 ---"

ffmpeg -y \
  -f lavfi -i "color=c=0x0b1120:s=1080x1080:d=$FB_DUR,format=yuv420p" \
  -i "$MP4_DIR/avatar-facebook.mp4" \
  -filter_complex "
    [1:v]scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b1120[avatar];
    [0:v][avatar]overlay=0:0[base];
    [base]drawtext=text='AIWholesail':fontsize=36:fontcolor=0x2dd4a3:x=(w-text_w)/2:y=40:font=Arial:fontfile=/System/Library/Fonts/Supplemental/Arial\ Bold.ttf,
    drawtext=text='aiwholesail.com':fontsize=28:fontcolor=0x2dd4a3:x=(w-text_w)/2:y=h-60:font=Arial:fontfile=/System/Library/Fonts/Supplemental/Arial\ Bold.ttf,
    drawtext=text='Start Your 7-Day Free Trial':fontsize=32:fontcolor=white:x=(w-text_w)/2:y=h-100:font=Arial:fontfile=/System/Library/Fonts/Supplemental/Arial\ Bold.ttf:enable='gte(t,${FB_DUR}-8)'[out]
  " \
  -map "[out]" -map 1:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  -t "$FB_DUR" \
  "$FINAL_DIR/aiwholesail-avatar-square.mp4" 2>/dev/null

echo "  Done: aiwholesail-avatar-square.mp4"

# Cleanup
rm -f "$FINAL_DIR"/tmp-*.mp4

echo ""
echo "=== All composite ads built! ==="
ls -lah "$FINAL_DIR"/*.mp4
