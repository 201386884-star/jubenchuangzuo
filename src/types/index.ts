// ============================================================
// 短剧剧本生成系统 - 类型定义
// ============================================================

// -------------------- 基础类型 --------------------

export type Genre =
  | '复仇' | '甜宠' | '穿越' | '都市' | '古风'
  | '悬疑' | '职场' | '校园' | '玄幻' | '家庭';

export type Platform = 'ReelShort' | '抖音' | '快手' | '微信视频号';

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'ollama';

export type AIFlavorLevel = 'none' | 'light' | 'medium' | 'heavy';

export type ScriptStatus = 'draft' | 'generating' | 'complete' | 'evaluated';

// -------------------- 故事大纲 --------------------

export interface EpisodeSynopsis {
  episodeNumber: number;
  title: string;              // 集标题
  synopsis: string;           // 1-2句梗概
  keyEvent?: string;          // 本集核心事件
  emotionalBeat?: string;     // 情绪节拍
  paymentHook?: string;       // 付费点悬念描述
  satisfactionTypes?: string[]; // 使用的爽点类型
}

export interface Character {
  name: string;
  trait: string;
  role: 'protagonist' | 'antagonist' | 'supporter' | 'love_interest';
  gender?: string;
  age?: string;
  backstory?: string;
  goldenFinger?: string;
  goal?: string;
  arc?: string;
  motivation?: string;
  threatLevel?: string;
}

export interface PlotStructure {
  setup: string;       // 起始阶段
  development: string; // 发展阶段
  climax: string;      // 高潮阶段
  resolution: string;  // 结局阶段
}

export interface StoryOutline {
  id: string;
  userInput: string;           // 用户输入的一句话
  genre: Genre | Genre[];       // 类型
  logline: string;            // 一句话简介
  title?: string;             // 剧名
  alternativeTitles?: string[]; // 备选剧名
  synopsis?: string;          // 故事梗概
  formula?: string;           // 路线公式
  targetAudience?: string;    // 目标受众
  characters: {
    protagonist: Character;
    antagonist: Character;
    supporter?: Character;
    loveInterest?: Character;
    secondaryVillain?: Character;
    mentor?: Character;
  };
  worldSetting: string;        // 世界观/背景
  coreConflicts: string[];     // 核心冲突列表
  plotStructure: PlotStructure;
  episodeOutline?: { range: string; title: string; summary: string }[];
  episodeOutlines?: EpisodeSynopsis[];  // 详细分集梗概
  paymentPoints: number[];    // 建议的付费点集数
  satisfactionPointTypes?: string[];
  emotionalArc: string;       // 整体情绪走向
  buzzScenes?: string[];      // 预计爆点名场面
  episodeDuration?: number;   // 每集时长（分钟）
  orientation?: 'vertical' | 'horizontal'; // 竖屏/横屏
  createdAt: Date;
}

// -------------------- 剧本 --------------------

export interface EpisodeScript {
  episodeNumber: number;
  scene: string;              // 场景描述
  timeOfDay: '日内' | '日外' | '夜内' | '夜外' | '晨' | '昏';
  content: string;            // 剧本内容（对话+动作）
  paymentHook: string;        // 付费点悬念
  summary: string;            // 本集摘要（用于下一集前情）
  isComplete?: boolean;       // 是否包含【第x集完】标记
}

export interface Script {
  id: string;
  outlineId: string;
  title: string;
  platform: Platform;
  totalEpisodes: number;
  episodes: EpisodeScript[];
  generatedUpTo?: number;       // 已生成到第几集
  status: ScriptStatus;
  aiFlavorLevel: AIFlavorLevel;
  createdAt: Date;
  updatedAt: Date;
}

// -------------------- 评估 --------------------

export interface DimensionScore {
  score: number;      // 0-100
  comment: string;    // 评价说明
}

export interface ImprovementSuggestion {
  episode: number;
  issue: string;
  suggestion: string;
}

export interface ScriptEvaluation {
  id: string;
  scriptId: string;
  overallScore: number;
  dimensionScores: {
    hook: DimensionScore;
    emotionDensity: DimensionScore;
    twistDesign: DimensionScore;
    paymentDesign: DimensionScore;
    dialogueNaturalness: DimensionScore;
    marketAdaptation: DimensionScore;
  };
  strengths: string[];
  weaknesses: string[];
  improvementSuggestions: ImprovementSuggestion[];
  marketPositioning: string;
  createdAt: Date;
}

// -------------------- 模型配置 --------------------

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  modelName: string;
  apiKey?: string;
  isDefault: boolean;
  settings: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  createdAt: Date;
}

// -------------------- 学习库 --------------------

export interface LearningScript {
  id: string;
  title: string;
  content: string;
  genre: Genre;
  source?: string;
  performanceData?: {
    views?: number;
    likes?: number;
    shares?: number;
    rating?: number;
  };
  featuresExtracted?: {
    hookTypes: string[];
    emotionPatterns: string[];
    paymentPointPatterns: string[];
    dialogueStyle: string;
  };
  vectorId?: string;
  createdAt: Date;
}

// -------------------- 用户设置 --------------------

export interface UserSettings {
  id: string;
  defaultModel?: string;
  defaultPlatform: Platform;
  defaultEpisodes: number;
  defaultGenre?: Genre;
  aiFlavorPreference: AIFlavorLevel;
  theme: 'light' | 'dark' | 'auto';
  updatedAt: Date;
}

// -------------------- API 请求/响应 --------------------

export interface GenerateOutlineRequest {
  userInput: string;
  genre?: Genre;
  platform?: Platform;
}

export interface GenerateOutlineResponse {
  success: boolean;
  outline?: StoryOutline;
  error?: string;
}

export interface GenerateScriptRequest {
  outlineId: string;
  outline: StoryOutline;
  episodes: number;
  platform: Platform;
  modelProvider?: ModelProvider;
  aiFlavorLevel?: AIFlavorLevel;
}

export interface GenerateScriptResponse {
  success: boolean;
  script?: Script;
  error?: string;
  progress?: number;
}

export interface RemoveAIFlavorRequest {
  scriptContent: string;
  level: AIFlavorLevel;
  modelProvider?: ModelProvider;
}

export interface RemoveAIFlavorResponse {
  success: boolean;
  deAIedContent?: string;
  modifications?: string[];
  error?: string;
}

export interface EvaluateScriptRequest {
  scriptId: string;
  script: Script;
  platform: Platform;
  modelProvider?: ModelProvider;
}

export interface EvaluateScriptResponse {
  success: boolean;
  evaluation?: ScriptEvaluation;
  error?: string;
}

// -------------------- 剧本润色历史记录 --------------------

export interface DeAIRound {
  round: number;
  content: string;
  aiProbability?: number;
  stats: {
    connectorsReplaced: number;
    sentencesModified: number;
    imperfectionsInjected: number;
    formatPreserved: number;
  };
  modifications: string[];
  timestamp: string;
}

export interface DeAISession {
  id: string;
  title: string;
  originalContent: string;
  finalContent: string;
  config: {
    level: AIFlavorLevel;
    dialectStyle: string;
    genre?: string;
    apiModelName: string;
    enablePostProcess: boolean;
    iterationMode: 'manual' | 'auto';
    maxIterations?: number;
    targetProbability?: number;
  };
  rounds: DeAIRound[];
  status: 'processing' | 'completed' | 'failed';
  tags: string[];
  inputAiProbability?: number;
  outputAiProbability?: number;
  createdAt: string;
  updatedAt: string;
}

// -------------------- 前端状态 --------------------

export interface AppState {
  mode: 'simple' | 'pro';
  currentOutline?: StoryOutline;
  currentScript?: Script;
  currentEvaluation?: ScriptEvaluation;
  isGenerating: boolean;
  generationProgress: number;
  selectedModel: ModelProvider;
  settings: UserSettings;
}
