
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

interface Sparkle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

const SPARKLE_COLORS = [
  "var(--color-blue-500)",
  "var(--color-sky-500)",
  "var(--color-violet-500)",
  "var(--color-purple-500)",
];

function generateSparkles(): Sparkle[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: i,
    x: Math.random() * 10 - 15,
    y: Math.random() * 100,
    size: Math.random() * 2 + 1,
    color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
    delay: Math.random() * 0.3,
  }));
}

export default function FlippingImagesWithBar() {
  const images = [
    {
      title: "Manu",
      href: "https://assets.aceternity.com/avatars/manu.webp",
    },
    {
      title: "Second Person",
      href: "https://assets.aceternity.com/avatars/2.webp",
    },
    {
      title: "Third Person",
      href: "https://assets.aceternity.com/avatars/3.webp",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"appear" | "scanning" | "flipping">(
    "appear",
  );
  const [barProgress, setBarProgress] = useState(0);
  const [sparkles, setSparkles] = useState<Sparkle[]>(() => generateSparkles());

  useEffect(() => {
    if (phase === "appear") {
      const timer = setTimeout(() => setPhase("scanning"), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, currentIndex]);

  useEffect(() => {
    if (phase === "scanning") {
      setSparkles(generateSparkles());
      const duration = 2000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        setBarProgress(progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setTimeout(() => {
            setPhase("flipping");
          }, 100);
        }
      };

      requestAnimationFrame(animate);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "flipping") {
      const timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setBarProgress(0);
        setPhase("appear");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [phase, images.length]);

  const currentImage = images[currentIndex];

  return (
    <div className="mx-auto max-w-xl">
      <div className="relative h-60 w-52 rounded-lg bg-gray-200 p-4 dark:bg-neutral-800/50">
        <GridLineHorizontal className="top-0" offset="200px" />
        <GridLineHorizontal className="top-auto bottom-0" offset="200px" />
        <GridLineVertical className="left-0" offset="80px" />
        <GridLineVertical className="right-0 left-auto" offset="80px" />
        <div className="relative h-full w-full overflow-hidden rounded-lg bg-white shadow-sm ring-1 shadow-black/10 ring-black/5 dark:bg-neutral-800">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={currentIndex}
              className="absolute inset-0"
              initial={{ filter: "blur(12px)", opacity: 0 }}
              animate={{
                filter: phase === "flipping" ? "blur(12px)" : "blur(0px)",
                opacity: phase === "flipping" ? 0 : 1,
              }}
              exit={{ filter: "blur(12px)", opacity: 0 }}
              transition={{
                duration: 0.5,
                ease: "easeInOut",
              }}
            >
              {/* Grayscale image (base layer) */}
              <img
                src={currentImage.href}
                alt={currentImage.title}
                className="h-full w-full object-cover grayscale"
              />

              {/* Colored image revealed by bar */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  clipPath: `inset(0 ${100 - barProgress * 100}% 0 0)`,
                }}
              >
                <img
                  src={currentImage.href}
                  alt={currentImage.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Scanning bar */}
              {phase === "scanning" && (
                <motion.div
                  className="absolute top-0 bottom-0 w-px bg-linear-to-b from-transparent via-sky-500 to-transparent"
                  style={{
                    left: `${barProgress * 100}%`,

                    boxShadow:
                      "0 0 20px rgba(59, 130, 246, 0.9), 0 0 40px rgba(99, 102, 241, 0.7), 0 0 60px rgba(139, 92, 246, 0.5)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Sparkles on the left side of the bar */}
                  {sparkles.map((sparkle) => (
                    <motion.span
                      key={sparkle.id}
                      className="absolute rounded-full"
                      style={{
                        left: sparkle.x,
                        top: `${sparkle.y}%`,
                        width: sparkle.size,
                        height: sparkle.size,
                        backgroundColor: sparkle.color,
                        boxShadow: `0 0 ${sparkle.size / 2}px ${sparkle.color}`,
                      }}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1.5, 0],
                        x: [0, -10, -20],
                      }}
                      transition={{
                        duration: 0.6,
                        delay: sparkle.delay,
                        repeat: Infinity,
                        repeatDelay: 0.2,
                      }}
                    />
                  ))}

                  {/* Additional trailing sparkles */}
                  {[...Array(5)].map((_, i) => (
                    <motion.span
                      key={`trail-${i}`}
                      className="absolute rounded-full"
                      style={{
                        left: -8 - i * 4,
                        top: `${20 + i * 15}%`,
                        width: 2,
                        height: 2,
                        backgroundColor:
                          SPARKLE_COLORS[i % SPARKLE_COLORS.length],
                      }}
                      animate={{
                        opacity: [0.8, 0],
                        scale: [1, 0],
                      }}
                      transition={{
                        duration: 0.4,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const GridLineHorizontal = ({
  className,
  offset,
}: {
  className?: string;
  offset?: string;
}) => {
  return (
    <div
      style={
        {
          "--background": "#ffffff",
          "--color": "rgba(0, 0, 0, 0.2)",
          "--height": "1px",
          "--width": "5px",
          "--fade-stop": "90%",
          "--offset": offset || "200px", //-100px if you want to keep the line inside
          "--color-dark": "rgba(255, 255, 255, 0.2)",
          maskComposite: "exclude",
        } as React.CSSProperties
      }
      className={cn(
        "[--background:var(--color-neutral-200)] [--color:var(--color-neutral-400)] dark:[--background:var(--color-neutral-800)] dark:[--color:var(--color-neutral-600)]",
        "absolute left-[calc(var(--offset)/2*-1)] h-[var(--height)] w-[calc(100%+var(--offset))]",
        "bg-[linear-gradient(to_right,var(--color),var(--color)_50%,transparent_0,transparent)]",
        "[background-size:var(--width)_var(--height)]",
        "[mask:linear-gradient(to_left,var(--background)_var(--fade-stop),transparent),_linear-gradient(to_right,var(--background)_var(--fade-stop),transparent),_linear-gradient(black,black)]",
        "[mask-composite:exclude]",
        "z-30",
        "dark:bg-[linear-gradient(to_right,var(--color-dark),var(--color-dark)_50%,transparent_0,transparent)]",
        className,
      )}
    ></div>
  );
};

const GridLineVertical = ({
  className,
  offset,
}: {
  className?: string;
  offset?: string;
}) => {
  return (
    <div
      style={
        {
          "--background": "#ffffff",
          "--color": "rgba(0, 0, 0, 0.2)",
          "--height": "5px",
          "--width": "1px",
          "--fade-stop": "90%",
          "--offset": offset || "150px", //-100px if you want to keep the line inside
          "--color-dark": "rgba(255, 255, 255, 0.2)",
          maskComposite: "exclude",
        } as React.CSSProperties
      }
      className={cn(
        "absolute top-[calc(var(--offset)/2*-1)] h-[calc(100%+var(--offset))] w-[var(--width)]",
        "bg-[linear-gradient(to_bottom,var(--color),var(--color)_50%,transparent_0,transparent)]",
        "[background-size:var(--width)_var(--height)]",
        "[mask:linear-gradient(to_top,var(--background)_var(--fade-stop),transparent),_linear-gradient(to_bottom,var(--background)_var(--fade-stop),transparent),_linear-gradient(black,black)]",
        "[mask-composite:exclude]",
        "z-30",
        "dark:bg-[linear-gradient(to_bottom,var(--color-dark),var(--color-dark)_50%,transparent_0,transparent)]",
        className,
      )}
    ></div>
  );
};
