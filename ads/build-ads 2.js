const fs = require('fs');
const path = require('path');

const captureDir = path.join(__dirname, 'site-captures');

// Load base64 images
const heroB64 = fs.readFileSync(path.join(captureDir, 'hero-sm.b64'), 'utf8').replace(/\s/g, '');
const desktopHeroB64 = fs.readFileSync(path.join(captureDir, 'desktop-hero-sm.b64'), 'utf8').replace(/\s/g, '');
const desktopFeatB64 = fs.readFileSync(path.join(captureDir, 'desktop-features-sm.b64'), 'utf8').replace(/\s/g, '');
const howItWorksB64 = fs.readFileSync(path.join(captureDir, 'how-it-works-sm.b64'), 'utf8').replace(/\s/g, '');
const pricingB64 = fs.readFileSync(path.join(captureDir, 'pricing-sm.b64'), 'utf8').replace(/\s/g, '');

// ═══════════════════════════════════════════════════════
// AD 1: Square 1080x1080 — Feed Ad
// ═══════════════════════════════════════════════════════
const square = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1080">
<title>AIWholesail - Square Ad 1080x1080</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1080px; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; background: #0b1120; color: #fff; }
  .ad { width: 1080px; height: 1080px; position: relative; overflow: hidden; }

  .bg-gradient {
    position: absolute; inset: 0; z-index: 0;
    background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(45,212,163,0.1) 0%, transparent 60%),
                radial-gradient(ellipse 60% 40% at 80% 100%, rgba(20,80,120,0.15) 0%, transparent 60%),
                #0b1120;
  }
  .grid-overlay {
    position: absolute; inset: 0; z-index: 1;
    background-image: linear-gradient(rgba(45,212,163,0.025) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(45,212,163,0.025) 1px, transparent 1px);
    background-size: 60px 60px;
  }

  .scene { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; z-index: 10; opacity: 0; transform: translateY(30px); }

  /* Scene 1: Hook + app screenshot */
  .scene-1 { animation: sceneIn 0.8s 0.3s ease-out forwards, sceneOut 0.6s 4.5s ease-in forwards; }
  .scene-1 .badge { background: rgba(45,212,163,0.1); border: 1px solid rgba(45,212,163,0.25); border-radius: 50px; padding: 12px 28px; font-size: 18px; color: #2dd4a3; font-weight: 500; margin-bottom: 30px; opacity: 0; animation: fadeUp 0.5s 0.6s ease-out forwards; }
  .scene-1 h1 { font-size: 72px; font-weight: 900; text-align: center; line-height: 1.05; letter-spacing: -3px; }
  .scene-1 h1 span { color: #2dd4a3; }
  .scene-1 .sub { font-size: 24px; color: rgba(255,255,255,0.5); margin-top: 24px; text-align: center; line-height: 1.5; font-weight: 400; opacity: 0; animation: fadeUp 0.5s 1.2s ease-out forwards; }
  .scene-1 .url-tag { margin-top: 28px; font-size: 22px; font-weight: 700; color: #2dd4a3; letter-spacing: 1px; opacity: 0; animation: fadeUp 0.4s 1.5s ease-out forwards; }

  /* Scene 2: Phone mockup with real screenshot */
  .scene-2 { animation: sceneIn 0.8s 5.5s ease-out forwards, sceneOut 0.6s 10.5s ease-in forwards; }
  .scene-2 .phone-frame { width: 340px; height: 700px; border: 3px solid rgba(45,212,163,0.3); border-radius: 44px; overflow: hidden; box-shadow: 0 0 80px rgba(45,212,163,0.15), 0 30px 60px rgba(0,0,0,0.5); opacity: 0; animation: phoneAppear 0.8s 6.0s ease-out forwards; position: relative; }
  .scene-2 .phone-frame img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .scene-2 .phone-frame .phone-notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 120px; height: 30px; background: #0b1120; border-radius: 0 0 20px 20px; z-index: 2; }
  .scene-2 .phone-caption { font-size: 36px; font-weight: 700; margin-top: 40px; text-align: center; opacity: 0; animation: fadeUp 0.5s 6.8s ease-out forwards; }
  .scene-2 .phone-caption span { color: #2dd4a3; }

  /* Scene 3: Features from the real site */
  .scene-3 { animation: sceneIn 0.8s 11.5s ease-out forwards, sceneOut 0.6s 17.0s ease-in forwards; align-items: flex-start; padding: 90px; }
  .scene-3 .feat-heading { font-size: 48px; font-weight: 800; letter-spacing: -1.5px; margin-bottom: 50px; }
  .scene-3 .feat-heading span { color: #2dd4a3; }
  .scene-3 .feat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; width: 100%; }
  .scene-3 .feat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(45,212,163,0.12); border-radius: 20px; padding: 36px; opacity: 0; transform: scale(0.9); }
  .scene-3 .feat-card:nth-child(1) { animation: cardPop 0.5s 12.2s ease-out forwards; }
  .scene-3 .feat-card:nth-child(2) { animation: cardPop 0.5s 12.5s ease-out forwards; }
  .scene-3 .feat-card:nth-child(3) { animation: cardPop 0.5s 12.8s ease-out forwards; }
  .scene-3 .feat-card:nth-child(4) { animation: cardPop 0.5s 13.1s ease-out forwards; }
  .scene-3 .feat-card .feat-icon { font-size: 32px; margin-bottom: 14px; }
  .scene-3 .feat-card .feat-label { font-size: 14px; color: #2dd4a3; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .scene-3 .feat-card .feat-name { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
  .scene-3 .feat-card .feat-desc { font-size: 18px; color: rgba(255,255,255,0.5); line-height: 1.4; }

  /* Scene 4: CTA */
  .scene-4 { animation: sceneIn 0.8s 18.0s ease-out forwards; }
  .scene-4 .cta-headline { font-size: 58px; font-weight: 900; text-align: center; line-height: 1.15; letter-spacing: -2px; margin-bottom: 16px; }
  .scene-4 .cta-headline span { color: #2dd4a3; }
  .scene-4 .cta-sub { font-size: 26px; color: rgba(255,255,255,0.5); text-align: center; margin-bottom: 40px; opacity: 0; animation: fadeUp 0.5s 18.8s ease-out forwards; }
  .scene-4 .cta-btn { background: linear-gradient(135deg, #2dd4a3 0%, #1fb88a 100%); color: #0a0a0a; border: none; padding: 26px 64px; font-size: 28px; font-weight: 800; border-radius: 16px; cursor: pointer; opacity: 0; animation: btnAppear 0.6s 19.1s ease-out forwards, btnPulse 2s 20s ease-in-out infinite; box-shadow: 0 0 40px rgba(45,212,163,0.3); }
  .scene-4 .cta-details { display: flex; gap: 40px; margin-top: 28px; opacity: 0; animation: fadeUp 0.4s 19.5s ease-out forwards; }
  .scene-4 .cta-detail { font-size: 18px; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 8px; }
  .scene-4 .cta-detail .check { color: #2dd4a3; }
  .scene-4 .cta-url { margin-top: 36px; font-size: 28px; font-weight: 800; color: #2dd4a3; letter-spacing: 1px; opacity: 0; animation: fadeUp 0.4s 19.8s ease-out forwards; }

  /* Logo bar */
  .logo-bar { position: absolute; bottom: 36px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 14px; z-index: 20; opacity: 0; animation: fadeUp 0.5s 0.5s ease-out forwards; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #2dd4a3, #1a9e74); border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .logo-icon svg { width: 26px; height: 26px; fill: #0a0a0a; }
  .logo-text { font-size: 24px; font-weight: 700; letter-spacing: 1.5px; color: rgba(255,255,255,0.7); }

  @keyframes sceneIn { to { opacity: 1; transform: translateY(0); } }
  @keyframes sceneOut { to { opacity: 0; transform: translateY(-20px); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes cardPop { to { opacity: 1; transform: scale(1); } }
  @keyframes phoneAppear { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes btnAppear { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
  @keyframes btnPulse { 0%, 100% { box-shadow: 0 0 40px rgba(45,212,163,0.3); transform: scale(1); } 50% { box-shadow: 0 0 60px rgba(45,212,163,0.5); transform: scale(1.03); } }
</style>
</head>
<body>
<div class="ad">
  <div class="bg-gradient"></div>
  <div class="grid-overlay"></div>

  <div class="scene scene-1">
    <div class="badge">Trusted by Real Estate Professionals Nationwide</div>
    <h1>Find Profitable<br><span>Real Estate Deals.</span></h1>
    <div class="sub">Our AI finds undervalued properties, calculates<br>your profit instantly, and alerts you to new opportunities.</div>
    <div class="url-tag">aiwholesail.com</div>
  </div>

  <div class="scene scene-2">
    <div class="phone-frame">
      <div class="phone-notch"></div>
      <img src="data:image/jpeg;base64,${heroB64}" alt="AIWholesail App">
    </div>
    <div class="phone-caption">Your unfair advantage<br>in <span>real estate</span></div>
  </div>

  <div class="scene scene-3">
    <div class="feat-heading">How <span>AIWholesail</span> Works</div>
    <div class="feat-grid">
      <div class="feat-card">
        <div class="feat-label">Smart Search</div>
        <div class="feat-name">Find deals instantly</div>
        <div class="feat-desc">Search any market by city, zip, or address. Sorted by best deals first.</div>
      </div>
      <div class="feat-card">
        <div class="feat-label">Spread Analysis</div>
        <div class="feat-name">Know your profit</div>
        <div class="feat-desc">Compare listing prices to market values. Know your numbers instantly.</div>
      </div>
      <div class="feat-card">
        <div class="feat-label">AI Analysis</div>
        <div class="feat-name">AI due diligence</div>
        <div class="feat-desc">Full property analysis in seconds &mdash; ARV, comps, and investment score.</div>
      </div>
      <div class="feat-card">
        <div class="feat-label">Alerts</div>
        <div class="feat-name">Never miss a deal</div>
        <div class="feat-desc">Instant alerts when properties with +$30K spreads hit the market.</div>
      </div>
    </div>
  </div>

  <div class="scene scene-4">
    <div class="cta-headline">Start Your<br><span>7-Day Free Trial</span></div>
    <div class="cta-sub">No credit card required</div>
    <button class="cta-btn">Start Free Trial</button>
    <div class="cta-details">
      <div class="cta-detail"><span class="check">&#10003;</span> Cancel anytime</div>
      <div class="cta-detail"><span class="check">&#10003;</span> Full access</div>
      <div class="cta-detail"><span class="check">&#10003;</span> All features</div>
    </div>
    <div class="cta-url">aiwholesail.com</div>
  </div>

  <div class="logo-bar">
    <div class="logo-icon"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
    <span class="logo-text">AIWHOLESAIL</span>
  </div>
</div>
</body>
</html>`;

// ═══════════════════════════════════════════════════════
// AD 2: Story 1080x1920 — Instagram/Facebook Story
// ═══════════════════════════════════════════════════════
const story = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1080">
<title>AIWholesail - Story Ad 1080x1920</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1920px; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; background: #0b1120; color: #fff; }
  .ad { width: 1080px; height: 1920px; position: relative; overflow: hidden; }

  .bg-gradient { position: absolute; inset: 0; background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(45,212,163,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(20,80,120,0.1) 0%, transparent 60%), #0b1120; z-index: 0; }

  .particles { position: absolute; inset: 0; z-index: 1; overflow: hidden; }
  .particle { position: absolute; width: 3px; height: 3px; background: rgba(45,212,163,0.4); border-radius: 50%; }
  .particle:nth-child(1) { left: 10%; animation: float 8s 0s ease-in-out infinite; top: 20%; }
  .particle:nth-child(2) { left: 25%; animation: float 10s 1s ease-in-out infinite; top: 40%; }
  .particle:nth-child(3) { left: 45%; animation: float 7s 2s ease-in-out infinite; top: 60%; }
  .particle:nth-child(4) { left: 70%; animation: float 9s 0.5s ease-in-out infinite; top: 30%; }
  .particle:nth-child(5) { left: 85%; animation: float 11s 1.5s ease-in-out infinite; top: 75%; }
  .particle:nth-child(6) { left: 55%; animation: float 8s 3s ease-in-out infinite; top: 15%; }
  @keyframes float { 0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; } 50% { transform: translateY(-80px) scale(1.5); opacity: 0.7; } }

  .progress-bar { position: absolute; top: 0; left: 0; height: 4px; background: linear-gradient(90deg, #2dd4a3, #1fb88a); z-index: 50; width: 0; animation: progressFill 30s 0.2s linear forwards; box-shadow: 0 0 10px rgba(45,212,163,0.5); }
  @keyframes progressFill { to { width: 100%; } }

  .scene { position: absolute; inset: 0; display: flex; flex-direction: column; z-index: 10; opacity: 0; }

  /* Scene 1: Hook */
  .scene-1 { justify-content: center; align-items: center; padding: 100px; animation: fadeIn 0.8s 0.2s ease-out forwards, fadeOut 0.5s 4.0s ease-in forwards; }
  .scene-1 .badge { background: rgba(45,212,163,0.1); border: 1px solid rgba(45,212,163,0.25); border-radius: 50px; padding: 14px 32px; font-size: 20px; color: #2dd4a3; font-weight: 500; margin-bottom: 50px; opacity: 0; animation: fadeUp 0.5s 0.5s ease-out forwards; }
  .scene-1 h1 { font-size: 88px; font-weight: 900; text-align: center; line-height: 1.05; letter-spacing: -3px; opacity: 0; animation: fadeUp 0.7s 0.8s ease-out forwards; }
  .scene-1 h1 .em { color: #2dd4a3; }
  .scene-1 .tagline { font-size: 28px; color: rgba(255,255,255,0.5); text-align: center; margin-top: 30px; line-height: 1.5; opacity: 0; animation: fadeUp 0.5s 1.4s ease-out forwards; }

  /* Scene 2: Phone with real app */
  .scene-2 { justify-content: center; align-items: center; padding: 80px; animation: fadeIn 0.8s 5.0s ease-out forwards, fadeOut 0.5s 10.0s ease-in forwards; }
  .scene-2 .phone { width: 380px; height: 780px; border: 3px solid rgba(45,212,163,0.25); border-radius: 48px; overflow: hidden; box-shadow: 0 0 100px rgba(45,212,163,0.12), 0 40px 80px rgba(0,0,0,0.5); opacity: 0; animation: phoneSlide 0.8s 5.5s ease-out forwards; position: relative; }
  .scene-2 .phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .scene-2 .phone .notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 130px; height: 32px; background: #0b1120; border-radius: 0 0 22px 22px; z-index: 2; }
  .scene-2 .phone-label { font-size: 40px; font-weight: 700; margin-top: 50px; text-align: center; opacity: 0; animation: fadeUp 0.6s 6.5s ease-out forwards; }
  .scene-2 .phone-label span { color: #2dd4a3; }
  .scene-2 .url { font-size: 24px; color: #2dd4a3; font-weight: 600; margin-top: 16px; opacity: 0; animation: fadeUp 0.4s 7.0s ease-out forwards; }

  /* Scene 3: Features */
  .scene-3 { justify-content: center; padding: 100px 80px; animation: fadeIn 0.8s 11.0s ease-out forwards, fadeOut 0.5s 17.0s ease-in forwards; }
  .scene-3 .feat-title { font-size: 52px; font-weight: 800; margin-bottom: 60px; letter-spacing: -1px; opacity: 0; animation: fadeUp 0.6s 11.5s ease-out forwards; }
  .scene-3 .feat-title span { color: #2dd4a3; }
  .scene-3 .feat-row { display: flex; align-items: flex-start; gap: 24px; padding: 32px 36px; margin-bottom: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; opacity: 0; transform: translateX(-40px); }
  .scene-3 .feat-row:nth-child(2) { animation: slideRight 0.5s 12.0s ease-out forwards; }
  .scene-3 .feat-row:nth-child(3) { animation: slideRight 0.5s 12.3s ease-out forwards; }
  .scene-3 .feat-row:nth-child(4) { animation: slideRight 0.5s 12.6s ease-out forwards; }
  .scene-3 .feat-row:nth-child(5) { animation: slideRight 0.5s 12.9s ease-out forwards; }
  .scene-3 .feat-row:nth-child(6) { animation: slideRight 0.5s 13.2s ease-out forwards; }
  .scene-3 .feat-dot { width: 14px; height: 14px; background: #2dd4a3; border-radius: 50%; flex-shrink: 0; margin-top: 8px; box-shadow: 0 0 12px rgba(45,212,163,0.4); }
  .scene-3 .feat-content .feat-name { font-size: 28px; font-weight: 700; margin-bottom: 6px; }
  .scene-3 .feat-content .feat-desc { font-size: 22px; color: rgba(255,255,255,0.5); }

  /* Scene 4: Built for */
  .scene-4 { justify-content: center; align-items: center; padding: 100px; animation: fadeIn 0.8s 18.0s ease-out forwards, fadeOut 0.5s 23.0s ease-in forwards; }
  .scene-4 .built-label { font-size: 20px; color: #2dd4a3; letter-spacing: 4px; text-transform: uppercase; font-weight: 600; margin-bottom: 20px; opacity: 0; animation: fadeUp 0.5s 18.4s ease-out forwards; }
  .scene-4 .built-h { font-size: 56px; font-weight: 800; text-align: center; margin-bottom: 70px; opacity: 0; animation: fadeUp 0.6s 18.7s ease-out forwards; }
  .scene-4 .audience-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; width: 100%; }
  .scene-4 .audience-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 44px; text-align: center; opacity: 0; transform: scale(0.85); }
  .scene-4 .audience-card:nth-child(1) { animation: cardPop 0.5s 19.2s ease-out forwards; }
  .scene-4 .audience-card:nth-child(2) { animation: cardPop 0.5s 19.5s ease-out forwards; }
  .scene-4 .audience-card:nth-child(3) { animation: cardPop 0.5s 19.8s ease-out forwards; }
  .scene-4 .audience-card:nth-child(4) { animation: cardPop 0.5s 20.1s ease-out forwards; }
  .scene-4 .audience-card .a-icon { font-size: 42px; margin-bottom: 16px; }
  .scene-4 .audience-card .a-name { font-size: 28px; font-weight: 700; margin-bottom: 10px; }
  .scene-4 .audience-card .a-desc { font-size: 18px; color: rgba(255,255,255,0.5); line-height: 1.4; }

  /* Scene 5: CTA */
  .scene-5 { justify-content: center; align-items: center; padding: 100px; animation: fadeIn 0.8s 24.0s ease-out forwards; }
  .scene-5 .cta-h { font-size: 72px; font-weight: 900; text-align: center; line-height: 1.1; letter-spacing: -2px; margin-bottom: 16px; opacity: 0; animation: fadeUp 0.7s 24.5s ease-out forwards; }
  .scene-5 .cta-h span { color: #2dd4a3; }
  .scene-5 .cta-sub { font-size: 28px; color: rgba(255,255,255,0.5); text-align: center; margin-bottom: 50px; opacity: 0; animation: fadeUp 0.5s 25.0s ease-out forwards; }
  .scene-5 .cta-btn { background: linear-gradient(135deg, #2dd4a3, #1fb88a); color: #0a0a0a; border: none; padding: 32px 80px; font-size: 32px; font-weight: 800; border-radius: 18px; cursor: pointer; opacity: 0; animation: btnAppear 0.6s 25.5s ease-out forwards, btnPulse 2s 26.5s ease-in-out infinite; box-shadow: 0 0 50px rgba(45,212,163,0.35); }
  .scene-5 .cta-note { font-size: 22px; color: rgba(255,255,255,0.35); margin-top: 24px; opacity: 0; animation: fadeUp 0.4s 26.0s ease-out forwards; }
  .scene-5 .cta-url { font-size: 32px; font-weight: 800; color: #2dd4a3; margin-top: 50px; opacity: 0; animation: fadeUp 0.5s 26.5s ease-out forwards; }
  .scene-5 .logo-final { margin-top: 60px; display: flex; align-items: center; gap: 16px; opacity: 0; animation: fadeUp 0.5s 27.0s ease-out forwards; }
  .scene-5 .logo-final .logo-sq { width: 52px; height: 52px; background: linear-gradient(135deg, #2dd4a3, #1a9e74); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .scene-5 .logo-final .logo-sq svg { width: 30px; height: 30px; fill: #0a0a0a; }
  .scene-5 .logo-final .logo-name { font-size: 28px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.7); }

  @keyframes fadeIn { to { opacity: 1; } }
  @keyframes fadeOut { to { opacity: 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes cardPop { to { opacity: 1; transform: scale(1); } }
  @keyframes slideRight { to { opacity: 1; transform: translateX(0); } }
  @keyframes phoneSlide { from { opacity: 0; transform: translateY(60px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes btnAppear { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
  @keyframes btnPulse { 0%, 100% { box-shadow: 0 0 50px rgba(45,212,163,0.35); transform: scale(1); } 50% { box-shadow: 0 0 80px rgba(45,212,163,0.55); transform: scale(1.04); } }
</style>
</head>
<body>
<div class="ad">
  <div class="bg-gradient"></div>
  <div class="particles"><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div><div class="particle"></div></div>
  <div class="progress-bar"></div>

  <div class="scene scene-1">
    <div class="badge">Trusted by Real Estate Professionals Nationwide</div>
    <h1>Find Profitable<br><span class="em">Real Estate<br>Deals.</span></h1>
    <div class="tagline">Our AI finds undervalued properties, calculates<br>your profit, and alerts you instantly.</div>
  </div>

  <div class="scene scene-2">
    <div class="phone">
      <div class="notch"></div>
      <img src="data:image/jpeg;base64,${heroB64}" alt="AIWholesail App">
    </div>
    <div class="phone-label">Your unfair advantage<br>in <span>real estate</span></div>
    <div class="url">aiwholesail.com</div>
  </div>

  <div class="scene scene-3">
    <div class="feat-title">How <span>AIWholesail</span> Works</div>
    <div class="feat-row"><div class="feat-dot"></div><div class="feat-content"><div class="feat-name">Smart Search</div><div class="feat-desc">Search any market. Find deals instantly.</div></div></div>
    <div class="feat-row"><div class="feat-dot"></div><div class="feat-content"><div class="feat-name">Spread Analysis</div><div class="feat-desc">Know your profit before you offer.</div></div></div>
    <div class="feat-row"><div class="feat-dot"></div><div class="feat-content"><div class="feat-name">AI Due Diligence</div><div class="feat-desc">Full property analysis in seconds.</div></div></div>
    <div class="feat-row"><div class="feat-dot"></div><div class="feat-content"><div class="feat-name">Instant Alerts</div><div class="feat-desc">Get notified when +$30K spreads appear.</div></div></div>
    <div class="feat-row"><div class="feat-dot"></div><div class="feat-content"><div class="feat-name">Deal Pipeline</div><div class="feat-desc">Track every deal from contact to close.</div></div></div>
  </div>

  <div class="scene scene-4">
    <div class="built-label">Built For</div>
    <div class="built-h">Every real estate professional.</div>
    <div class="audience-grid">
      <div class="audience-card"><div class="a-icon">&#x1F4C8;</div><div class="a-name">Wholesalers</div><div class="a-desc">Find spreads, assign contracts, match buyers</div></div>
      <div class="audience-card"><div class="a-icon">&#x1F4B0;</div><div class="a-name">Flippers</div><div class="a-desc">Estimate renovation costs, values, and profit</div></div>
      <div class="audience-card"><div class="a-icon">&#x1F3E0;</div><div class="a-name">Landlords</div><div class="a-desc">Analyze cash flow, cap rates, rental potential</div></div>
      <div class="audience-card"><div class="a-icon">&#x1F465;</div><div class="a-name">Agents</div><div class="a-desc">Impress clients with AI-powered market data</div></div>
    </div>
  </div>

  <div class="scene scene-5">
    <div class="cta-h">Start Your<br><span>7-Day Free Trial</span></div>
    <div class="cta-sub">No credit card required</div>
    <button class="cta-btn">Start Free Trial</button>
    <div class="cta-note">Cancel anytime &middot; Full access</div>
    <div class="cta-url">aiwholesail.com</div>
    <div class="logo-final">
      <div class="logo-sq"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
      <span class="logo-name">AIWHOLESAIL</span>
    </div>
  </div>
</div>
</body>
</html>`;

// ═══════════════════════════════════════════════════════
// AD 3: Landscape 1200x628 — Feed Ad
// ═══════════════════════════════════════════════════════
const landscape = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1200">
<title>AIWholesail - Landscape Ad 1200x628</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 628px; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; background: #0b1120; color: #fff; }
  .ad { width: 1200px; height: 628px; position: relative; overflow: hidden; }

  .bg-glow { position: absolute; border-radius: 50%; filter: blur(100px); z-index: 0; }
  .bg-glow.g1 { width: 500px; height: 500px; background: radial-gradient(circle, rgba(45,212,163,0.15), transparent 70%); top: -200px; right: -100px; animation: gPulse 10s ease-in-out infinite; }
  .bg-glow.g2 { width: 400px; height: 400px; background: radial-gradient(circle, rgba(20,80,120,0.12), transparent 70%); bottom: -150px; left: -50px; animation: gPulse 10s 3s ease-in-out infinite; }
  @keyframes gPulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.1); } }
  .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(45,212,163,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,163,0.02) 1px, transparent 1px); background-size: 50px 50px; z-index: 1; }

  .scene { position: absolute; inset: 0; z-index: 10; opacity: 0; }

  /* Scene 1 */
  .scene-1 { display: flex; animation: fadeIn 0.7s 0.2s ease-out forwards, fadeOut 0.5s 5.0s ease-in forwards; }
  .scene-1 .left { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 50px 60px; }
  .scene-1 .left .badge { display: inline-block; background: rgba(45,212,163,0.1); border: 1px solid rgba(45,212,163,0.2); border-radius: 30px; padding: 8px 20px; font-size: 13px; color: #2dd4a3; font-weight: 500; margin-bottom: 20px; opacity: 0; animation: fadeUp 0.4s 0.5s ease-out forwards; width: fit-content; }
  .scene-1 .left h1 { font-size: 52px; font-weight: 900; line-height: 1.08; letter-spacing: -2px; opacity: 0; animation: fadeUp 0.7s 0.7s ease-out forwards; }
  .scene-1 .left h1 span { color: #2dd4a3; }
  .scene-1 .left .sub { font-size: 18px; color: rgba(255,255,255,0.5); margin-top: 16px; line-height: 1.5; opacity: 0; animation: fadeUp 0.5s 1.2s ease-out forwards; }
  .scene-1 .left .url { font-size: 18px; color: #2dd4a3; font-weight: 700; margin-top: 16px; opacity: 0; animation: fadeUp 0.4s 1.5s ease-out forwards; }
  .scene-1 .right { width: 380px; display: flex; align-items: center; justify-content: center; position: relative; }
  .scene-1 .phone-mock { width: 220px; height: 450px; border: 2px solid rgba(45,212,163,0.25); border-radius: 32px; overflow: hidden; box-shadow: 0 0 60px rgba(45,212,163,0.1), 0 20px 40px rgba(0,0,0,0.4); opacity: 0; animation: phoneSlide 0.8s 1.0s ease-out forwards; position: relative; }
  .scene-1 .phone-mock img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .scene-1 .phone-mock .notch { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 70px; height: 20px; background: #0b1120; border-radius: 0 0 14px 14px; z-index: 2; }

  /* Scene 2: Desktop screenshot */
  .scene-2 { display: flex; align-items: center; justify-content: center; padding: 40px; animation: fadeIn 0.7s 6.0s ease-out forwards, fadeOut 0.5s 11.0s ease-in forwards; }
  .scene-2 .desktop-frame { width: 900px; border: 2px solid rgba(45,212,163,0.15); border-radius: 12px; overflow: hidden; box-shadow: 0 0 60px rgba(45,212,163,0.08), 0 20px 40px rgba(0,0,0,0.4); opacity: 0; animation: desktopAppear 0.8s 6.5s ease-out forwards; }
  .scene-2 .desktop-frame .browser-bar { height: 32px; background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; padding: 0 14px; gap: 6px; }
  .scene-2 .desktop-frame .browser-bar .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.15); }
  .scene-2 .desktop-frame .browser-bar .url-bar { flex: 1; background: rgba(255,255,255,0.05); border-radius: 4px; height: 18px; margin-left: 12px; display: flex; align-items: center; padding: 0 10px; font-size: 10px; color: rgba(255,255,255,0.4); }
  .scene-2 .desktop-frame img { width: 100%; display: block; }
  .scene-2 .desktop-label { position: absolute; bottom: 50px; left: 0; right: 0; text-align: center; font-size: 24px; font-weight: 700; opacity: 0; animation: fadeUp 0.5s 7.5s ease-out forwards; }
  .scene-2 .desktop-label span { color: #2dd4a3; }

  /* Scene 3: CTA */
  .scene-3 { display: flex; animation: fadeIn 0.7s 12.0s ease-out forwards; }
  .scene-3 .left-cta { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 50px 60px; }
  .scene-3 .left-cta h2 { font-size: 48px; font-weight: 900; line-height: 1.1; letter-spacing: -2px; opacity: 0; animation: fadeUp 0.6s 12.5s ease-out forwards; }
  .scene-3 .left-cta h2 span { color: #2dd4a3; }
  .scene-3 .left-cta .features-mini { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 10px; opacity: 0; animation: fadeUp 0.5s 13.0s ease-out forwards; }
  .scene-3 .left-cta .feat-tag { background: rgba(45,212,163,0.06); border: 1px solid rgba(45,212,163,0.18); border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.7); }
  .scene-3 .right-cta { width: 380px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
  .scene-3 .right-cta .cta-btn { background: linear-gradient(135deg, #2dd4a3, #1fb88a); color: #0a0a0a; border: none; padding: 22px 50px; font-size: 22px; font-weight: 800; border-radius: 14px; cursor: pointer; opacity: 0; animation: btnAppear 0.6s 13.3s ease-out forwards, btnPulse 2s 14.3s ease-in-out infinite; box-shadow: 0 0 40px rgba(45,212,163,0.3); }
  .scene-3 .right-cta .cta-note { font-size: 14px; color: rgba(255,255,255,0.35); opacity: 0; animation: fadeUp 0.4s 13.7s ease-out forwards; }
  .scene-3 .right-cta .cta-url { font-size: 20px; font-weight: 800; color: #2dd4a3; margin-top: 8px; opacity: 0; animation: fadeUp 0.4s 14.0s ease-out forwards; }
  .scene-3 .right-cta .logo-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; opacity: 0; animation: fadeUp 0.4s 14.3s ease-out forwards; }
  .scene-3 .right-cta .logo-sq { width: 32px; height: 32px; background: linear-gradient(135deg, #2dd4a3, #1a9e74); border-radius: 7px; display: flex; align-items: center; justify-content: center; }
  .scene-3 .right-cta .logo-sq svg { width: 18px; height: 18px; fill: #0a0a0a; }
  .scene-3 .right-cta .logo-name { font-size: 18px; font-weight: 700; letter-spacing: 1.5px; color: rgba(255,255,255,0.6); }

  @keyframes fadeIn { to { opacity: 1; } }
  @keyframes fadeOut { to { opacity: 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes phoneSlide { from { opacity: 0; transform: translateX(40px) rotate(3deg); } to { opacity: 1; transform: translateX(0) rotate(0deg); } }
  @keyframes desktopAppear { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes btnAppear { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
  @keyframes btnPulse { 0%, 100% { box-shadow: 0 0 40px rgba(45,212,163,0.3); transform: scale(1); } 50% { box-shadow: 0 0 60px rgba(45,212,163,0.5); transform: scale(1.04); } }
</style>
</head>
<body>
<div class="ad">
  <div class="bg-glow g1"></div>
  <div class="bg-glow g2"></div>
  <div class="grid-bg"></div>

  <div class="scene scene-1">
    <div class="left">
      <div class="badge">Trusted by RE Professionals</div>
      <h1>Find Profitable<br><span>Real Estate Deals.</span></h1>
      <div class="sub">AI finds undervalued properties, calculates profit,<br>and alerts you the moment opportunities hit.</div>
      <div class="url">aiwholesail.com</div>
    </div>
    <div class="right">
      <div class="phone-mock">
        <div class="notch"></div>
        <img src="data:image/jpeg;base64,${heroB64}" alt="AIWholesail">
      </div>
    </div>
  </div>

  <div class="scene scene-2">
    <div class="desktop-frame">
      <div class="browser-bar">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        <div class="url-bar">aiwholesail.com</div>
      </div>
      <img src="data:image/jpeg;base64,${desktopFeatB64}" alt="AIWholesail Features">
    </div>
    <div class="desktop-label">Your unfair advantage in <span>real estate</span></div>
  </div>

  <div class="scene scene-3">
    <div class="left-cta">
      <h2>Start Your<br><span>7-Day Free Trial</span></h2>
      <div class="features-mini">
        <div class="feat-tag">Smart Search</div>
        <div class="feat-tag">Spread Analysis</div>
        <div class="feat-tag">AI Analysis</div>
        <div class="feat-tag">Deal Alerts</div>
        <div class="feat-tag">Pipeline</div>
      </div>
    </div>
    <div class="right-cta">
      <button class="cta-btn">Start Free Trial</button>
      <div class="cta-note">No credit card &middot; Cancel anytime</div>
      <div class="cta-url">aiwholesail.com</div>
      <div class="logo-row">
        <div class="logo-sq"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
        <span class="logo-name">AIWHOLESAIL</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

// ═══════════════════════════════════════════════════════
// AD 4: Retargeting 1080x1080
// ═══════════════════════════════════════════════════════
const retarget = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1080">
<title>AIWholesail - Retargeting Ad 1080x1080</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1080px; overflow: hidden; font-family: 'Inter', -apple-system, sans-serif; background: #0b1120; color: #fff; }
  .ad { width: 1080px; height: 1080px; position: relative; overflow: hidden; }

  .bg { position: absolute; inset: 0; z-index: 0; }
  .bg .ring { position: absolute; border: 1px solid rgba(45,212,163,0.05); border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%); }
  .bg .ring:nth-child(1) { width: 400px; height: 400px; animation: ringPulse 6s 0s ease-in-out infinite; }
  .bg .ring:nth-child(2) { width: 600px; height: 600px; animation: ringPulse 6s 1s ease-in-out infinite; }
  .bg .ring:nth-child(3) { width: 800px; height: 800px; animation: ringPulse 6s 2s ease-in-out infinite; }
  .bg .ring:nth-child(4) { width: 1000px; height: 1000px; animation: ringPulse 6s 3s ease-in-out infinite; }
  @keyframes ringPulse { 0%, 100% { opacity: 0.3; border-color: rgba(45,212,163,0.03); } 50% { opacity: 1; border-color: rgba(45,212,163,0.08); } }

  .bg-glow { position: absolute; width: 500px; height: 500px; top: 50%; left: 50%; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(45,212,163,0.1), transparent 70%); filter: blur(80px); animation: glowBreathe 8s ease-in-out infinite; }
  @keyframes glowBreathe { 0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); } 50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.2); } }

  .scene { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; z-index: 10; opacity: 0; }

  /* Scene 1: Before/After */
  .scene-1 { animation: fadeIn 0.7s 0.3s ease-out forwards, fadeOut 0.5s 5.5s ease-in forwards; padding: 80px 90px; }
  .scene-1 .ba-heading { font-size: 40px; font-weight: 800; text-align: center; margin-bottom: 50px; opacity: 0; animation: fadeUp 0.5s 0.6s ease-out forwards; }
  .scene-1 .ba-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; width: 100%; }
  .scene-1 .ba-col { opacity: 0; }
  .scene-1 .ba-col.before { animation: slideFromLeft 0.6s 1.0s ease-out forwards; }
  .scene-1 .ba-col.after { animation: slideFromRight 0.6s 1.4s ease-out forwards; }
  .scene-1 .ba-col .ba-label { font-size: 18px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 24px; padding-bottom: 14px; border-bottom: 2px solid; }
  .scene-1 .ba-col.before .ba-label { color: rgba(255,80,80,0.7); border-color: rgba(255,80,80,0.2); }
  .scene-1 .ba-col.after .ba-label { color: #2dd4a3; border-color: rgba(45,212,163,0.3); }
  .scene-1 .ba-item { display: flex; align-items: center; gap: 14px; padding: 14px 0; font-size: 22px; color: rgba(255,255,255,0.7); }
  .scene-1 .ba-item .icon { font-size: 22px; flex-shrink: 0; }
  .scene-1 .ba-col.before .ba-item { text-decoration: line-through; text-decoration-color: rgba(255,80,80,0.3); }

  /* Scene 2: App screenshot */
  .scene-2 { animation: fadeIn 0.7s 6.5s ease-out forwards, fadeOut 0.5s 12.0s ease-in forwards; }
  .scene-2 .desktop-wrap { width: 800px; border: 2px solid rgba(45,212,163,0.15); border-radius: 12px; overflow: hidden; box-shadow: 0 0 60px rgba(45,212,163,0.08); opacity: 0; animation: desktopAppear 0.8s 7.0s ease-out forwards; }
  .scene-2 .desktop-wrap .bar { height: 28px; background: rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; padding: 0 12px; gap: 5px; }
  .scene-2 .desktop-wrap .bar .dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.12); }
  .scene-2 .desktop-wrap .bar .url-bar { flex: 1; background: rgba(255,255,255,0.04); border-radius: 4px; height: 16px; margin-left: 10px; display: flex; align-items: center; padding: 0 8px; font-size: 9px; color: rgba(255,255,255,0.35); }
  .scene-2 .desktop-wrap img { width: 100%; display: block; }
  .scene-2 .app-label { font-size: 32px; font-weight: 700; margin-top: 36px; text-align: center; opacity: 0; animation: fadeUp 0.5s 8.0s ease-out forwards; }
  .scene-2 .app-label span { color: #2dd4a3; }

  /* Scene 3: CTA */
  .scene-3 { animation: fadeIn 0.7s 13.0s ease-out forwards; }
  .scene-3 .comeback { font-size: 28px; font-weight: 600; color: rgba(255,255,255,0.5); text-align: center; margin-bottom: 16px; opacity: 0; animation: fadeUp 0.5s 13.4s ease-out forwards; }
  .scene-3 .cta-h { font-size: 62px; font-weight: 900; text-align: center; line-height: 1.15; letter-spacing: -2px; opacity: 0; animation: fadeUp 0.6s 13.7s ease-out forwards; }
  .scene-3 .cta-h span { color: #2dd4a3; }
  .scene-3 .offer-box { background: linear-gradient(135deg, rgba(45,212,163,0.08), rgba(45,212,163,0.02)); border: 1px solid rgba(45,212,163,0.2); border-radius: 24px; padding: 36px 56px; margin-top: 36px; text-align: center; opacity: 0; animation: popIn 0.6s 14.2s ease-out forwards; }
  .scene-3 .offer-box .offer-main { font-size: 34px; font-weight: 800; color: #2dd4a3; }
  .scene-3 .offer-box .offer-detail { font-size: 20px; color: rgba(255,255,255,0.5); margin-top: 8px; }
  .scene-3 .cta-btn { margin-top: 36px; background: linear-gradient(135deg, #2dd4a3, #1fb88a); color: #0a0a0a; border: none; padding: 26px 64px; font-size: 26px; font-weight: 800; border-radius: 16px; cursor: pointer; opacity: 0; animation: btnAppear 0.6s 14.7s ease-out forwards, btnPulse 2s 15.7s ease-in-out infinite; box-shadow: 0 0 40px rgba(45,212,163,0.3); }
  .scene-3 .trust-badges { display: flex; gap: 36px; margin-top: 24px; opacity: 0; animation: fadeUp 0.4s 15.2s ease-out forwards; }
  .scene-3 .trust-badge { font-size: 16px; color: rgba(255,255,255,0.35); display: flex; align-items: center; gap: 8px; }
  .scene-3 .trust-badge .check { color: #2dd4a3; }
  .scene-3 .cta-url { margin-top: 24px; font-size: 26px; font-weight: 800; color: #2dd4a3; opacity: 0; animation: fadeUp 0.4s 15.5s ease-out forwards; }

  .logo-bar { position: absolute; bottom: 36px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 12px; z-index: 20; opacity: 0; animation: fadeUp 0.5s 0.5s ease-out forwards; }
  .logo-sq { width: 40px; height: 40px; background: linear-gradient(135deg, #2dd4a3, #1a9e74); border-radius: 9px; display: flex; align-items: center; justify-content: center; }
  .logo-sq svg { width: 24px; height: 24px; fill: #0a0a0a; }
  .logo-name { font-size: 22px; font-weight: 700; letter-spacing: 1.5px; color: rgba(255,255,255,0.6); }

  @keyframes fadeIn { to { opacity: 1; } }
  @keyframes fadeOut { to { opacity: 0; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes popIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
  @keyframes slideFromLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes slideFromRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes desktopAppear { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes btnAppear { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
  @keyframes btnPulse { 0%, 100% { box-shadow: 0 0 40px rgba(45,212,163,0.3); transform: scale(1); } 50% { box-shadow: 0 0 60px rgba(45,212,163,0.5); transform: scale(1.04); } }
</style>
</head>
<body>
<div class="ad">
  <div class="bg"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="ring"></div></div>
  <div class="bg-glow"></div>

  <div class="scene scene-1">
    <div class="ba-heading">Before vs. After AIWholesail</div>
    <div class="ba-grid">
      <div class="ba-col before">
        <div class="ba-label">Before</div>
        <div class="ba-item"><span class="icon">&#10005;</span> Hours searching listings</div>
        <div class="ba-item"><span class="icon">&#10005;</span> Missing profitable deals</div>
        <div class="ba-item"><span class="icon">&#10005;</span> Guessing at ARV</div>
        <div class="ba-item"><span class="icon">&#10005;</span> Manual comps research</div>
        <div class="ba-item"><span class="icon">&#10005;</span> Losing to faster investors</div>
      </div>
      <div class="ba-col after">
        <div class="ba-label">After</div>
        <div class="ba-item"><span class="icon">&#10003;</span> AI searches 24/7</div>
        <div class="ba-item"><span class="icon">&#10003;</span> Instant deal alerts</div>
        <div class="ba-item"><span class="icon">&#10003;</span> AI-powered analysis</div>
        <div class="ba-item"><span class="icon">&#10003;</span> Automated spread analysis</div>
        <div class="ba-item"><span class="icon">&#10003;</span> First to the deal</div>
      </div>
    </div>
  </div>

  <div class="scene scene-2">
    <div class="desktop-wrap">
      <div class="bar"><div class="dot"></div><div class="dot"></div><div class="dot"></div><div class="url-bar">aiwholesail.com</div></div>
      <img src="data:image/jpeg;base64,${desktopHeroB64}" alt="AIWholesail">
    </div>
    <div class="app-label">See why investors choose <span>AIWholesail</span></div>
  </div>

  <div class="scene scene-3">
    <div class="comeback">Ready to find more deals?</div>
    <div class="cta-h">Start Your<br><span>7-Day Free Trial</span></div>
    <div class="offer-box">
      <div class="offer-main">Full Access &mdash; 7 Days Free</div>
      <div class="offer-detail">No credit card required to start</div>
    </div>
    <button class="cta-btn">Start Free Trial</button>
    <div class="trust-badges">
      <div class="trust-badge"><span class="check">&#10003;</span> Cancel anytime</div>
      <div class="trust-badge"><span class="check">&#10003;</span> No commitments</div>
      <div class="trust-badge"><span class="check">&#10003;</span> Setup in 2 min</div>
    </div>
    <div class="cta-url">aiwholesail.com</div>
  </div>

  <div class="logo-bar">
    <div class="logo-sq"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
    <span class="logo-name">AIWHOLESAIL</span>
  </div>
</div>
</body>
</html>`;

// Write all files
fs.writeFileSync(path.join(__dirname, 'ad-square-1080x1080.html'), square);
fs.writeFileSync(path.join(__dirname, 'ad-story-1080x1920.html'), story);
fs.writeFileSync(path.join(__dirname, 'ad-landscape-1200x628.html'), landscape);
fs.writeFileSync(path.join(__dirname, 'ad-retarget-1080x1080.html'), retarget);

console.log('All 4 ads rebuilt with real site content and screenshots.');
