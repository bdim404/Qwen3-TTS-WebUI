declare module '@arraypress/waveform-player' {
  export interface WaveformPlayerOptions {
    url?: string
    waveformStyle?: 'bars' | 'mirror' | 'line' | 'blocks' | 'dots' | 'seekbar'
    height?: number
    barWidth?: number
    barSpacing?: number
    samples?: number
    waveformColor?: string
    progressColor?: string
    buttonColor?: string
    showTime?: boolean
    showPlaybackSpeed?: boolean
    playbackRate?: number
    autoplay?: boolean
    enableMediaSession?: boolean
    title?: string
    subtitle?: string
    onLoad?: (player: WaveformPlayer) => void
    onPlay?: (player: WaveformPlayer) => void
    onPause?: (player: WaveformPlayer) => void
    onEnd?: (player: WaveformPlayer) => void
    onTimeUpdate?: (current: number, total: number, player: WaveformPlayer) => void
  }

  export default class WaveformPlayer {
    constructor(container: HTMLElement, options?: WaveformPlayerOptions)
    play(): void
    pause(): void
    togglePlay(): void
    seekTo(seconds: number): void
    setVolume(level: number): void
    destroy(): void
  }
}
