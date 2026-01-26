import { memo } from 'react'

interface LoadingStateProps {
  elapsedTime: number
}

const LoadingState = memo(({ elapsedTime }: LoadingStateProps) => {
  const displayText = elapsedTime > 60
    ? '生成用时较长,请耐心等待...'
    : '正在生成音频,请稍候...'

  return (
    <div className="space-y-4 py-6">
      <p className="text-center text-muted-foreground">{displayText}</p>
      <p className="text-center text-sm text-muted-foreground">
        已等待 {elapsedTime} 秒
      </p>
    </div>
  )
})

LoadingState.displayName = 'LoadingState'

export { LoadingState }
