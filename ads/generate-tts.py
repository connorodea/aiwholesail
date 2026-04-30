import openai
import os

client = openai.OpenAI()

AVATAR_DIR = os.path.join(os.path.dirname(__file__), "avatar")

# Script 1: Facebook Feed (30s pitch)
script_facebook = """Hey, real estate investors. Stop scrolling. I need to show you something that's going to change how you find deals.

This is AIWholesail. It's an AI platform that finds profitable real estate deals for you, automatically.

Search any market, any city, any zip code. The AI instantly finds undervalued properties and shows you the spread. It calculates your profit before you even make an offer.

The AI does full due diligence in seconds. Comparable sales, estimated value after repairs, and an investment score. No more guessing.

Set your criteria, and AIWholesail sends you instant alerts when properties with plus thirty thousand dollar spreads hit the market.

Whether you're a wholesaler, flipper, landlord, or agent, this is your unfair advantage.

Start your 7-day free trial at aiwholesail.com. No credit card required."""

# Script 2: Instagram/TikTok (15-20s quick hit)
script_short = """Real estate investors, your competitors are already using AI to find deals. Are you?

AIWholesail uses artificial intelligence to find profitable properties you'd never find on your own.

Search any market. Boom. Instant results sorted by profit potential. AI analyzes every property, calculates spreads, and scores each investment.

Seven day free trial. No credit card. Go to aiwholesail.com right now."""

# Script 3: Story/Retargeting (20s personal)
script_story = """I found three deals in one day using AI. Here's how.

I used AIWholesail. You type in a city or zip code, and it instantly shows you every property with profit potential, sorted by the best deals first.

The AI does full property analysis in seconds. Comps, ARV, investment score, spread analysis, all automatic.

Then I set up deal alerts. Whenever a property with over thirty K in spread hits my market, I get notified instantly.

Try it free for 7 days at aiwholesail.com."""

scripts = [
    ("facebook-pitch", script_facebook, "onyx"),
    ("short-hook", script_short, "onyx"),
    ("story-personal", script_story, "onyx"),
]

for name, text, voice in scripts:
    print(f"Generating TTS: {name} (voice: {voice})...")
    response = client.audio.speech.create(
        model="tts-1-hd",
        voice=voice,
        input=text,
        speed=1.05,
    )
    out_path = os.path.join(AVATAR_DIR, f"{name}.mp3")
    response.stream_to_file(out_path)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"  Saved: {out_path} ({size_kb:.0f}KB)")

print("\nAll TTS audio generated!")
