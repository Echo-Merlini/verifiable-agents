"use client";

import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

// Real waveform peaks, RMS energy baked from the narration (public/why-recompute.mp3).
const PEAKS = [0.82, 0.77, 0.86, 0.85, 0.83, 0.79, 0.83, 0.98, 0.85, 0.79, 0.8, 0.81, 0.69, 0.84, 0.91, 0.82, 0.79, 0.73, 0.84, 0.76, 0.77, 0.81, 0.89, 0.9, 0.75, 0.78, 0.86, 0.77, 0.9, 1.0, 0.9, 0.82, 0.85, 0.76, 0.77, 0.74, 0.73, 0.81, 0.88, 0.81];

const mmss = (s: number) => {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function VoicePlayer({
  src = "/why-recompute.v2.mp3",
  label = "Hear the why",
}: { src?: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const seek = (clientX: number, el: HTMLElement) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const r = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    a.currentTime = frac * dur;
    setT(a.currentTime);
  };

  const frac = dur ? t / dur : 0;

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.03] py-1.5 pl-1.5 pr-4">
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setT(0); }}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause the narration" : "Play the narration"}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brass text-deepink transition-colors hover:bg-brassLight focus:outline-none focus-visible:ring-2 focus-visible:ring-brassLight/60"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>

      <div
        role="slider"
        aria-label="Seek narration"
        aria-valuemin={0}
        aria-valuemax={Math.floor(dur)}
        aria-valuenow={Math.floor(t)}
        tabIndex={0}
        onClick={(e) => seek(e.clientX, e.currentTarget)}
        onKeyDown={(e) => {
          const a = audioRef.current;
          if (!a || !dur) return;
          if (e.key === "ArrowRight") { a.currentTime = Math.min(dur, a.currentTime + 5); setT(a.currentTime); }
          if (e.key === "ArrowLeft") { a.currentTime = Math.max(0, a.currentTime - 5); setT(a.currentTime); }
          if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
        }}
        className="flex h-6 w-[132px] cursor-pointer items-center gap-[2px] sm:w-[176px]"
      >
        {PEAKS.map((p, i) => {
          const on = (i + 0.5) / PEAKS.length <= frac;
          return (
            <span
              key={i}
              className="flex-1 rounded-full transition-colors duration-150"
              style={{
                height: `${Math.round(p * 100)}%`,
                minWidth: 1.5,
                backgroundColor: on ? "#E0A24C" : "rgba(236,231,219,0.22)",
              }}
            />
          );
        })}
      </div>

      <span className="shrink-0 font-mono text-[11px] tabular-nums text-paper/50">
        {playing || t > 0 ? mmss(t) : label}
      </span>
    </div>
  );
}
