import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import enUS from './locales/en-US.json'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import jaJP from './locales/ja-JP.json'
import koKR from './locales/ko-KR.json'

export type Dict = typeof enUS

export const LOCALES: Record<string, { label: string; dict: Dict }> = {
  'en-US': { label: 'English', dict: enUS },
  'zh-CN': { label: '简体中文', dict: zhCN },
  'zh-TW': { label: '繁體中文', dict: zhTW },
  'ja-JP': { label: '日本語', dict: jaJP },
  'ko-KR': { label: '한국어', dict: koKR },
}

function detect(): string {
  try {
    const saved = localStorage.getItem('lang')
    if (saved && saved in LOCALES) return saved
  } catch {}
  const nav = navigator.language
  if (/^zh-(TW|HK|MO|Hant)/i.test(nav)) return 'zh-TW'
  if (nav.startsWith('zh')) return 'zh-CN'
  if (nav.startsWith('ja')) return 'ja-JP'
  if (nav.startsWith('ko')) return 'ko-KR'
  return 'en-US'
}

function lookup(dict: unknown, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict)
  return typeof value === 'string' ? value : undefined
}

type Ctx = {
  lang: string
  setLang: (lang: string) => void
  dict: Dict
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(detect)
  const dict = LOCALES[lang].dict

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (next: string) => {
    setLangState(next)
    try {
      localStorage.setItem('lang', next)
    } catch {}
  }

  const t = (key: string, vars?: Record<string, string | number>) => {
    const text = lookup(dict, key) ?? lookup(enUS, key) ?? key
    return vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : text
  }

  return <I18nContext.Provider value={{ lang, setLang, dict, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)!
}
