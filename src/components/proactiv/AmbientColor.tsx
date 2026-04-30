/**
 * Ambient diagonal light beams — ported from Proactiv template.
 * Creates subtle, ethereal light streaks across dark backgrounds.
 */
export function AmbientColor() {
  return (
    <div className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none overflow-hidden">
      <div
        className="absolute top-0 left-0"
        style={{
          transform: 'translateY(-350px) rotate(-45deg)',
          width: '560px',
          height: '1380px',
          background: 'radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(0,0%,85%,.08) 0, hsla(0,0%,55%,.02) 50%, hsla(0,0%,45%,0) 80%)',
        }}
      />
      <div
        className="absolute top-0 left-0"
        style={{
          transform: 'rotate(-45deg) translate(5%, -50%)',
          transformOrigin: 'top left',
          width: '240px',
          height: '1380px',
          background: 'radial-gradient(50% 50% at 50% 50%, hsla(0,0%,85%,.06) 0, hsla(0,0%,45%,.02) 80%, transparent 100%)',
        }}
      />
      <div
        className="absolute top-0 left-0"
        style={{
          borderRadius: '20px',
          transform: 'rotate(-45deg) translate(-180%, -70%)',
          transformOrigin: 'top left',
          width: '240px',
          height: '1380px',
          background: 'radial-gradient(50% 50% at 50% 50%, hsla(0,0%,85%,.04) 0, hsla(0,0%,45%,.02) 80%, transparent 100%)',
        }}
      />
    </div>
  );
}
