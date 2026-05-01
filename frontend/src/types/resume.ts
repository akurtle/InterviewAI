export type StepType = "choose" | "upload" | "analyze";
export type GetStartedOption = "interview" | "resume";

export interface ParseResponse {
  success: boolean;
  filename: string;
  data: Record<string, any>;
}
