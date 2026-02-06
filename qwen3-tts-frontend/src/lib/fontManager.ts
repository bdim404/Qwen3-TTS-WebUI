type Language = 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP' | 'ko-KR'

interface FontConfig {
  name: string
  file: string
  unicodeRange?: string
}

const fontConfigs: Record<Language, FontConfig[]> = {
  'zh-CN': [
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-sc-regular.woff2',
      unicodeRange: 'U+4E00-9FFF, U+3400-4DBF, U+20000-2A6DF, U+2A700-2B73F, U+2B740-2B81F, U+2B820-2CEAF, U+F900-FAFF, U+2F800-2FA1F',
    },
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-latin-regular.woff2',
      unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  'zh-TW': [
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-tc-regular.woff2',
      unicodeRange: 'U+4E00-9FFF, U+3400-4DBF, U+F900-FAFF',
    },
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-sc-regular.woff2',
      unicodeRange: 'U+20000-2A6DF, U+2A700-2B73F, U+2B740-2B81F, U+2B820-2CEAF, U+2F800-2FA1F',
    },
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-latin-regular.woff2',
      unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  'en-US': [
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-latin-regular.woff2',
      unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  'ja-JP': [
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-jp-regular.woff2',
      unicodeRange: 'U+3000-30FF, U+4E00-9FFF, U+FF00-FFEF',
    },
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-latin-regular.woff2',
      unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
  'ko-KR': [
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-kr-regular.woff2',
      unicodeRange: 'U+AC00-D7AF, U+1100-11FF, U+3130-318F',
    },
    {
      name: 'Noto Serif',
      file: '/fonts/noto-serif-latin-regular.woff2',
      unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    },
  ],
}

const loadedFonts = new Set<string>()

function createFontFace(config: FontConfig): FontFace {
  const descriptors: FontFaceDescriptors = {
    style: 'normal',
    weight: '400',
    display: 'swap',
  }

  if (config.unicodeRange) {
    descriptors.unicodeRange = config.unicodeRange
  }

  return new FontFace(config.name, `url(${config.file}) format('woff2')`, descriptors)
}

export async function loadFontsForLanguage(language: Language): Promise<void> {
  const configs = fontConfigs[language]
  if (!configs) return

  const loadPromises = configs.map(async (config) => {
    const fontKey = `${config.name}-${config.file}`

    if (loadedFonts.has(fontKey)) {
      return
    }

    try {
      const fontFace = createFontFace(config)
      await fontFace.load()
      document.fonts.add(fontFace)
      loadedFonts.add(fontKey)
    } catch (error) {
      console.warn(`Failed to load font ${config.file}:`, error)
    }
  })

  await Promise.all(loadPromises)
}

export function detectBrowserLanguage(): Language {
  const browserLang = navigator.language.toLowerCase()

  if (browserLang.startsWith('zh-tw') || browserLang.startsWith('zh-hk') || browserLang.startsWith('zh-mo')) {
    return 'zh-TW'
  }
  if (browserLang.startsWith('zh')) {
    return 'zh-CN'
  }
  if (browserLang.startsWith('ja')) {
    return 'ja-JP'
  }
  if (browserLang.startsWith('ko')) {
    return 'ko-KR'
  }

  return 'en-US'
}

export function preloadBaseFont(): void {
  const baseConfig: FontConfig = {
    name: 'Noto Serif',
    file: '/fonts/noto-serif-latin-regular.woff2',
    unicodeRange: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  }

  const fontKey = `${baseConfig.name}-${baseConfig.file}`

  if (loadedFonts.has(fontKey)) {
    return
  }

  const fontFace = createFontFace(baseConfig)
  fontFace.load()
    .then(() => {
      document.fonts.add(fontFace)
      loadedFonts.add(fontKey)
    })
    .catch((error) => {
      console.warn('Failed to preload base font:', error)
    })
}
