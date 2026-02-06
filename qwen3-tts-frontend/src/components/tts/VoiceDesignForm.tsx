import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEffect, useState, forwardRef, useImperativeHandle, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Settings, Globe2, Type, Play, Palette, Save } from 'lucide-react'
import { toast } from 'sonner'
import { IconLabel } from '@/components/IconLabel'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ttsApi, jobApi, voiceDesignApi } from '@/lib/api'
import { useJobPolling } from '@/hooks/useJobPolling'
import { useHistoryContext } from '@/contexts/HistoryContext'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { LoadingState } from '@/components/LoadingState'
import { AudioPlayer } from '@/components/AudioPlayer'
import { PresetSelector } from '@/components/PresetSelector'
import type { Language } from '@/types/tts'

type FormData = {
  text: string
  language: string
  instruct: string
  max_new_tokens?: number
  temperature?: number
  top_k?: number
  top_p?: number
  repetition_penalty?: number
}

export interface VoiceDesignFormHandle {
  loadParams: (params: any) => void
}

const VoiceDesignForm = forwardRef<VoiceDesignFormHandle>((_props, ref) => {
  const { t } = useTranslation('tts')
  const { t: tCommon } = useTranslation('common')
  const { t: tErrors } = useTranslation('errors')
  const { t: tConstants } = useTranslation('constants')

  const PRESET_VOICE_DESIGNS = useMemo(() => tConstants('presetVoiceDesigns', { returnObjects: true }) as Array<{ label: string; instruct: string; text: string }>, [tConstants])

  const formSchema = z.object({
    text: z.string().min(1, tErrors('validation.required', { field: tErrors('fieldNames.text') })).max(5000, tErrors('validation.maxLength', { field: tErrors('fieldNames.text'), max: 5000 })),
    language: z.string().min(1, tErrors('validation.required', { field: tErrors('fieldNames.language') })),
    instruct: z.string().min(10, tErrors('validation.minLength', { field: tErrors('fieldNames.instruct'), min: 10 })).max(500, tErrors('validation.maxLength', { field: tErrors('fieldNames.instruct'), max: 500 })),
    max_new_tokens: z.number().min(1).max(10000).optional(),
    temperature: z.number().min(0).max(2).optional(),
    top_k: z.number().min(1).max(100).optional(),
    top_p: z.number().min(0).max(1).optional(),
    repetition_penalty: z.number().min(0).max(2).optional(),
  })
  const [languages, setLanguages] = useState<Language[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [tempAdvancedParams, setTempAdvancedParams] = useState({
    max_new_tokens: 2048,
    temperature: 0.3,
    top_k: 20,
    top_p: 0.7,
    repetition_penalty: 1.05
  })
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveDesignName, setSaveDesignName] = useState('')
  const [isPreparing, setIsPreparing] = useState(false)

  const { currentJob, isPolling, isCompleted, startPolling, elapsedTime } = useJobPolling()
  const { refresh } = useHistoryContext()
  const { preferences } = useUserPreferences()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: '',
      language: 'Auto',
      instruct: '',
      max_new_tokens: 2048,
      temperature: 0.3,
      top_k: 20,
      top_p: 0.7,
      repetition_penalty: 1.05,
    },
  })

  useImperativeHandle(ref, () => ({
    loadParams: (params: any) => {
      setValue('text', params.text || '')
      setValue('language', params.language || 'Auto')
      setValue('instruct', params.instruct || '')
      setValue('max_new_tokens', params.max_new_tokens || 2048)
      setValue('temperature', params.temperature || 0.3)
      setValue('top_k', params.top_k || 20)
      setValue('top_p', params.top_p || 0.7)
      setValue('repetition_penalty', params.repetition_penalty || 1.05)
    }
  }))

  useEffect(() => {
    const fetchData = async () => {
      try {
        const langs = await ttsApi.getLanguages()
        setLanguages(langs)
      } catch (error) {
        toast.error(t('loadDataFailed'))
      }
    }
    fetchData()
  }, [t])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const result = await ttsApi.createVoiceDesignJob(data)
      toast.success(t('taskCreated'))
      startPolling(result.job_id)
      try {
        await refresh()
      } catch {}
    } catch (error) {
      toast.error(t('taskCreateFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveDesign = async () => {
    const instruct = watch('instruct')
    if (!instruct || instruct.length < 10) {
      toast.error(t('fillDesignDescription'))
      return
    }
    if (!saveDesignName.trim()) {
      toast.error(t('fillDesignName'))
      return
    }

    try {
      const backend = preferences?.default_backend || 'local'
      const text = watch('text')
      const design = await voiceDesignApi.create({
        name: saveDesignName,
        instruct: instruct,
        backend_type: backend,
        preview_text: text || `${saveDesignName}的声音`
      })

      toast.success(t('designSaved'))

      if (backend === 'local') {
        setIsPreparing(true)
        try {
          await voiceDesignApi.prepareClone(design.id)
          toast.success(t('clonePrepared'))
        } catch (error) {
          toast.error(t('clonePrepareFailed'))
        } finally {
          setIsPreparing(false)
        }
      }

      setShowSaveDialog(false)
      setSaveDesignName('')
    } catch (error) {
      toast.error(t('saveFailed'))
    }
  }

  const memoizedAudioUrl = useMemo(() => {
    if (!currentJob) return ''
    return jobApi.getAudioUrl(currentJob.id, currentJob.audio_url)
  }, [currentJob?.id, currentJob?.audio_url])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <div className="space-y-0.5">
        <IconLabel icon={Globe2} tooltip={t('languageLabel')} required />
        <Select
          value={watch('language')}
          onValueChange={(value: string) => setValue('language', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {tConstants(`languages.${lang.code}`, { defaultValue: lang.name })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.language && (
          <p className="text-sm text-destructive">{errors.language.message}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <IconLabel icon={Type} tooltip={t('textLabel')} required />
        <Textarea
          {...register('text')}
          placeholder={t('textPlaceholder')}
          className="min-h-[40px] md:min-h-[60px]"
        />
        {errors.text && (
          <p className="text-sm text-destructive">{errors.text.message}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <IconLabel icon={Palette} tooltip={t('designDescriptionLabel')} required />
        <Textarea
          {...register('instruct')}
          placeholder={t('designDescriptionPlaceholder')}
          className="min-h-[40px] md:min-h-[60px]"
        />
        <PresetSelector
          presets={PRESET_VOICE_DESIGNS}
          onSelect={(preset) => {
            setValue('instruct', preset.instruct)
            if (preset.text) {
              setValue('text', preset.text)
            }
          }}
        />
        {errors.instruct && (
          <p className="text-sm text-destructive">{errors.instruct.message}</p>
        )}
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('saveDesignTitle')}</DialogTitle>
            <DialogDescription>{t('saveDesignDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="design-name">{t('designNameLabel')}</Label>
              <Input
                id="design-name"
                placeholder={t('designNamePlaceholder')}
                value={saveDesignName}
                onChange={(e) => setSaveDesignName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveDesign()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('designDescriptionLabel')}</Label>
              <p className="text-sm text-muted-foreground">{watch('instruct')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setShowSaveDialog(false)
              setSaveDesignName('')
            }}>
              {tCommon('cancel')}
            </Button>
            <Button type="button" onClick={handleSaveDesign} disabled={isPreparing}>
              {isPreparing ? t('preparing') : tCommon('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={advancedOpen} onOpenChange={(open) => {
        if (open) {
          setTempAdvancedParams({
            max_new_tokens: watch('max_new_tokens') || 2048,
            temperature: watch('temperature') || 0.3,
            top_k: watch('top_k') || 20,
            top_p: watch('top_p') || 0.7,
            repetition_penalty: watch('repetition_penalty') || 1.05
          })
        }
        setAdvancedOpen(open)
      }}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="w-full">
            <Settings className="mr-2 h-4 w-4" />
            {t('advancedOptions')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('advancedOptionsTitle')}</DialogTitle>
            <DialogDescription>{t('advancedOptionsDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dialog-max_new_tokens">
                {t('advancedParams.maxNewTokens.label')}
              </Label>
              <Input
                id="dialog-max_new_tokens"
                type="number"
                min={1}
                max={10000}
                value={tempAdvancedParams.max_new_tokens}
                onChange={(e) => setTempAdvancedParams({
                  ...tempAdvancedParams,
                  max_new_tokens: parseInt(e.target.value) || 2048
                })}
              />
              <p className="text-sm text-muted-foreground">
                {t('advancedParams.maxNewTokens.description')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-temperature">
                {t('advancedParams.temperature.label')}
              </Label>
              <Input
                id="dialog-temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={tempAdvancedParams.temperature}
                onChange={(e) => setTempAdvancedParams({
                  ...tempAdvancedParams,
                  temperature: parseFloat(e.target.value) || 0.3
                })}
              />
              <p className="text-sm text-muted-foreground">
                {t('advancedParams.temperature.description')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-top_k">
                {t('advancedParams.topK.label')}
              </Label>
              <Input
                id="dialog-top_k"
                type="number"
                min={1}
                max={100}
                value={tempAdvancedParams.top_k}
                onChange={(e) => setTempAdvancedParams({
                  ...tempAdvancedParams,
                  top_k: parseInt(e.target.value) || 20
                })}
              />
              <p className="text-sm text-muted-foreground">
                {t('advancedParams.topK.description')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-top_p">
                {t('advancedParams.topP.label')}
              </Label>
              <Input
                id="dialog-top_p"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={tempAdvancedParams.top_p}
                onChange={(e) => setTempAdvancedParams({
                  ...tempAdvancedParams,
                  top_p: parseFloat(e.target.value) || 0.7
                })}
              />
              <p className="text-sm text-muted-foreground">
                {t('advancedParams.topP.description')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-repetition_penalty">
                {t('advancedParams.repetitionPenalty.label')}
              </Label>
              <Input
                id="dialog-repetition_penalty"
                type="number"
                min={0}
                max={2}
                step={0.01}
                value={tempAdvancedParams.repetition_penalty}
                onChange={(e) => setTempAdvancedParams({
                  ...tempAdvancedParams,
                  repetition_penalty: parseFloat(e.target.value) || 1.05
                })}
              />
              <p className="text-sm text-muted-foreground">
                {t('advancedParams.repetitionPenalty.description')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTempAdvancedParams({
                  max_new_tokens: watch('max_new_tokens') || 2048,
                  temperature: watch('temperature') || 0.3,
                  top_k: watch('top_k') || 20,
                  top_p: watch('top_p') || 0.7,
                  repetition_penalty: watch('repetition_penalty') || 1.05
                })
                setAdvancedOpen(false)
              }}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setValue('max_new_tokens', tempAdvancedParams.max_new_tokens)
                setValue('temperature', tempAdvancedParams.temperature)
                setValue('top_k', tempAdvancedParams.top_k)
                setValue('top_p', tempAdvancedParams.top_p)
                setValue('repetition_penalty', tempAdvancedParams.repetition_penalty)
                setAdvancedOpen(false)
              }}
            >
              {tCommon('ok')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="submit" className="w-full" disabled={isLoading || isPolling}>
              <Play className="mr-2 h-4 w-4" />
              {isLoading ? t('creating') : t('generate')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('generate')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isPolling && <LoadingState elapsedTime={elapsedTime} />}

      {isCompleted && currentJob && (
        <div className="space-y-4 pt-4 border-t">
          <AudioPlayer
            audioUrl={memoizedAudioUrl}
            jobId={currentJob.id}
            text={currentJob.parameters?.text}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="mr-2 h-4 w-4" />
            {t('saveDesignButton')}
          </Button>
        </div>
      )}
    </form>
  )
})

export default VoiceDesignForm
