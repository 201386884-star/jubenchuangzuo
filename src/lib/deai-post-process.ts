// ============================================================
// 后处理统计调整模块
// 在 LLM 改写之后，用代码做统计层精确控制
// 目标：打散 AI 统计指纹（困惑度、突发性、n-gram 重复）
// ============================================================

// -------------------- 格式标记保护 --------------------

// 需要保护的短剧格式标记正则
const FORMAT_PATTERNS = [
  /【第\d+集】/g,
  /\[零桢画面[：:].*?\]/g,
  /^▶\s*.*/gm,
  /[（(].*?[）)]/g,            // 情绪标注
  /\w+OS[：:].*/g,             // 内心独白
  /\w+VO[：:].*/g,             // 画外音
  /\[(?:特写|闪回|快速反转|假卡点|强卡点)[^\]]*\]/g,
  /^\d+-\d+\s+.*/gm,          // 场景编号行
  /^人物[：:].*/gm,            // 人物行
];

interface DeaiPostOptions {
  /** 是否保留格式标记不动 */
  protectFormat?: boolean;
  /** 句长变异强度 0-1 */
  sentenceVariation?: number;
  /** 连接词替换强度 0-1 */
  connectorReplace?: number;
  /** 是否注入不完美 */
  injectImperfection?: boolean;
}

// -------------------- 连接词替换表 --------------------

const CONNECTOR_MAP: Record<string, string[]> = {
  '然而': ['结果', '没想到', '哪知道', '偏偏'],
  '因此': ['这不', '搞得', '所以', '弄到最后'],
  '尽管': ['虽说', '虽然说', '话是这么说'],
  '同时': ['这边', '另一边', '另一边呢'],
  '此外': ['还有一件事', '对了', '还有'],
  '总之': ['反正', '怎么说呢', '归根到底'],
  '例如': ['就好比', '比如', '拿...来说'],
  '于是': ['然后', '结果', '这下'],
  '而且': ['还', '再加上', '更别提'],
  '不仅': ['不光', '不光是', '不光这样'],
  '虽然': ['虽说', '话是这么说', '虽然吧'],
  '但是': ['可', '偏偏', '但问题是'],
  '所以': ['搞得', '这不', '弄到最后'],
  '如果': ['要是', '万一', '如果真'],
  '应该': ['得', '得要', '该'],
  '已经': ['早', '早就', '都...了'],
  '突然': ['猛地', '一下子', '忽然'],
  '立刻': ['马上', '立马', '蹭的一下'],
  '非常': ['贼', '巨', '特别', '超'],
  '极其': ['贼', '巨', '超级'],
  '确实': ['确实', '真就', '还真就是'],
  '似乎': ['好像', '感觉', '看着像'],
  '必定': ['肯定', '必须', '铁定'],
  '完全': ['彻底', '完全就', '简直'],
  '逐渐': ['一点一点', '慢慢', '渐渐'],
  '不禁': [''], // 直接删掉
  '缓缓': ['慢慢', '一点点', '慢慢地'],
  '微微': [''], // 直接删掉
  '淡淡': ['随口', '轻轻'],
};

// -------------------- AI高频词替换 --------------------

const AI_WORD_MAP: Record<string, string[]> = {
  '绽放': ['冒出来', '蹦出来', '出来了'],
  '浮现': ['冒出来', '出来', '来了'],
  '弥漫': ['到处都是', '满屋子', '全是'],
  '笼罩': ['盖住', '罩住', '铺满'],
  '交织': ['混在一起', '搅在一起', '缠在一起'],
  '流淌': ['流着', '往下流', '流了'],
  '凝固': ['僵住', '不动了', '定住了'],
  '弥漫着': ['到处都是', '满是'],
  '宛如': ['像', '就跟', '就像'],
  '犹如': ['像', '就跟', '就好比'],
  '仿佛': ['好像', '感觉像', '就像'],
};

// -------------------- 随机选择工具 --------------------

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBool(probability: number): boolean {
  return Math.random() < probability;
}

// -------------------- 核心处理函数 --------------------

/**
 * 保护格式标记：将标记替换为占位符，处理完再还原
 */
function protectAndRestore(text: string): { protected: string; restore: (s: string) => string } {
  const placeholders: { placeholder: string; original: string }[] = [];
  let protected_ = text;

  for (const pattern of FORMAT_PATTERNS) {
    // Reset regex lastIndex
    pattern.lastIndex = 0;
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(protected_)) !== null) {
      const idx = placeholders.length;
      const placeholder = `__FORMAT_${idx}__`;
      placeholders.push({ placeholder, original: match[0] });
      protected_ = protected_.replace(match[0], placeholder);
    }
  }

  return {
    protected: protected_,
    restore: (s: string) => {
      let result = s;
      for (const { placeholder, original } of placeholders) {
        result = result.replace(placeholder, original);
      }
      return result;
    },
  };
}

/**
 * 连接词替换
 */
function replaceConnectors(text: string, intensity: number): string {
  let result = text;
  for (const [word, replacements] of Object.entries(CONNECTOR_MAP)) {
    if (result.includes(word) && randomBool(intensity)) {
      const replacement = randomPick(replacements);
      // 替换一部分（不是全部），更自然
      const regex = new RegExp(word, 'g');
      result = result.replace(regex, (match) => {
        return randomBool(0.7) ? replacement : match;
      });
    }
  }
  return result;
}

/**
 * AI高频词替换
 */
function replaceAIWords(text: string): string {
  let result = text;
  for (const [word, replacements] of Object.entries(AI_WORD_MAP)) {
    if (result.includes(word) && randomBool(0.6)) {
      result = result.replace(new RegExp(word, 'g'), randomPick(replacements));
    }
  }
  return result;
}

/**
 * 句长打散：让相邻句子长度差异更大（提高 burstiness）
 */
function varySentenceLength(text: string, intensity: number): string {
  const lines = text.split('\n');

  return lines.map(line => {
    // 只处理对话行和叙述行，不处理标记行
    if (line.startsWith('【') || line.startsWith('[') || line.startsWith('▶') || line.match(/^\d+-\d+/) || line.startsWith('人物')) {
      return line;
    }

    const sentences = line.split(/([。！？!?]+)/);
    if (sentences.length < 3) return line;

    const result: string[] = [];
    for (let i = 0; i < sentences.length; i++) {
      const sent = sentences[i];
      // 标点符号直接保留
      if (sent.match(/^[。！？!?]+$/)) {
        result.push(sent);
        continue;
      }

      if (sent.length > 25 && randomBool(intensity * 0.5)) {
        // 长句拆短：在逗号处拆开
        const parts = sent.split('，');
        if (parts.length >= 2) {
          const mid = Math.floor(parts.length / 2);
          result.push(parts.slice(0, mid).join('，'));
          result.push('，');
          result.push(parts.slice(mid).join('，'));
          continue;
        }
      }

      if (sent.length < 5 && randomBool(intensity * 0.3)) {
        // 极短句，有一定概率保持原样（人味）
      }

      result.push(sent);
    }

    return result.join('');
  }).join('\n');
}

/**
 * 注入不完美：重复词、省略、碎碎念
 */
function injectImperfection(text: string): string {
  const lines = text.split('\n');

  return lines.map(line => {
    // 只处理对话行
    const dialogMatch = line.match(/^(\s*\w+[（(][^）)]*[）)]?[：:])\s*(.+)/);
    if (!dialogMatch) return line;

    const prefix = dialogMatch[1];
    const dialog = dialogMatch[2];

    // 低概率注入重复强调（约5%的句子）
    if (randomBool(0.05) && dialog.length > 4) {
      const firstChar = dialog[0];
      const repeats = Math.floor(Math.random() * 2) + 2; // 2-3次
      return `${prefix}${firstChar.repeat(repeats)}...${dialog}`;
    }

    // 低概率注入碎碎念结尾（约3%）
    if (randomBool(0.03) && dialog.length > 10) {
      return `${line}...算了算了`;
    }

    return line;
  }).join('\n');
}

/**
 * 主处理函数
 */
export function deaiPostProcess(
  text: string,
  options: DeaiPostOptions = {}
): {
  processed: string;
  stats: {
    connectorsReplaced: number;
    sentencesModified: number;
    imperfectionsInjected: number;
    formatPreserved: number;
  };
} {
  const {
    protectFormat = true,
    sentenceVariation = 0.5,
    connectorReplace = 0.7,
    injectImperfection: shouldInject = true,
  } = options;

  // Step 1: 保护格式标记
  const { protected: protectedText, restore } = protectFormat
    ? protectAndRestore(text)
    : { protected: text, restore: (s: string) => s };

  // Count formats
  const formatCount = FORMAT_PATTERNS.reduce((count, pattern) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    return count + (protectedText.match(regex)?.length || 0);
  }, 0);

  // Step 2: 统计替换前的连接词数
  let connectorsBefore = 0;
  for (const word of Object.keys(CONNECTOR_MAP)) {
    const matches = protectedText.match(new RegExp(word, 'g'));
    if (matches) connectorsBefore += matches.length;
  }

  // Step 3: 连接词替换
  let processed = replaceConnectors(protectedText, connectorReplace);

  // Count replaced
  let connectorsAfter = 0;
  for (const word of Object.keys(CONNECTOR_MAP)) {
    const matches = processed.match(new RegExp(word, 'g'));
    if (matches) connectorsAfter += matches.length;
  }
  const connectorsReplaced = connectorsBefore - connectorsAfter;

  // Step 4: AI高频词替换
  processed = replaceAIWords(processed);

  // Step 5: 句长打散
  processed = varySentenceLength(processed, sentenceVariation);

  // Step 6: 注入不完美
  let imperfections = 0;
  if (shouldInject) {
    const before = processed;
    processed = injectImperfection(processed);
    // Rough count of injected imperfections
    imperfections = (processed.match(/算了算了|(\w)\1{2,}\.\.\./g)?.length || 0);
  }

  // Step 7: 还原格式标记
  processed = restore(processed);

  return {
    processed,
    stats: {
      connectorsReplaced: Math.max(0, connectorsReplaced),
      sentencesModified: 0, // 由 LLM 层统计
      imperfectionsInjected: imperfections,
      formatPreserved: formatCount,
    },
  };
}
