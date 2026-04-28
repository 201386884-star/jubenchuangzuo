// ============================================================
// 剧本生成 Prompt V2（竖屏分镜格式 + 状态追踪 + 钩子链版）
// ============================================================

interface ScriptPromptOptions {
  episodeNumber: number;
  totalEpisodes: number;
  genre: string;
  logline: string;
  characters: {
    protagonist: { name: string; trait: string; goal: string; goldenFinger?: string };
    antagonist: { name: string; trait: string; motivation: string };
    supporter?: { name: string; trait: string };
    loveInterest?: { name: string; trait: string };
    secondaryVillain?: { name: string; trait: string };
  };
  worldSetting: string;
  coreConflicts: string[];
  previousSummary?: string;
  previousContent?: string;    // 上一集完整内容
  platform: string;
  paymentPoints?: number[];
  satisfactionPointTypes?: string[];
  userGuidance?: string;       // 用户创作方向建议
  episodeOutline?: {           // 该集的分集梗概
    title: string;
    synopsis: string;
    keyEvent: string;
    emotionalBeat: string;
  };
  nextEpisodeOutline?: {       // 下一集的分集梗概（用于衔接）
    title: string;
    synopsis: string;
    keyEvent: string;
  };
  episodeDuration?: number;    // 每集时长（分钟）
}

export function generateScriptPrompt(options: ScriptPromptOptions): string {
  const {
    episodeNumber,
    totalEpisodes,
    genre,
    logline,
    characters,
    worldSetting,
    coreConflicts,
    previousSummary,
    platform,
    paymentPoints = [],
    satisfactionPointTypes = [],
  } = options;

  const userGuidance = options.userGuidance;
  const episodeOutline = options.episodeOutline;

  // 根据每集时长计算目标字数（1分钟=800字，取中间值）
  const duration = options.episodeDuration || 1;
  const targetWordCount = Math.round(duration * 800);
  const wordCountRange = `${targetWordCount}字左右`;

  // 动态阶段信息
  const getStageInfo = (ep: number, total: number) => {
    const ratio = ep / total;
    if (ratio <= 0.05) return {
      stage: '开场爆发期',
      rhythm: '2大爽点+3小爽点/集，前3秒必炸',
      focus: '建立人物关系，展示主角潜力，制造初始冲突',
      intensity: '情绪爆发力：最大',
    };
    if (ratio <= 0.15) return {
      stage: '首次付费墙前夕',
      rhythm: '1大爽点+2小爽点/集，付费墙前集超级钩子',
      focus: '连环打脸，身份暗示，第一波情绪高潮',
      intensity: '悬念强度：最高',
    };
    if (ratio <= 0.4) return {
      stage: '留存深耕期',
      rhythm: '每2集1核心大爽点，每5集1大反转',
      focus: '身份逐步揭露，大佬撑腰，智谋博弈',
      intensity: '节奏稳定：持续高潮',
    };
    if (ratio <= 0.7) return {
      stage: '付费爆发期',
      rhythm: '每3集1超级大爽点，层层递进',
      focus: '终极复仇，全面身份曝光，阶层跨越',
      intensity: '情绪密度：极高',
    };
    if (ratio <= 0.9) return {
      stage: '高潮决战期',
      rhythm: '每集核心爽点，反转不断',
      focus: '终极对决，全面清算，真相大白',
      intensity: '爽感峰值：全剧最高',
    };
    return {
      stage: '终章收尾期',
      rhythm: '每集收束线索，最终大闭环',
      focus: '正义实现，情感闭环，善恶有报',
      intensity: '情绪释放：圆满',
    };
  };

  const stageInfo = getStageInfo(episodeNumber, totalEpisodes);
  const isPaymentPoint = paymentPoints.includes(episodeNumber);
  const paymentIndex = paymentPoints.indexOf(episodeNumber);
  const nextPaymentEp = paymentPoints.find(p => p > episodeNumber);

  // 人物信息
  const charInfo = `
**主角** ${characters.protagonist.name}：${characters.protagonist.trait} | 目标：${characters.protagonist.goal}${characters.protagonist.goldenFinger ? ' | 金手指：' + characters.protagonist.goldenFinger : ''}
**反派** ${characters.antagonist.name}：${characters.antagonist.trait} | 动机：${characters.antagonist.motivation}
${characters.supporter ? `**助攻** ${characters.supporter.name}：${characters.supporter.trait}` : ''}
${characters.loveInterest ? `**爱人** ${characters.loveInterest.name}：${characters.loveInterest.trait}` : ''}
${characters.secondaryVillain ? `**次反派** ${characters.secondaryVillain.name}：${characters.secondaryVillain.trait}` : ''}`.trim();

  return `你是一位爆款短剧编剧，代表作播放量破10亿。你精通竖屏短剧的「黄金3秒法则」、「钩子链传递」、「爽点密度公式」。

⚠️ 字数铁律（最高优先级）：本集正文必须控制在${targetWordCount}字左右（允许范围${Math.round(targetWordCount * 0.85)}-${Math.round(targetWordCount * 1.15)}字）。超出范围直接退稿！

## 当前任务
创作第${episodeNumber}集（共${totalEpisodes}集），正文${targetWordCount}字左右（±15%）

## 剧本信息
- 类型：${genre} | 平台：${platform}
- 每集时长：${duration}分钟 | 目标字数：${targetWordCount}字（范围${Math.round(targetWordCount * 0.85)}-${Math.round(targetWordCount * 1.15)}字）
- 简介：${logline}
- 背景：${worldSetting}
- 爽点类型：${satisfactionPointTypes.length ? satisfactionPointTypes.join('、') : '打脸逆袭、身份反转'}
- 核心冲突：${coreConflicts.join('；')}

## 当前阶段
- 阶段：${stageInfo.stage}（${stageInfo.intensity}）
- 爽点节奏：${stageInfo.rhythm}
- 本集重点：${stageInfo.focus}

## 人物
${charInfo}

${(() => {
  // 优先使用上集完整内容（截取最后800字确保不超 token）
  if (options.previousContent && episodeNumber > 1) {
    const tail = options.previousContent.length > 800
      ? '...' + options.previousContent.substring(options.previousContent.length - 800)
      : options.previousContent;
    return `## 上一集完整剧本（最后部分，本集开头必须紧密衔接此处结尾！）\n${tail}\n`;
  }
  if (previousSummary) {
    return `## 前情提要（上一集结尾，本集开头必须紧密衔接！）\n${previousSummary}\n`;
  }
  return '';
})()}
${episodeOutline ? `## 本集大纲规划\n- 标题：${episodeOutline.title}\n- 梗概：${episodeOutline.synopsis}\n- 核心事件：${episodeOutline.keyEvent}\n- 情绪节拍：${episodeOutline.emotionalBeat}\n` : ''}
${options.nextEpisodeOutline ? `## ⚠️ 下一集预告（仅供参考衔接方向，不要写进本集！）\n- 下集标题：${options.nextEpisodeOutline.title}\n- 下集梗概：${options.nextEpisodeOutline.synopsis}\n- 下集核心事件：${options.nextEpisodeOutline.keyEvent}\n- 注意：以上信息仅用于本集结尾如何为下集埋伏笔，本集不要提前展开下集的剧情！\n` : ''}
${userGuidance ? `## 创作方向（用户建议）\n${userGuidance}\n` : ''}
${nextPaymentEp ? `## 节奏提示\n下一付费墙在第${nextPaymentEp}集，本集需要开始铺设悬念\n` : ''}
${isPaymentPoint ? `## ⚠️ 本集是第${paymentIndex + 1}个付费墙！\n结尾必须制造超级强悬念！强度是普通集的3倍！必须在"真相即将揭露"或"情绪最高涨"的瞬间戛然而止！\n` : ''}

---

## 竖屏短剧格式规范（严格遵守行业标准）

### 场景格式
\`\`\`
【第${episodeNumber}集】
[零桢画面：{用一句话描述第一帧的冲击画面}]

${episodeNumber}-1 {场景地点} {日/夜内/外}
人物：{角色名}（角色身份）、{角色名}

▶ {动作/画面/表情描述，用动词开头}
{角色名}（{情绪/动作}）：{台词}  ← 每句必须有情绪标注！
▶ {动作描述}
{角色名}（{情绪}）：{台词}
{角色名}OS：{内心独白，观众能听到剧中人听不到}
[特写/闪回/快速反转] {画面标注}

${episodeNumber}-2 {下一场景} {日/夜内/外}
人物：{角色名}
▶ {动作描述}
{角色名}：{台词}

[假卡点/强卡点]
\`\`\`

### 格式说明
- **[零桢画面]**：每集第一个画面，必须3秒内抓住眼球
- **▶**：动作/画面描述行（无对话的纯动作描写）
- **（情绪）**：角色说话时的情绪/动作标注
- **OS**：内心独白
- **VO**：画外音（看不到人但能听到声音）
- **[特写/闪回/快速反转]**：镜头语言标注
- **[假卡点/强卡点]**：集末卡点标记
- 每集3-6个场景，总字数严格控制在 ${wordCountRange}
- 场景编号格式：${episodeNumber}-1、${episodeNumber}-2

## 字数铁律（最重要！超出则退稿！）
- 本集正文字数目标：${targetWordCount}字（${duration}分钟 × 800字/分钟）
- 允许范围：${Math.round(targetWordCount * 0.85)}-${Math.round(targetWordCount * 1.15)}字（±15%）
- 严禁超出范围！超出直接退稿
- 通过减少场景数或缩短对话来控制字数

---

## 写作铁律

### 1. 前3秒铁律（最重要的规则！）
- **[零桢画面]** 必须是冲击性画面（冲突爆发、意外发现、情绪爆点）
- 第一句台词或动作必须让观众无法划走
- 禁止慢悠悠交代背景、平铺直叙开场

### 2. 对话铁律（人味引擎 — 基于32部真实短剧语料分析）
- 台词必须极度口语化，像身边人说话，不像写作文
- 单句台词不超过15字
- 禁止"然而"、"因此"、"尽管"、"虽然...但是"、"不过"等书面连接词

#### ⭐ 2.0 情绪标注铁律（最核心！每句必须带！）
**每一句台词后面必须带情绪/动作标注！** 禁止出现没有情绪标注的裸台词！
格式：角色名（情绪/动作）：台词

情绪标注必须具体、有画面感，不要用"说话""回答"这种废话标注！
正确示例：
- 赵天禄（翘着二郎腿，叼着烟）：哟呵，说三天还真来了？
- 纪行洲（可怜）：老婆，以后我只有你了！
- 明霜（悲伤）：完了，我要做妈妈！呜呜呜，我怎么养他啊！
- 纪行洲（郑重）：明小姐，有没有兴趣跟我结个婚？
- 林野（盯着他，一字一句）：卖房子。卖肾。你管得着吗？
- 女主（咬牙，眼眶泛红）：你以为钱能解决一切？
- 反派（狂笑，拍桌子）：就凭你？给我跪下！

情绪类型参考：
- 正面：兴奋、激动、得意、温柔、郑重、宠溺、心疼、感动、释然、骄傲
- 负面：愤怒、悲伤、委屈、绝望、咬牙、冷笑、厌恶、恐惧、崩溃、心虚
- 中性：淡然、好奇、困惑、犹豫、试探、审视、漫不经心、若有所思
- 动作类：拍桌、站起来、蹲下、转身、逼近、后退、跪下、鞠躬、摔杯子、撕碎
- 复合：（苦笑）、（强忍泪水）、（咬唇）、（攥紧拳头）、（颤抖着声音）

⚠️ 禁止的标注：「（说话）」「（回答）」「（说）」「（道）」——这些等于没标！

#### 2.1 语气词密度（硬指标）
每100字对话至少包含2个语气词。从以下词库中随机选取：
- 常用：啊、吧、呢、嘛、呀、哦、嗯、哎
- 情绪：切、靠、我靠、我去、妈的、得了、算了、行了
- 感叹：天啊、天呐、我的天、妈呀、哎呀、哎呦

#### 2.2 短回应比例（硬指标）
至少25%的对话是8字以内的短回应。高频短回应模板：
- 惊讶：「什么？」「什么？！」「怎么可能！」
- 追问：「什么意思？」「凭什么？」「怎么回事？」
- 情绪：「滚！」「闭嘴！」「放肆！」「找死！」
- 回应：「好。」「行。」「知道了。」「没问题。」「没兴趣。」
- 犹豫：「我……」「不是……」「那个……」
- 反问：「你说呢？」「是吗？」「就这？」「所以呢？」

#### 2.3 感叹句/问句密度（硬指标）
感叹号密度 ≥ 100次/万字，问号密度 ≥ 60次/万字。
多用反问推动剧情，不要用陈述句平铺直叙。

#### 2.4 句长波动
必须穿插极短句（≤4字）制造节奏感。禁止所有句子长度均匀。
参考分布：极短句(≤4字) 7%、短句(5-8字) 18%、中句(9-25字) 54%、长句(>25字) 21%

#### 2.5 打断与省略
- 用「——」表示被打断或话说到一半被截
- 用「……」表示犹豫、说不出口、欲言又止
- 用重复词表示慌张：「不，不是……」「我，我没有……」
- 角色说话不一定是完整句子，有时只说半句对方就懂了

#### 2.6 口语化句式（必须高频使用）
- 引导：「我跟你说」「你知道吗」「可不是嘛」「那可不」
- 催促：「赶紧的」「快点」「你倒是说啊」
- 否定：「得了吧」「少来」「别扯了」「别废话」
- 放弃：「算了」「行了」「好了」
- 质问：「搞什么」「你想干什么」「你笑什么」
- 感叹：「好家伙」「我去」「真行」「有意思」

#### 2.7 内心OS规范
OS必须是口语化短句，禁止长段分析式独白。
- 短OS示例：「这水有问题」「终于来了」「完了」
- 中OS示例：「早知道这小子这么好打发，之前就不费那么多工夫了」
- 禁止：长篇逻辑推理、信息量过大的独白、像论文一样的分析

### 2A. 对话铁律
- 每句台词必须推动剧情或制造情绪，删掉一切废话

### 3. 钩子链传递（关键！上下集必须衔接！）
- 本集开头：必须紧接上一集结尾的场景/事件，无缝衔接，不能跳跃！回收上集钩子 → 3秒内制造新冲突
- 本集发展：推进核心冲突 + 埋新伏笔
- 本集结尾：用强悬念断句（假卡点），让观众"恨得牙痒"或"急得跺脚"
- 钩子类型参考：生死危机/惊天反转/身份暴露/真相即将揭晓/情感临界点

### 4. 爽点密度控制
- 每10秒（约50-80字）：1个小反转/小情绪波动
- 每30秒（约150-240字）：1个大爽点/大反转
- 公式：极致压制 + 反差反转 + 即时兑现

### 5. 情绪铁律
- 不含蓄，要极致——极致的愤怒、极致的反转、极致的打脸
- 反派嚣张时长不超过30秒，反杀必须直给
- 前期压制越狠，后期爽感越强
- **每句台词必须带情绪/动作标注，禁止裸台词**——情绪是短剧的灵魂，没有情绪标注的台词等于没有灵魂
- 动作描写（▶）也要有情绪张力，描述要有画面冲击感，不要干巴巴的描述

### 6. 分镜思维
- 每个画面都要能截成竖屏短视频
- 动作描写要具体、有画面感
- 注意人物表情特写和反应镜头

只输出剧本正文，不要输出任何说明文字。

### 8. 参考范本（严格对照此格式！）

❌ 错误示例（没有情绪，干巴巴）：

林野（点头）：成交。
▶ 店员从保险柜里掏出六沓钱，码在桌上
店员（小声）：哥们儿……这表来路正吗？
林野（看着他，笑）：你说呢？
赵天禄（站起来，眯着老花眼）：你……你他妈哪来这么多钱？
林野：八十万，一分不少。欠条还我。

✅ 正确示例（有情绪，有画面，有节奏）：

纪行洲（可怜巴巴）：老婆，以后我只有你了！
△明霜听完觉得恶心，转身去厕所吐。
明霜（厌恶，干呕）：少说油腻的话！真他妈恶心！
纪行洲（猛然想起）：你生理期是每个月10号……这个月还没来！
△明霜摸摸自己的肚子，愣住。
纪行洲（激动得跳起来）：该不会真有了吧？！
△明霜打开厕所门，脸色难看地把验孕棒递给纪行洲。
△纪行洲看到两道杠，兴奋得把明霜抱起来转圈。
纪行洲（狂喜，搂着明霜转圈）：我要做爸爸了！哈哈哈！
明霜（悲伤，崩溃）：完了……我要做妈妈……呜呜呜……
纪行洲（单膝跪地，从兜里掏出戒指，郑重）：明小姐，有没有兴趣跟我结个婚？

⚠️ 核心区别：每句台词必须有具体情绪！没有情绪标注的台词=不合格！

### 7. 结尾标记（必须遵守！）
- 每集正文最后一行必须输出【第${episodeNumber}集完】
- 这是完整性校验标记，不可缺少。无论篇幅多少，结尾都必须带上此标记
- 如果感觉内容即将结束但还没输出标记，立即补上标记再结束`;
}

export function parseScriptResponse(episodeNumber: number, response: string): {
  scene: string;
  content: string;
  paymentHook: string;
  summary: string;
  isComplete: boolean;
} {
  // 检测完整性：是否包含【第x集完】标记
  let isComplete = response.includes(`【第${episodeNumber}集完】`);

  // 如果不完整（模型被截断），自动补上结尾标记
  let fullResponse = response;
  if (!isComplete) {
    fullResponse = response.trimEnd() + `\n\n【第${episodeNumber}集完】`;
    isComplete = true;
  }

  // 提取零桢画面
  const zeroFrameMatch = fullResponse.match(/\[零桢画面[：:]\s*([^\]]+)\]/);

  // 提取第一个场景
  const sceneMatch = fullResponse.match(/(?:${episodeNumber}-1|1-1)\s+([^\n]+)/);
  const scene = sceneMatch ? sceneMatch[1].trim() : (zeroFrameMatch ? zeroFrameMatch[1].trim() : '场景待定');

  // 提取付费点（支持多种格式）
  const paymentMatch = fullResponse.match(/【本集付费点】[：:]\s*(.+?)(?:\n|$)/i)
    || fullResponse.match(/\[(?:假卡点|强卡点)[：:]?\s*([^\]]*)\]/)
    || fullResponse.match(/【付费钩子】[：:]\s*(.+?)(?:\n|$)/i);
  const paymentHook = paymentMatch ? paymentMatch[1].trim() : '查看集末悬念';

  // 提取内容（移除集数标题、付费点标注、结尾标记）
  let content = fullResponse
    .replace(/^【第\d+集】\s*/m, '')
    .replace(/【本集付费点】[：:].+$/gmi, '')
    .replace(/\[(?:假卡点|强卡点)[^\]]*\]\s*/g, '')
    .replace(/【第\d+集完】\s*/g, '')
    .trim();

  // 生成摘要（取最后300字，用于下集衔接）
  const plainText = content
    .replace(/▶\s*/g, '')
    .replace(/\d+-\d+\s+[^\n]+\n?/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[A-Z]{2}[：:]/g, '');
  // 取最后300字作为前情提要，确保下一集能衔接本集结尾
  const tailText = plainText.length > 300
    ? plainText.substring(plainText.length - 300)
    : plainText;
  const summary = `第${episodeNumber}集：${tailText.replace(/\n/g, ' ').trim()}`;

  return { scene, content, paymentHook, summary, isComplete };
}
