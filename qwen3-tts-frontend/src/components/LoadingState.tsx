import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface LoadingStateProps {
  elapsedTime: number
}

const LoadingState = memo(({ elapsedTime }: LoadingStateProps) => {
  const { t } = useTranslation('common')

  const displayText = elapsedTime > 60
    ? t('generationTakingLong')
    : t('generatingAudio')

  return (
    <div className="space-y-4 py-6">
      <p className="text-center text-muted-foreground">{displayText}</p>
      <p className="text-center text-sm text-muted-foreground">
        {t('waitedSeconds', { seconds: elapsedTime })}
      </p>
    </div>
  )
})

LoadingState.displayName = 'LoadingState'

export { LoadingState }
