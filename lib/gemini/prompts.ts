import { type PunctuationMode } from "../punctuation";
import {
  type WritingStyle,
  type StrictEnforcementLevel,
  type GeminiTransformRequest,
} from "./types";
import { writingStylePresets, DEARU_STYLE_SET } from "./constants";

const isDearuStyle = (style: WritingStyle): boolean =>
  DEARU_STYLE_SET.has(style);

export type BuildPromptOptions = GeminiTransformRequest & {
  strictMode?: boolean;
  validationDirective?: string | null;
  enforcementLevel?: StrictEnforcementLevel;
};

function getStrictReinforcementInstructions(
  writingStyle: WritingStyle,
  enforcementLevel: StrictEnforcementLevel,
): string[] {
  if (!isDearuStyle(writingStyle)) {
    return [];
  }

  const instructions: string[] = [];

  if (enforcementLevel === "reinforced" || enforcementLevel === "maximum") {
    instructions.push(
      "- 例: 「この結果です。」→「この結果である。」、「確認します。」→「確認する。」のように丁寧語を常体に言い換えてください。",
    );
  }

  if (enforcementLevel === "maximum") {
    instructions.push(
      "- 各文を声に出すつもりで確認し、丁寧語（です・ます・でした など）が残っていれば必ず常体に修正してから出力してください。",
    );
    instructions.push(
      "- 最終出力の直前に丁寧語が1つでも残っていないか再点検し、問題があれば修正が完了するまで出力しないでください。",
    );
  }

  return instructions;
}

export function buildPrompt({
  inputText,
  writingStyle,
  punctuationMode,
  strictMode = false,
  validationDirective,
  enforcementLevel = "standard",
}: BuildPromptOptions): string {
  const preset = writingStylePresets[writingStyle];
  let punctuationInstruction: string;

  switch (punctuationMode) {
    case "academic":
      punctuationInstruction = "句読点は必ず「，」「．」を使用してください。";
      break;
    case "western":
      punctuationInstruction =
        "句読点は必ず半角の「,」「.」を使用してください。";
      break;
    default:
      punctuationInstruction = "句読点は必ず「、」「。」を使用してください。";
      break;
  }

  const instructions: string[] = [
    "- 入力文を大幅に書き換えず、意味や事実関係を保ったまま語尾や表現を整えてください。",
  ];

  if (
    strictMode &&
    validationDirective &&
    validationDirective.trim().length > 0
  ) {
    instructions.push(`- ${validationDirective.trim()}`);
  }

  instructions.push(`- ${preset.toneInstruction}`);

  if (strictMode && preset.strictToneInstruction) {
    instructions.push(`- ${preset.strictToneInstruction}`);
  }

  if (Array.isArray(preset.additionalDirectives)) {
    for (const directive of preset.additionalDirectives) {
      if (typeof directive === "string" && directive.trim().length > 0) {
        instructions.push(`- ${directive.trim()}`);
      }
    }
  }

  instructions.push(`- ${punctuationInstruction}`);
  instructions.push(
    "- 変換後のテキストのみを出力し、説明文や補足は書かないでください。",
  );
  instructions.push(
    "- あいさつや了承の返答など、変換結果と無関係な文章を冒頭や末尾に付け加えないでください。",
  );
  instructions.push(
    "- ヘッダー、箇条書き、引用、コードブロックなどの装飾を使わず、本文のみをそのまま出力してください。",
  );

  if (strictMode) {
    instructions.push(
      "- 出力前に文体の揺れが残っていないか自己チェックし、丁寧語と常体が混在しないようにしてください。",
    );
    for (const reinforcementInstruction of getStrictReinforcementInstructions(
      writingStyle,
      enforcementLevel,
    )) {
      instructions.push(reinforcementInstruction);
    }
  }

  return `あなたは日本語文章の編集アシスタントです。以下の指示に従ってテキストを整形してください。

# 指示
${instructions.join("\n")}

# 入力文
${inputText.trim()}`;
}

export const AI_CHECKER_PROMPT = [
  "あなたは高度なAIテキスト検出・監査システムです。",
  "以下の日本語テキストを詳細に分析し、そのテキストが「AIによって生成された可能性」を0〜100の整数（スコア）で厳密に評価してください。",
  "0は「確実に人間が書いた」、100は「確実にAIが書いた」ことを意味します。",
  "",
  "## 評価基準",
  "以下の要素を重点的にチェックしてください：",
  "1. **文構造の多様性（Burstiness）**: 人間は文の長さや構造を不規則に変化させますが、AIは均一になりがちです。ただし、論文やレポートなどの形式的な文書では、人間が書いても一定の均一性を持つ場合があることに注意してください。",
  "2. **具体性と独自性**: AIは一般的で無難な表現を好みます。個人的な体験、強い意見、独自の言い回しは人間らしさの証拠です。",
  "3. **不完全性**: 誤字、俗語、倒置、文法的な揺らぎは人間らしさを示唆します。",
  "4. **AI特有の癖**: 意味の薄い冗長な表現や、文脈にそぐわない過剰な繰り返しはAIの兆候です。なお、「〜について解説します」「結論として」などの定型表現は、レポートや論文では人間も自然に使用するため、それだけでAIと判定しないでください。",
  "",
  "## スコアリングの指針",
  "- **安易な中間スコア（40〜60点）は避けてください**。特徴を捉えて、可能な限り白黒はっきりとした判定（20以下または80以上）を目指してください。",
  "- 判断に迷う場合のみ中間スコアを使用してください。",
  "",
  "## 出力形式",
  "結果は必ず以下のJSON形式のみで返してください。Markdownのコードブロックや余計な説明は一切不要です。",
  "",
  '{"score": <0-100の整数>, "confidence": "<low|medium|high>", "reasoning": "<判定理由。AIらしい点、人間らしい点を具体的に指摘してください>"}',
  "",
  "confidence（確信度）の目安:",
  "- low: 判定の根拠が乏しい",
  "- medium: どちらとも取れる要素がある",
  "- high: 明確な特徴があり、判定に自信がある",
].join("\n");

export type CreateAiCheckerPayloadOptions = {
  text: string;
  temperature: number;
};

export function createAiCheckerPayload({
  text,
  temperature,
}: CreateAiCheckerPayloadOptions) {
  const sanitized = text.replace(/\r/g, "").trim();
  const prompt = `${AI_CHECKER_PROMPT}\n\n--- テキストここから ---\n${sanitized}\n--- テキストここまで ---`;

  return {
    contents: [
      {
        role: "user" as const,
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      topP: 0.8,
      topK: 32,
    },
  };
}
