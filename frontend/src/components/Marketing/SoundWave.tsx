import { useEffect, useRef } from "react";

type WaveLayer = {
  amp: number;
  freq: number;
  speed: number;
  phase: number;
};

const LAYERS: WaveLayer[] = [
  { amp: 18, freq: 0.022, speed: 1, phase: 0 },
  { amp: 10, freq: 0.034, speed: 1.6, phase: 1.8 },
  { amp: 6, freq: 0.055, speed: 2.2, phase: 3.4 },
];

const buildPoints = (layer: WaveLayer, time: number, scrollTop: number) => {
  const centerY = 40;
  const scrollOffset = scrollTop * 0.04 * layer.speed;
  const points: string[] = [];

  for (let x = 0; x <= 1440; x += 12) {
    const y =
      centerY +
      Math.sin(x * layer.freq + time * layer.speed + layer.phase + scrollOffset) * layer.amp +
      Math.sin(x * layer.freq * 1.7 + time * layer.speed * 1.4 + layer.phase * 2) *
        (layer.amp * 0.35);
    points.push(`${x},${y.toFixed(2)}`);
  }

  return points.join(" ");
};

function SoundWave() {
  const mainRef = useRef<SVGPolylineElement | null>(null);
  const midRef = useRef<SVGPolylineElement | null>(null);
  const fineRef = useRef<SVGPolylineElement | null>(null);

  useEffect(() => {
    let frameId = 0;

    const draw = (timestamp: number) => {
      const time = timestamp / 1000;
      const scrollRoot = document.getElementById("scroll-root");
      const scrollTop = scrollRoot?.scrollTop ?? window.scrollY;
      const refs = [mainRef, midRef, fineRef];

      refs.forEach((ref, index) => {
        ref.current?.setAttribute("points", buildPoints(LAYERS[index], time, scrollTop));
      });

      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="mt-8 w-screen [margin-left:calc(-50vw+50%)]">
      <svg
        className="h-20 w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 80"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sound-wave-fade" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="black" />
            <stop offset="12%" stopColor="white" />
            <stop offset="88%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </linearGradient>
          <mask id="sound-wave-mask">
            <rect fill="url(#sound-wave-fade)" height="80" width="1440" />
          </mask>
        </defs>
        <g fill="none" mask="url(#sound-wave-mask)">
          <polyline
            ref={mainRef}
            stroke="oklch(0.78 0.2 168)"
            strokeLinecap="round"
            strokeWidth="2"
            opacity="0.9"
          />
          <polyline
            ref={midRef}
            stroke="oklch(0.72 0.18 168)"
            strokeLinecap="round"
            strokeWidth="1.3"
            opacity="0.45"
          />
          <polyline
            ref={fineRef}
            stroke="oklch(0.88 0.16 168)"
            strokeLinecap="round"
            strokeWidth="1"
            opacity="0.25"
          />
        </g>
      </svg>
    </div>
  );
}

export default SoundWave;
