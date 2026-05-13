export type LengthMode = "spotify-edit" | "dj-extended";

export interface GenerationParams {
  genre: string;
  bpm: number;
  key: string;
  length: LengthMode;
  vocalStyle: string;
  mood: string;
  hookWord: string;
  marketFocus: string;
  references: string[];
}

export interface MusicPromptResult {
  prompt: string;
  receipts: string[]; // 3 bullet justifications mapping params -> Avi Snow data
}

export interface VocalPromptResult {
  styleField: string;
  lyricsField: string;
  receipts: string[];
}

export interface HistoryEntry {
  timestamp: number;
  params: GenerationParams;
  music: MusicPromptResult;
  vocal: VocalPromptResult;
  presetLabel?: string;
}
