export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/token',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/change-password',
    PREFERENCES: '/auth/preferences',
    SET_ALIYUN_KEY: '/auth/aliyun-key',
    VERIFY_ALIYUN_KEY: '/auth/aliyun-key/verify',
  },
  TTS: {
    LANGUAGES: '/tts/languages',
    SPEAKERS: '/tts/speakers',
    CUSTOM_VOICE: '/tts/custom-voice',
    VOICE_DESIGN: '/tts/voice-design',
    VOICE_CLONE: '/tts/voice-clone',
  },
  JOBS: {
    LIST: '/jobs',
    GET: (id: number) => `/jobs/${id}`,
    DELETE: (id: number) => `/jobs/${id}`,
    AUDIO: (id: number) => `/jobs/${id}/download`,
  },
  USERS: {
    LIST: '/users',
    CREATE: '/users',
    GET: (id: number) => `/users/${id}`,
    UPDATE: (id: number) => `/users/${id}`,
    DELETE: (id: number) => `/users/${id}`,
  },
  VOICE_DESIGNS: {
    LIST: '/voice-designs',
    CREATE: '/voice-designs',
    PREPARE_CLONE: (id: number) => `/voice-designs/${id}/prepare-clone`,
  },
} as const

export const LANGUAGE_NAMES: Record<string, string> = {
  'Auto': '自动检测',
  'Chinese': '中文',
  'English': '英语',
  'Japanese': '日语',
  'Korean': '韩语',
  'German': '德语',
  'French': '法语',
  'Russian': '俄语',
  'Portuguese': '葡萄牙语',
  'Spanish': '西班牙语',
  'Italian': '意大利语',
  'Cantonese': '粤语',
}

export const SPEAKER_DESCRIPTIONS_ZH: Record<string, string> = {
  'Vivian': '女性，专业清晰',
  'Serena': '女性，温柔温暖',
  'Uncle_Fu': '男性，成熟权威',
  'Dylan': '男性，年轻活力',
  'Eric': '男性，沉稳稳重',
  'Ryan': '男性，友好随和',
  'Aiden': '男性，低沉浑厚',
  'Ono_Anna': '女性，可爱活泼',
  'Sohee': '女性，柔和悦耳',
}

export const DEFAULT_FORM_VALUES = {
  CUSTOM_VOICE: {
    text: '',
    language: 'Auto',
    speaker: '',
    instruct: '',
  },
  VOICE_DESIGN: {
    text: '',
    language: 'Auto',
    instruct: '',
  },
  VOICE_CLONE: {
    text: '',
    ref_audio: null,
    ref_text: '',
  },
} as const

export const PRESET_INSTRUCTS = [
  {
    label: '开心',
    instruct: '非常开心',
    text: '今天天气真好，我们一起去公园玩吧！',
  },
  {
    label: '悲伤',
    instruct: '很悲伤，带着哭腔',
    text: '对不起，我真的尽力了，但还是让你失望了。',
  },
  {
    label: '愤怒',
    instruct: '非常愤怒，语气激烈',
    text: '你怎么能这样做！这简直太过分了！',
  },
  {
    label: '温柔关怀',
    instruct: '温柔体贴，语速平缓，音调柔和，充满关怀和安慰',
    text: '别担心，一切都会好起来的。我会一直陪在你身边。',
  },
  {
    label: '兴奋激动',
    instruct: '非常兴奋激动，语速加快，音调上扬，充满活力和热情',
    text: '太棒了！我们终于成功了！这真是太令人激动了！',
  },
  {
    label: '焦虑紧张',
    instruct: '焦虑不安的语气，语速略快，音调不稳定，带有紧张和担忧',
    text: '怎么办？时间不够了，我们来不及了，这可怎么办才好？',
  },
  {
    label: '专业播音员',
    instruct: '专业新闻播音员。语速：标准播音语速，吐字清晰。情绪：沉稳专业，不带个人感情色彩。语调：平直中略有起伏，重点词汇加重。性格特征：严谨、客观、权威。',
    text: '据新华社报道，我国航天事业取得重大突破，神舟系列飞船成功完成载人飞行任务。',
  },
  {
    label: '温暖导师',
    instruct: '温暖导师。语速：不急不缓，娓娓道来。音调：平稳中带有鼓励性上扬。情绪：关怀、耐心、鼓励。性格：善解人意，循循善诱，充满正能量。',
    text: '每个人都有自己的节奏，不要着急。慢慢来，你一定能找到属于自己的那条路。',
  },
  {
    label: '活力少年',
    instruct: '充满活力。语速：偏快，吐字利落。情绪：开朗乐观，精力充沛。语调：跳跃感强，抑扬顿挫。性格：外向、自信、热情，充满青春气息。',
    text: '哇，这个游戏太酷了！咱们组队一起玩吧，我保证带你们飞！',
  },
] as const

export const PRESET_VOICE_DESIGNS = [
  {
    label: '甜美少女',
    instruct: '年轻女性，音色清甜明亮，略带少女的娇俏感。音高偏高，语调活泼富于变化。语速适中，吐字清晰。情绪愉悦轻松，充满青春活力。适合场景：客服语音、语音助手、娱乐内容。',
    text: '您好，很高兴为您服务！请问有什么可以帮助您的吗？',
  },
  {
    label: '成熟女性',
    instruct: '成熟知性的女性声音，音色温润饱满，带有职业女性的干练气质。音高中等，音域稳定。语速适中偏快，条理清晰。情绪从容自信，传递专业可靠的感觉。',
    text: '根据最新的市场分析报告，本季度业绩呈现稳步增长态势，各项指标均达到预期目标。',
  },
  {
    label: '磁性男声',
    instruct: '中低音男性声音，音色深沉磁性，富有感染力。语速偏慢，节奏沉稳。音量适中，声音浑厚有力。适合情感类、故事讲述、品牌宣传等场景。',
    text: '夜深了，城市的灯火依然璀璨。每一盏灯下，都有一个关于梦想的故事。',
  },
  {
    label: '活力青年',
    instruct: '充满活力的年轻男性，音色明亮清晰，带有青春朝气。语速较快，节奏感强。情绪热情积极，富有感染力。适合运动、游戏、娱乐等场景。',
    text: '兄弟们，准备好了吗？今天我们要挑战全新的副本，冲冲冲！',
  },
  {
    label: '权威专家',
    instruct: '中年男性专家形象，音色沉稳权威，声音浑厚有力。语速适中，吐字清晰标准。情绪严肃专业，传递信任感和专业度。适合学术讲座、知识科普、正式场合。',
    text: '从历史发展的角度来看，科技创新始终是推动社会进步的核心动力。',
  },
  {
    label: '温柔妈妈',
    instruct: '温柔慈爱的中年女性，音色柔和温暖，充满母性关怀。语速舒缓，音调平和安抚。情绪温暖体贴，给人安全感。适合儿童内容、情感陪伴、睡前故事。',
    text: '宝贝，该睡觉了。妈妈给你讲个故事，从前有一只小兔子，它住在森林里...',
  },
  {
    label: '播音主持',
    instruct: '专业播音主持人声音，音色饱满圆润，标准普通话发音。音高适中，音域宽广。语速标准，节奏把控精准。情绪专业沉稳，字正腔圆。适合新闻播报、节目主持、正式朗读。',
    text: '各位听众朋友大家好，欢迎收听今天的节目。接下来为您带来今日要闻。',
  },
  {
    label: '俏皮少女',
    instruct: '俏皮可爱的少女音色，声音轻快灵动，带有少女特有的活泼感。音调偏高且富于变化，语气中带有撒娇和卖萌的元素。语速时快时慢，吐字清晰但带有可爱的语气词。',
    text: '哎呀，人家不是故意的嘛~你就原谅我一次好不好？拜托拜托啦~',
  },
] as const

export const PRESET_REF_TEXTS = [
  {
    label: '自然生活',
    text: '在这个快节奏的世界里，我们总是在赶路，却忘了停下来听听内心的声音。其实，生活不仅仅是眼前的忙碌，还有远方的诗意和偶然发现的小确幸。希望这段录音，能像午后的微风一样，带给你一点点温柔和力量。无论未来如何变化，请记得保持对生活的热爱，去拥抱每一个灿烂的明天。',
  },
  {
    label: '专业正式',
    text: '科技的进步让我们能够跨越时空的界限，用数字化的方式延续情感与记忆。语音克隆不仅是精密的代码逻辑，更是连接人类与未来智能的纽带。通过深度学习与神经网络的不断演进，每一个细微的语调起伏，都能被精准地捕捉。让我们共同见证，技术如何赋予声音更具生命力的表达。',
  },
  {
    label: '文学叙事',
    text: '春天的风拂过柳梢，带着泥土的芬芳和花开的消息。你是否也曾期待过，在某个街角的转弯处，遇见那个久违的自己？无论是高亢的欢笑，还是低沉的呢喃，每一种声音都是独一无二的生命印记。让我们在此刻记录当下，让回忆在流淌的声音里，化作永恒的旋律。',
  },
] as const

export const POLL_INTERVAL = 2000

export const TIMEOUT_WARNING = 30000

export const MAX_FILE_SIZE = 10 * 1024 * 1024

export const MIN_AUDIO_DURATION = 3

export const ADVANCED_PARAMS_INFO = {
  max_new_tokens: {
    label: '最大生成长度',
    description: '控制生成音频的最大长度。值越大,可生成的音频越长,但处理时间也会增加',
    tooltip: '建议值: 2048-4096。超过 8000 可能导致生成时间过长',
  },
  temperature: {
    label: '温度',
    description: '控制生成的随机性。值越高生成越随机多样,值越低越稳定一致',
    tooltip: '推荐范围: 0.1-0.5 (稳定) | 0.6-1.0 (多样) | >1.0 (创意)',
  },
  top_k: {
    label: 'Top K',
    description: '采样时只考虑概率最高的 K 个候选。值越小生成越确定,越大越多样',
    tooltip: '常用值: 20-50。过小可能导致重复,过大可能不连贯',
  },
  top_p: {
    label: 'Top P (核采样)',
    description: '累积概率阈值,只从累积概率达到 P 的候选中采样。控制输出多样性',
    tooltip: '推荐值: 0.7-0.9。0.9 更自然多变,0.7 更稳定可控',
  },
  repetition_penalty: {
    label: '重复惩罚',
    description: '惩罚重复内容的生成。值越大越避免重复,但过大可能影响自然度',
    tooltip: '建议范围: 1.0-1.2。1.0 表示无惩罚,1.05 适合大多数场景',
  },
} as const
