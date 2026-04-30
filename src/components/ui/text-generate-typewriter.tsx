
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const KEY_SOUNDS_DOWN: Record<string, [number, number]> = {
  A: [31542, 85],
  B: [40621, 107],
  C: [39632, 95],
  D: [32492, 85],
  E: [23317, 83],
  F: [32973, 87],
  G: [33453, 94],
  H: [33986, 93],
  I: [25795, 91],
  J: [34425, 88],
  K: [34932, 90],
  L: [35410, 95],
  M: [41610, 93],
  N: [41103, 90],
  O: [26309, 84],
  P: [26804, 83],
  Q: [22245, 95],
  R: [23817, 92],
  S: [32031, 88],
  T: [24297, 92],
  U: [25313, 95],
  V: [40136, 94],
  W: [22790, 89],
  X: [39148, 76],
  Y: [24811, 93],
  Z: [38694, 80],
  " ": [51541, 144],
  Backspace: [19065, 110],
  Period: [42594, 90],
};

const KEY_SOUNDS_UP: Record<string, [number, number]> = {
  A: [31632, 80],
  B: [40736, 95],
  C: [39732, 85],
  D: [32577, 80],
  E: [23402, 80],
  F: [33063, 80],
  G: [33553, 85],
  H: [34081, 85],
  I: [25890, 85],
  J: [34515, 85],
  K: [35027, 85],
  L: [35510, 85],
  M: [41710, 85],
  N: [41198, 85],
  O: [26394, 80],
  P: [26889, 80],
  Q: [22345, 85],
  R: [23912, 85],
  S: [32121, 80],
  T: [24392, 85],
  U: [25413, 85],
  V: [40236, 85],
  W: [22880, 85],
  X: [39228, 70],
  Y: [24911, 85],
  Z: [38779, 75],
  " ": [51691, 130],
  Backspace: [19180, 100],
  Period: [42689, 85],
};

function useAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const init = async () => {
      try {
        ctxRef.current = new AudioContext();
        const res = await fetch("/sounds/sound.ogg");
        if (!res.ok) return;
        bufferRef.current = await ctxRef.current.decodeAudioData(
          await res.arrayBuffer(),
        );
        readyRef.current = true;
      } catch {}
    };
    init();
    return () => {
      ctxRef.current?.close();
    };
  }, [enabled]);

  const playSound = (sound: [number, number] | undefined) => {
    if (!readyRef.current || !ctxRef.current || !bufferRef.current || !sound)
      return;
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    const src = ctxRef.current.createBufferSource();
    src.buffer = bufferRef.current;
    src.connect(ctxRef.current.destination);
    src.start(0, sound[0] / 1000, sound[1] / 1000);
  };

  const down = (key: string) =>
    playSound(KEY_SOUNDS_DOWN[key.toUpperCase()] || KEY_SOUNDS_DOWN[key]);
  const up = (key: string) =>
    playSound(KEY_SOUNDS_UP[key.toUpperCase()] || KEY_SOUNDS_UP[key]);

  return { down, up };
}

function useInView(ref: React.RefObject<HTMLElement | null>, once = true) {
  const [inView, setInView] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || (once && triggered.current)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          setInView(true);
          if (once) {
            triggered.current = true;
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, once]);

  return inView;
}

interface TextGenerateTypewriterProps {
  words: string[];
  className?: string;
  cursorClassName?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  delayBetweenWords?: number;
  initialDelay?: number;
  enableSound?: boolean;
}

export function TextGenerateTypewriter({
  words = ["Hello", "World", "Typewriter"],
  className,
  cursorClassName,
  typingSpeed = 80,
  deletingSpeed = 40,
  delayBetweenWords = 1000,
  initialDelay = 500,
  enableSound = true,
}: TextGenerateTypewriterProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(containerRef);
  const { down, up } = useAudio(enableSound);

  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "typing" | "deleting" | "done">(
    "idle",
  );
  const [wordIdx, setWordIdx] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);

  const currentWord = words[wordIdx] || "";
  const isLastWord = wordIdx === words.length - 1;

  useEffect(() => {
    if (!inView || phase !== "idle") return;
    const t = setTimeout(() => setPhase("typing"), initialDelay);
    return () => clearTimeout(t);
  }, [inView, phase, initialDelay]);

  useEffect(() => {
    if (phase === "typing") {
      if (text.length < currentWord.length) {
        const char = currentWord[text.length];
        down(char);
        const t = setTimeout(() => {
          up(char);
          setText(currentWord.slice(0, text.length + 1));
        }, typingSpeed);
        return () => clearTimeout(t);
      } else {
        if (isLastWord) {
          const t = setTimeout(() => {
            down("Period");
            setTimeout(() => {
              up("Period");
              setText((prev) => prev + ".");
              setPhase("done");
            }, typingSpeed);
          }, 300);
          return () => clearTimeout(t);
        } else {
          const t = setTimeout(() => {
            down("Backspace");
            setPhase("deleting");
          }, delayBetweenWords);
          return () => clearTimeout(t);
        }
      }
    }

    if (phase === "deleting") {
      if (text.length > 0) {
        const t = setTimeout(() => setText(text.slice(0, -1)), deletingSpeed);
        return () => clearTimeout(t);
      } else {
        up("Backspace");
        const t = setTimeout(() => {
          setWordIdx((i) => i + 1);
          setPhase("typing");
        }, 400);
        return () => clearTimeout(t);
      }
    }
  }, [
    phase,
    text,
    currentWord,
    isLastWord,
    typingSpeed,
    deletingSpeed,
    delayBetweenWords,
    down,
    up,
  ]);

  useEffect(() => {
    if (phase !== "done") return;
    const interval = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <span
      ref={containerRef}
      className={cn("inline-flex items-baseline", className)}
    >
      <span className="inline-block min-h-[1em]">{text || "\u200B"}</span>
      <span
        className={cn(
          "ml-1 inline-block h-[0.9em] w-[0.5em] self-center border border-neutral-300/50 bg-neutral-200 transition-opacity duration-100 dark:border-neutral-700/50 dark:bg-neutral-800",
          phase === "done" && !cursorVisible && "opacity-0",
          cursorClassName,
        )}
      />
    </span>
  );
}

export default function TextGenerateTypewriterDemo() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-start justify-center bg-white px-4 py-10 md:px-8 md:py-16 lg:px-16 dark:bg-neutral-950">
      <h1 className="text-left text-3xl leading-[1.1] font-medium tracking-tighter text-neutral-900 md:text-6xl lg:text-6xl dark:text-white">
        We help you build apps that are{" "}
        <TextGenerateTypewriter
          words={[
            "production ready",
            "design first",
            "performant",
            "money machines",
          ]}
          className="text-neutral-900 dark:text-white"
          typingSpeed={70}
          deletingSpeed={30}
          delayBetweenWords={1500}
        />
      </h1>
      <p className="mt-6 max-w-xl text-left text-base text-neutral-600 md:text-lg dark:text-neutral-400">
        We help you build apps that are production ready, design first,
        performant, and money machines.
      </p>
      {/* Buttons inspired by BrandButton styles */}
      <div className="mt-8 flex flex-wrap gap-4">
        <button
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-lg bg-linear-to-t from-emerald-500 to-teal-500 px-6 py-2 font-medium text-white shadow-[0px_0px_10px_0px_rgba(255,255,255,0.2)_inset] ring ring-emerald-500/40 ring-offset-2 ring-offset-emerald-600 transition-all duration-200 ring-inset hover:shadow-[0px_0px_20px_0px_var(--color-teal-500)_inset] hover:ring-teal-500/60 active:scale-98 dark:text-black dark:shadow-[0px_0px_10px_0px_var(--color-teal-500)_inset] dark:ring-teal-500/40 dark:ring-offset-emerald-500 dark:hover:shadow-[0px_0px_20px_0px_var(--color-teal-500)_inset] dark:hover:ring-emerald-500/70",
          )}
          type="button"
        >
          Get Started
        </button>
        <button
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-lg bg-white px-6 py-2 font-medium text-neutral-900 shadow-[0px_0px_10px_0px_rgba(0,0,0,0.08)_inset] ring ring-neutral-200/40 ring-offset-2 ring-offset-neutral-200 transition-all duration-200 ring-inset hover:shadow-[0px_0px_20px_0px_rgba(0,0,0,0.16)_inset] hover:ring-neutral-300/60 active:scale-98 dark:bg-neutral-900 dark:text-white dark:shadow-[0px_0px_10px_0px_rgba(255,255,255,0.1)_inset] dark:ring-white/20 dark:ring-offset-neutral-900 dark:hover:shadow-[0px_0px_20px_0px_rgba(255,255,255,0.18)_inset] dark:hover:ring-white/40",
          )}
          type="button"
        >
          Learn More
        </button>
      </div>
    </div>
  );
}
