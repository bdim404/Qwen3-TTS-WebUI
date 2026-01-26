import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEffect, useState, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { ttsApi, jobApi } from '@/lib/api'
import { useJobPolling } from '@/hooks/useJobPolling'
import { LoadingState } from '@/components/LoadingState'
import { AudioPlayer } from '@/components/AudioPlayer'
import { PresetSelector } from '@/components/PresetSelector'
import { ParamInput } from '@/components/ParamInput'
import { PRESET_VOICE_DESIGNS, ADVANCED_PARAMS_INFO } from '@/lib/constants'
import type { Language } from '@/types/tts'

const formSchema = z.object({
  text: z.string().min(1, '请输入要合成的文本').max(5000, '文本长度不能超过 5000 字符'),
  language: z.string().min(1, '请选择语言'),
  instruct: z.string().min(10, '音色描述至少需要 10 个字符').max(500, '音色描述不能超过 500 字符'),
  max_new_tokens: z.number().min(1).max(10000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_k: z.number().min(1).max(100).optional(),
  top_p: z.number().min(0).max(1).optional(),
  repetition_penalty: z.number().min(0).max(2).optional(),
})

type FormData = z.infer<typeof formSchema>

export interface VoiceDesignFormHandle {
  loadParams: (params: any) => void
}

const VoiceDesignForm = forwardRef<VoiceDesignFormHandle>((_props, ref) => {
  const [languages, setLanguages] = useState<Language[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const { currentJob, isPolling, isCompleted, startPolling, elapsedTime } = useJobPolling()

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
        toast.error('加载数据失败')
      }
    }
    fetchData()
  }, [])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const result = await ttsApi.createVoiceDesignJob(data)
      toast.success('任务已创建')
      startPolling(result.job_id)
    } catch (error) {
      toast.error('创建任务失败')
    } finally {
      setIsLoading(false)
    }
  }

  const memoizedAudioUrl = useMemo(() => {
    if (!currentJob) return ''
    return jobApi.getAudioUrl(currentJob.id, currentJob.audio_url)
  }, [currentJob?.id, currentJob?.audio_url])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="language">语言</Label>
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
                {lang.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.language && (
          <p className="text-sm text-destructive">{errors.language.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="text">合成文本</Label>
        <Textarea
          {...register('text')}
          placeholder="输入要合成的文本..."
          className="min-h-[40px] md:min-h-[60px]"
        />
        {errors.text && (
          <p className="text-sm text-destructive">{errors.text.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="instruct">音色描述</Label>
        <Textarea
          {...register('instruct')}
          placeholder="例如：成熟男性,低沉磁性,充满权威感"
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

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="w-full py-1.5">
            高级选项
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <ParamInput
            name="max_new_tokens"
            label={ADVANCED_PARAMS_INFO.max_new_tokens.label}
            description={ADVANCED_PARAMS_INFO.max_new_tokens.description}
            tooltip={ADVANCED_PARAMS_INFO.max_new_tokens.tooltip}
            register={register}
            min={1}
            max={10000}
          />
          <ParamInput
            name="temperature"
            label={ADVANCED_PARAMS_INFO.temperature.label}
            description={ADVANCED_PARAMS_INFO.temperature.description}
            tooltip={ADVANCED_PARAMS_INFO.temperature.tooltip}
            register={register}
            step={0.1}
            min={0}
            max={2}
          />
          <ParamInput
            name="top_k"
            label={ADVANCED_PARAMS_INFO.top_k.label}
            description={ADVANCED_PARAMS_INFO.top_k.description}
            tooltip={ADVANCED_PARAMS_INFO.top_k.tooltip}
            register={register}
            min={1}
            max={100}
          />
          <ParamInput
            name="top_p"
            label={ADVANCED_PARAMS_INFO.top_p.label}
            description={ADVANCED_PARAMS_INFO.top_p.description}
            tooltip={ADVANCED_PARAMS_INFO.top_p.tooltip}
            register={register}
            step={0.1}
            min={0}
            max={1}
          />
          <ParamInput
            name="repetition_penalty"
            label={ADVANCED_PARAMS_INFO.repetition_penalty.label}
            description={ADVANCED_PARAMS_INFO.repetition_penalty.description}
            tooltip={ADVANCED_PARAMS_INFO.repetition_penalty.tooltip}
            register={register}
            step={0.01}
            min={0}
            max={2}
          />
        </CollapsibleContent>
      </Collapsible>

      <Button type="submit" className="w-full" disabled={isLoading || isPolling}>
        {isLoading ? '创建中...' : '生成语音'}
      </Button>

      {isPolling && <LoadingState elapsedTime={elapsedTime} />}

      {isCompleted && currentJob && (
        <div className="space-y-4 pt-4 border-t">
          <AudioPlayer
            audioUrl={memoizedAudioUrl}
            jobId={currentJob.id}
          />
        </div>
      )}
    </form>
  )
})

export default VoiceDesignForm
