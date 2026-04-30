import replicate
import os
import time
import requests
import base64

AVATAR_DIR = os.path.join(os.path.dirname(__file__), "avatar")
MP4_DIR = os.path.join(os.path.dirname(__file__), "mp4")
os.makedirs(MP4_DIR, exist_ok=True)

# Read files as data URIs for Replicate
def file_to_data_uri(path, mime):
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    return f"data:{mime};base64,{data}"

avatar_image = os.path.join(AVATAR_DIR, "avatar-presenter.png")

jobs = [
    {
        "name": "avatar-facebook",
        "audio": os.path.join(AVATAR_DIR, "facebook-pitch.mp3"),
        "prompt": "a confident tech entrepreneur presenting a software product, enthusiastic and professional, looking at camera, slight head movements",
    },
    {
        "name": "avatar-short",
        "audio": os.path.join(AVATAR_DIR, "short-hook.mp3"),
        "prompt": "an energetic young entrepreneur giving a fast-paced pitch, bold and urgent tone, looking directly at camera",
    },
    {
        "name": "avatar-story",
        "audio": os.path.join(AVATAR_DIR, "story-personal.mp3"),
        "prompt": "a relatable young entrepreneur sharing a personal success story, authentic and excited, looking at camera with natural gestures",
    },
]

# Submit all predictions in parallel
predictions = []
for job in jobs:
    print(f"Submitting: {job['name']}...")

    # Use file handles for Replicate
    prediction = replicate.predictions.create(
        model="kwaivgi/kling-avatar-v2",
        input={
            "mode": "pro",
            "image": open(avatar_image, "rb"),
            "audio": open(job["audio"], "rb"),
            "prompt": job["prompt"],
        },
    )
    predictions.append((job["name"], prediction))
    print(f"  Prediction ID: {prediction.id}")

# Poll for completion
print("\nWaiting for all predictions to complete...")
results = {}
while predictions:
    time.sleep(10)
    still_pending = []
    for name, pred in predictions:
        pred.reload()
        status = pred.status
        print(f"  {name}: {status}")

        if status == "succeeded":
            output_url = pred.output
            print(f"    Output: {output_url}")

            # Download the video
            out_path = os.path.join(MP4_DIR, f"{name}.mp4")
            resp = requests.get(output_url)
            with open(out_path, "wb") as f:
                f.write(resp.content)
            print(f"    Saved: {out_path} ({len(resp.content) / 1024 / 1024:.1f}MB)")
            results[name] = out_path
        elif status == "failed":
            print(f"    FAILED: {pred.error}")
        else:
            still_pending.append((name, pred))

    predictions = still_pending
    if predictions:
        print(f"  Still waiting on {len(predictions)} predictions...")

print(f"\n=== Done! Generated {len(results)} avatar videos ===")
for name, path in results.items():
    print(f"  {name}: {path}")
