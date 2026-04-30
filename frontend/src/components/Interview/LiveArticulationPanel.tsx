import { formatPercent } from "./mockInterviewUtils";
import type { LiveArticulationStats } from "../../types/interview";

type Props = {
  stats: LiveArticulationStats;
};

const LiveArticulationPanel = ({ stats }: Props) => {
  return (
    <div className="theme-panel rounded-2xl p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="theme-text-primary text-lg font-semibold">Live articulation</h2>
        </div>
        <span className={`text-sm font-semibold ${stats.toneClassName}`}>{stats.statusText}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="theme-panel-soft rounded-lg px-4 py-3">
          <p className="theme-text-dim text-xs uppercase tracking-wide">Mouth openness</p>
          <p className="theme-text-primary mt-1 text-xl font-semibold">
            {formatPercent(stats.mouthOpenRatio)}
          </p>
        </div>
        <div className="theme-panel-soft rounded-lg px-4 py-3">
          <p className="theme-text-dim text-xs uppercase tracking-wide">Active articulation</p>
          <p className="theme-text-primary mt-1 text-xl font-semibold">
            {formatPercent(stats.articulationRate)}
          </p>
        </div>
        <div className="theme-panel-soft rounded-lg px-4 py-3">
          <p className="theme-text-dim text-xs uppercase tracking-wide">Movement change</p>
          <p className="theme-text-primary mt-1 text-xl font-semibold">
            {stats.mouthMovement === null ? "N/A" : stats.mouthMovement.toFixed(3)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiveArticulationPanel;
