import { useEffect, useState } from "react";

const ScrollSailboat = () => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(scrollTop / docHeight, 1);
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Create path points that weave across the screen with wider turns
  const createPath = () => {
    const points = [];
    const numPoints = 25;
    const amplitude = 0.35; // Increased amplitude for wider turns
    const centerOffset = 0.5;
    
    for (let i = 0; i <= numPoints; i++) {
      const progress = i / numPoints;
      // More dramatic sine wave with multiple cycles
      const x = centerOffset + amplitude * Math.sin(progress * Math.PI * 3.5);
      const y = progress;
      points.push({ x: Math.max(0.1, Math.min(0.9, x)), y }); // Clamp but allow closer to edges
    }
    return points;
  };

  const pathPoints = createPath();

  // Calculate current position based on scroll
  const getCurrentPosition = () => {
    if (scrollProgress === 0) return { x: 50, y: 5 };
    
    const totalPoints = pathPoints.length;
    const currentIndex = Math.floor(scrollProgress * (totalPoints - 1));
    const nextIndex = Math.min(currentIndex + 1, totalPoints - 1);
    
    const localProgress = (scrollProgress * (totalPoints - 1)) - currentIndex;
    
    const current = pathPoints[currentIndex];
    const next = pathPoints[nextIndex];
    
    // Interpolate between current and next point
    const x = current.x + (next.x - current.x) * localProgress;
    const y = current.y + (next.y - current.y) * localProgress;
    
    return {
      x: x * 100, // Convert to percentage
      y: y * 90 + 5 // Use more of the screen height
    };
  };

  const position = getCurrentPosition();

  // Calculate rotation based on movement direction
  const getRotation = () => {
    if (scrollProgress === 0) return 0;
    
    const totalPoints = pathPoints.length;
    const currentIndex = Math.floor(scrollProgress * (totalPoints - 1));
    const nextIndex = Math.min(currentIndex + 1, totalPoints - 1);
    
    if (currentIndex === nextIndex) return 0;
    
    const current = pathPoints[currentIndex];
    const next = pathPoints[nextIndex];
    
    const deltaX = next.x - current.x;
    return deltaX * 45; // More pronounced tilt
  };

  const rotation = getRotation();

  // Calculate sailboat opacity with fade in/out
  const getSailboatOpacity = () => {
    if (scrollProgress < 0.05) {
      // Fade in at the beginning
      return scrollProgress / 0.05;
    } else if (scrollProgress > 0.9) {
      // Fade out at the end
      return (1 - scrollProgress) / 0.1;
    }
    return 1;
  };

  const sailboatOpacity = getSailboatOpacity();

  // Create SVG path string for the sailing route
  const createSVGPath = () => {
    let pathString = "";
    pathPoints.forEach((point, index) => {
      const x = point.x * 100;
      const y = point.y * 90 + 5;
      
      if (index === 0) {
        pathString += `M ${x} ${y}`;
      } else {
        pathString += ` L ${x} ${y}`;
      }
    });
    return pathString;
  };

  const svgPath = createSVGPath();

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      {/* Visible sailing path */}
      <svg 
        className="absolute inset-0 w-full h-full"
        style={{ 
          opacity: scrollProgress > 0.02 ? 0.15 : 0,
          transition: 'opacity 0.5s ease-out'
        }}
      >
        <defs>
          <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <path
          d={svgPath}
          stroke="url(#pathGradient)"
          strokeWidth="2"
          fill="none"
          strokeDasharray="8,4"
          style={{
            strokeDashoffset: scrollProgress * -100,
            transition: 'stroke-dashoffset 0.1s ease-out'
          }}
        />
      </svg>

      {/* Path markers - X's with improved visibility */}
      {pathPoints.map((point, index) => {
        const markerProgress = index / (pathPoints.length - 1);
        const distanceFromCurrent = Math.abs(scrollProgress - markerProgress);
        const opacity = Math.max(0, 1 - distanceFromCurrent * 4);
        const scale = scrollProgress >= markerProgress ? 0.4 : 0.8;
        const brightness = scrollProgress >= markerProgress ? 0.3 : 1;
        
        return (
          <div
            key={index}
            className="absolute text-primary transition-all duration-700"
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 90 + 5}%`,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity: opacity * 0.6 * brightness,
              fontSize: '16px',
              fontWeight: '300'
            }}
          >
            ×
          </div>
        );
      })}

      {/* Enhanced larger sailboat */}
      <div
        className="absolute transition-all duration-300 ease-out"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${sailboatOpacity})`,
          opacity: sailboatOpacity
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          fill="none"
          className="text-primary drop-shadow-lg"
        >
          {/* Main sail */}
          <path
            d="M16 48L16 12L40 30L16 48Z"
            fill="currentColor"
            fillOpacity="0.85"
          />
          {/* Jib sail */}
          <path
            d="M16 24L16 12L28 18L16 24Z"
            fill="currentColor"
            fillOpacity="0.6"
          />
          {/* Mast */}
          <line
            x1="16"
            y1="8"
            x2="16"
            y2="52"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.8"
          />
          {/* Boom */}
          <line
            x1="16"
            y1="48"
            x2="40"
            y2="30"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />
          {/* Hull */}
          <path
            d="M8 48C8 48 16 52 32 52C48 52 56 48 56 48L48 44L16 44L8 48Z"
            fill="currentColor"
            fillOpacity="0.95"
          />
          {/* Keel */}
          <path
            d="M30 52L30 56L34 56L34 52"
            fill="currentColor"
            fillOpacity="0.7"
          />
          {/* Enhanced wave effects */}
          <path
            d="M4 56C12 52 20 56 28 52C36 56 44 52 52 56C56 52 60 56 60 56"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity="0.4"
            fill="none"
          />
          <path
            d="M6 60C10 58 14 60 18 58C22 60 26 58 30 60C34 58 38 60 42 58C46 60 50 58 54 60"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.2"
            fill="none"
          />
        </svg>
      </div>

      {/* Enhanced wake trail */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${position.x}%`,
          top: `${position.y + 3}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          opacity: sailboatOpacity * 0.3
        }}
      >
        <div className="w-2 h-16 bg-gradient-to-b from-primary/30 via-primary/15 to-transparent rounded-full"></div>
      </div>

      {/* Secondary wake trails */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${position.x - 1}%`,
          top: `${position.y + 4}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          opacity: sailboatOpacity * 0.15
        }}
      >
        <div className="w-1 h-12 bg-gradient-to-b from-primary/20 to-transparent rounded-full"></div>
      </div>
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${position.x + 1}%`,
          top: `${position.y + 4}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          opacity: sailboatOpacity * 0.15
        }}
      >
        <div className="w-1 h-12 bg-gradient-to-b from-primary/20 to-transparent rounded-full"></div>
      </div>
    </div>
  );
};

export default ScrollSailboat;