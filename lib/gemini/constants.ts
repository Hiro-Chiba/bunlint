import { type StylePreset, type WritingStyle, type AiConfidenceLevel } from "./types";

export const writingStylePresets: Record<WritingStyle, StylePreset> = {
  dearu: {
    label: "だ・である調",
    description: "論文やレポートに適した、格調高い文体に整えます。",
    toneInstruction:
      "文体は常に『だ・である調』に統一し、丁寧語やですます調を使用しないでください。",
    strictToneInstruction:
      "丁寧語の語尾（です・ます・でした など）が一切残らないようにし、各文末を「だ」「である」「ではない」「であった」などの常体で統一してください。",
  },
  desumasu: {
    label: "です・ます調",
    description: "ビジネス文書や丁寧な説明文を想定した、読みやすい文体です。",
    toneInstruction:
      "文体は常に『です・ます調』に統一し、終止形は「です」「ます」で終わるようにしてください。",
    strictToneInstruction:
      "常体（だ・である 等）の語尾が残らないように確認し、すべての文末を「です」「ます」などの丁寧語で終わらせてください。",
  },
  humanize_desumasu: {
    label: "人間らしい変換（です・ます）",
    description:
      "段落構成や接続詞を整えつつ、丁寧で自然な語り口に整えるモードです。",
    toneInstruction:
      "文体は常に『です・ます調』に統一し、終止形は「です」「ます」で終わるようにしてください。",
    strictToneInstruction:
      "常体（だ・である 等）の語尾が残らないように確認し、すべての文末を「です」「ます」などの丁寧語で終わらせてください。",
    additionalDirectives: [
      "段落の切れ目や話題のまとまりを整理し、必要に応じて段落を分割または結合してください。",
      "要点が伝わりやすくなるよう、接続詞や指示語を補ったり語順を整えたりして文章の流れを滑らかにしてください。",
      "意味や事実関係を変えずに、語尾・助詞・表現のぎこちなさを自然な言い回しへ調整してください。",
    ],
    sample: {
      before:
        "昨日は雨で外に出るのをやめようと思った。友人との約束があったので行った。帰るころには疲れていて、そのまま寝た。",
      after:
        "昨日は雨だったので外出を迷いましたが、友人との約束があったため出かけました。用事を終えるころにはすっかり疲れており、帰宅後はすぐに休みました。",
      note: "段落や接続詞を整え、内容は変えずに読みやすさを高めた例です。",
    },
  },
  humanize_dearu: {
    label: "人間らしい変換（だ・である）",
    description:
      "論理的な構成と常体の語尾を両立させ、硬さを抑えた自然な文章に調整します。",
    toneInstruction:
      "文体は常に『だ・である調』に統一し、丁寧語やですます調を使用しないでください。",
    strictToneInstruction:
      "丁寧語の語尾（です・ます・でした など）が一切残らないようにし、各文末を「だ」「である」「ではない」「であった」などの常体で統一してください。",
    additionalDirectives: [
      "段落の切れ目や話題のまとまりを整理し、必要に応じて段落を分割または結合してください。",
      "要点が伝わりやすくなるよう、接続詞や指示語を補ったり語順を整えたりして文章の流れを滑らかにしてください。",
      "意味や事実関係を変えずに、語尾・助詞・表現のぎこちなさを自然な言い回しへ調整してください。",
    ],
    sample: {
      before:
        "昨日は雨で外に出るのをやめようと思った。友人との約束があったので行った。帰るころには疲れていて、そのまま寝た。",
      after:
        "昨日は雨だったため外出を迷ったが、友人との約束があったので出かけた。用事を終えるころにはすっかり疲れており、帰宅後はすぐに休んだ。",
      note: "常体を維持しながら段落構成と接続を滑らかに整えた例です。",
    },
  },
};

export const WRITING_STYLE_VALUES = Object.keys(writingStylePresets) as WritingStyle[];

export const LEGACY_WRITING_STYLE_ALIASES: Record<string, WritingStyle> = {
  humanize: "humanize_desumasu",
};

export const LEGACY_WRITING_STYLE_LABELS: Record<string, WritingStyle> = {
  人間らしい構成: "humanize_desumasu",
};

export const DEARU_STYLE_SET = new Set<WritingStyle>(["dearu", "humanize_dearu"]);

export const writingStyleSelectGroups: Array<{
  label: string;
  styles: WritingStyle[];
}> = [
  { label: "基本の語尾スタイル", styles: ["desumasu", "dearu"] },
  {
    label: "人間らしい文章構成",
    styles: ["humanize_desumasu", "humanize_dearu"],
  },
];

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash-lite";
export const GEMINI_FLASH_MODEL = "gemini-2.0-flash";
export const DEFAULT_API_VERSIONS = ["v1beta", "v1"] as const;

export const DEFAULT_REASONING_BY_CONFIDENCE: Record<AiConfidenceLevel, string> = {
  low: "AI生成らしさは低いと判断されました。",
  medium: "AI生成らしさは中程度と判断されました。",
  high: "AI生成らしさが高いと判断されました。",
};
