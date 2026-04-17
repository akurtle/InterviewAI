export type CallEnvironmentId =
  | "teams"
  | "meet"
  | "audience"
  | "webinar"
  | "studio";

export type CallEnvironmentPreset = {
  id: CallEnvironmentId;
  label: string;
  shortLabel: string;
  description: string;
  helperText: string;
  stageLayout: "platform" | "audience";
  stageHeading: string;
  stageSubheading: string;
  idleTitle: string;
  idleBody: string;
  accentClassName: string;
  shellClassName: string;
  frameClassName: string;
  controlClassName: string;
};

export const CALL_ENVIRONMENT_PRESETS: Record<
  CallEnvironmentId,
  CallEnvironmentPreset
> = {
  teams: {
    id: "teams",
    label: "Teams Room",
    shortLabel: "Teams",
    description: "Desktop meeting layout with shared-call chrome and structured controls.",
    helperText: "Good for standard interviews where you want corporate meeting pressure.",
    stageLayout: "platform",
    stageHeading: "Interview sync",
    stageSubheading: "Corporate call layout with visible meeting chrome.",
    idleTitle: "Enter the Teams-style room",
    idleBody: "Start the session to practice with a familiar company meeting frame.",
    accentClassName: "bg-[#5b5fc7]/20 text-[#d8dcff] border-[#7f85ff]/35",
    shellClassName: "border-white/10 bg-[#111827]/85",
    frameClassName: "from-[#0f172a] via-[#111827] to-[#1e293b]",
    controlClassName: "bg-[#5b5fc7] text-white",
  },
  meet: {
    id: "meet",
    label: "Google Meet",
    shortLabel: "Meet",
    description: "Lighter meeting view with bottom controls and presentation-friendly chrome.",
    helperText: "Useful for conversational interviews and pitch calls over browser meeting tools.",
    stageLayout: "platform",
    stageHeading: "Meet practice room",
    stageSubheading: "Browser-call framing with simple controls and airy spacing.",
    idleTitle: "Open the Meet-style room",
    idleBody: "Start the session to rehearse in a cleaner browser meeting layout.",
    accentClassName: "bg-[#0f9d58]/20 text-[#d6ffe8] border-[#34d399]/35",
    shellClassName: "border-white/10 bg-[#0f141a]/88",
    frameClassName: "from-[#101828] via-[#1f2937] to-[#111827]",
    controlClassName: "bg-white text-slate-900",
  },
  audience: {
    id: "audience",
    label: "Audience View",
    shortLabel: "Audience",
    description: "Public speaking setup where you only see the room and audience reactions.",
    helperText: "Built for pitch practice, demos, and keynote-style delivery without self-view.",
    stageLayout: "audience",
    stageHeading: "Live audience room",
    stageSubheading: "Presentation mode with seats, stage lights, and no visible self tile.",
    idleTitle: "Step onto the stage",
    idleBody: "Start the session to practice speaking to a room instead of a call grid.",
    accentClassName: "bg-amber-400/20 text-amber-100 border-amber-300/35",
    shellClassName: "border-white/10 bg-[#140f18]/88",
    frameClassName: "from-[#10070f] via-[#1b1024] to-[#09070f]",
    controlClassName: "bg-amber-300 text-slate-950",
  },
  webinar: {
    id: "webinar",
    label: "Webinar Stage",
    shortLabel: "Webinar",
    description: "Host-centric event layout with side panels that feel like a larger broadcast room.",
    helperText: "Works well for investor updates, demos, and formal stakeholder presentations.",
    stageLayout: "platform",
    stageHeading: "Broadcast briefing",
    stageSubheading: "Host-led event framing with audience and agenda side chrome.",
    idleTitle: "Prepare the webinar room",
    idleBody: "Start the session to present like you're hosting a larger live event.",
    accentClassName: "bg-fuchsia-400/20 text-fuchsia-100 border-fuchsia-300/35",
    shellClassName: "border-white/10 bg-[#17111f]/88",
    frameClassName: "from-[#140c1c] via-[#251236] to-[#0f0b18]",
    controlClassName: "bg-fuchsia-500 text-white",
  },
  studio: {
    id: "studio",
    label: "Studio Monitor",
    shortLabel: "Studio",
    description: "Focused rehearsal layout with presenter monitor styling and confidence cues.",
    helperText: "Helpful when you want a polished on-air or executive presentation feeling.",
    stageLayout: "platform",
    stageHeading: "Presenter monitor",
    stageSubheading: "Polished rehearsal screen with confident broadcast-style framing.",
    idleTitle: "Arm the presenter monitor",
    idleBody: "Start the session to rehearse in a more polished studio-style scene.",
    accentClassName: "bg-cyan-400/20 text-cyan-100 border-cyan-300/35",
    shellClassName: "border-white/10 bg-[#0b1520]/88",
    frameClassName: "from-[#071a22] via-[#0f2530] to-[#081018]",
    controlClassName: "bg-cyan-400 text-slate-950",
  },
};

export const CALL_ENVIRONMENT_OPTIONS = Object.values(CALL_ENVIRONMENT_PRESETS);

export const isCallEnvironmentId = (
  value: string | null | undefined
): value is CallEnvironmentId =>
  Boolean(value && value in CALL_ENVIRONMENT_PRESETS);
