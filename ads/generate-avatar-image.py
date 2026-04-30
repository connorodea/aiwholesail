import openai
import os
import requests

client = openai.OpenAI()

AVATAR_DIR = os.path.join(os.path.dirname(__file__), "avatar")

print("Generating avatar image via DALL-E...")
response = client.images.generate(
    model="dall-e-3",
    prompt="Professional headshot portrait of a confident young male tech entrepreneur in his late 20s, wearing a dark navy blazer over a black t-shirt, clean shaven, short dark hair, warm smile, looking directly at camera, solid dark background with subtle teal/cyan accent lighting on one side, high-end studio photography quality, shoulders and head visible, 4K detail, photorealistic",
    size="1024x1024",
    quality="hd",
    n=1,
)

image_url = response.data[0].url
print(f"Image URL: {image_url[:80]}...")

# Download the image
img_data = requests.get(image_url).content
out_path = os.path.join(AVATAR_DIR, "avatar-presenter.png")
with open(out_path, "wb") as f:
    f.write(img_data)

print(f"Saved: {out_path} ({len(img_data) / 1024:.0f}KB)")
