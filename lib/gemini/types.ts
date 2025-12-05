import { type PunctuationMode } from "../punctuation";

export type WritingStyle =
  | "dearu"
  | "desumasu"
  | "humanize_dearu"
  | "humanize_desumasu";

export type StylePreset = {
  label: string;
  description: string;
  toneInstruction: string;
  strictToneInstruction?: string;
  additionalDirectives?: string[];
  sample?: {
    before: string;
    after: string;
    note?: string;
  };
};

export type StrictEnforcementLevel = "standard" | "reinforced" | "maximum";

export type AttemptConfig = {
  strictMode: boolean;
  temperature: number;
  enforcementLevel: StrictEnforcementLevel;
};

export type GeminiTransformRequest = {
  inputText: string;
  writingStyle: WritingStyle;
  punctuationMode: PunctuationMode;
  temperature?: number;
  useHighAccuracyModel?: boolean;
};

export type GeminiTransformResult = {
  outputText: string;
  rawResponse?: unknown;
};

export type AiConfidenceLevel = "low" | "medium" | "high";

export type AiCheckerResult = {
  score: number;
  confidence: AiConfidenceLevel;
  reasoning: string;
};
