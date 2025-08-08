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

  // Create path points that weave across the screen
  const createPath = () => {
    const points = [];
    const numPoints = 20;
    const amplitude = 0.3; // How far left/right to weave (30% of screen width)
    
    for (let i = 0; i <= numPoints; i++) {
      const progress = i / numPoints;
      const x = 0.5 + amplitude * Math.sin(progress * Math.PI * 3); // Weave pattern
      const y = progress;
      points.push({ x, y });
    }
    return points;
  };

  const pathPoints = createPath();

  // Calculate current position based on scroll
  const getCurrentPosition = () => {
    if (scrollProgress === 0) return { x: 50, y: 10 };
    
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
      y: y * 100 + 10 // Start 10% from top
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
    return deltaX * 30; // Subtle tilt based on direction
  };

  const rotation = getRotation();

  return (
    <div className="fixed inset-0 pointer-events-none z-10">
      {/* Path markers - X's */}
      {pathPoints.map((point, index) => {
        const opacity = Math.max(0, 1 - Math.abs(scrollProgress - point.y) * 3);
        const scale = scrollProgress >= point.y ? 0.6 : 1;
        
        return (
          <div
            key={index}
            className="absolute text-primary/30 font-light transition-all duration-500"
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100 + 10}%`,
              transform: `translate(-50%, -50%) scale(${scale})`,
              opacity: opacity * 0.4,
              fontSize: '12px'
            }}
          >
            ×
          </div>
        );
      })}

      {/* Sailboat */}
      <div
        className="absolute transition-all duration-300 ease-out"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          opacity: scrollProgress > 0.95 ? 0 : 1
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          className="text-primary"
        >
          {/* Sail */}
          <path
            d="M8 24L8 8L20 16L8 24Z"
            fill="currentColor"
            fillOpacity="0.8"
          />
          {/* Mast */}
          <line
            x1="8"
            y1="6"
            x2="8"
            y2="26"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          {/* Hull */}
          <path
            d="M4 24C4 24 8 26 16 26C24 26 28 24 28 24L24 22L8 22L4 24Z"
            fill="currentColor"
            fillOpacity="0.9"
          />
          {/* Wave effect */}
          <path
            d="M2 28C6 26 10 28 14 26C18 28 22 26 26 28C28 26 30 28 30 28"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.3"
            fill="none"
          />
        </svg>
      </div>

      {/* Subtle wake trail */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${position.x}%`,
          top: `${position.y + 2}%`,
          transform: 'translate(-50%, -50%)',
          opacity: scrollProgress > 0 ? 0.15 : 0
        }}
      >
        <div className="w-1 h-8 bg-gradient-to-b from-primary/20 to-transparent"></div>
      </div>
    </div>
  );
};

export default ScrollSailboat;