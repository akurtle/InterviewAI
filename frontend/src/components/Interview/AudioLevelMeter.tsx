import React from "react";

type Props = {
  level: number; 
  label?: string;
};

const AudioLevelMeter: React.FC<Props> = ({ level, label = "Mic level" }) => {
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-300">{label}</p>
        <p className="text-xs text-gray-400">{pct}%</p>
      </div>

      <div className="h-3 rounded-full bg-gray-800 border border-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${pct}%`,
            background:
              "linear-gradient(90deg, rgba(16,185,129,0.35), rgba(16,185,129,0.95))",
          }}
        />
      </div>

      <p className="mt-2 text-xs text-gray-500">
        If this stays at 0%, check mic permissions or unmute.
      </p>
    </div>
  );
};

export default AudioLevelMeter;
