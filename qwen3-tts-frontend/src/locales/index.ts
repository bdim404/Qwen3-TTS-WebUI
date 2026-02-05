import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import zhCN from './zh-CN'
import zhTW from './zh-TW'
import enUS from './en-US'
import jaJP from './ja-JP'
import koKR from './ko-KR'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': zhCN,
      'zh-TW': zhTW,
      'en-US': enUS,
      'ja-JP': jaJP,
      'ko-KR': koKR,
    },
    fallbackLng: 'zh-CN',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n
