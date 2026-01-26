import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { ttsApi, jobApi } from '@/lib/api'
import { useJobPolling } from '@/hooks/useJobPolling'
import { LoadingState } from '@/components/LoadingState'
import { AudioPlayer } from '@/components/AudioPlayer'
import { AudioInputSelector } from '@/components/AudioInputSelector'
import { PresetSelector } from '@/components/PresetSelector'
import { ParamInput } from '@/components/ParamInput'
import { PRESET_REF_TEXTS, ADVANCED_PARAMS_INFO } from '@/lib/constants'
import type { Language } from '@/types/tts'

const formSchema = z.object({
  text: z.string().min(1, '请输入要合成的文本').max(5000, '文本长度不能超过 5000 字符'),
  language: z.string().optional(),
  ref_audio: z.instanceof(File, { message: '请上传参考音频' }),
  ref_text: z.string().optional(),
  use_cache: z.boolean().optional(),
  x_vector_only_mode: z.boolean().optional(),
  max_new_tokens: z.number().min(1).max(10000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_k: z.number().min(1).max(100).optional(),
  top_p: z.number().min(0).max(1).optional(),
  repetition_penalty: z.number().min(0).max(2).optional(),
})

type FormData = z.infer<typeof formSchema>

function VoiceCloneForm() {
  const [languages, setLanguages] = useState<Language[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const { currentJob, isPolling, isCompleted, startPolling, elapsedTime } = useJobPolling()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: '',
      language: 'Auto',
      ref_text: '',
      use_cache: true,
      x_vector_only_mode: false,
      max_new_tokens: 2048,
      temperature: 0.3,
      top_k: 20,
      top_p: 0.7,
      repetition_penalty: 1.05,
    } as Partial<FormData>,
  })

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
      const result = await ttsApi.createVoiceCloneJob({
        ...data,
        ref_audio: data.ref_audio,
      })
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
        <Label htmlFor="ref_text">参考文稿（可选）</Label>
        <Textarea
          {...register('ref_text')}
          placeholder="参考音频对应的文本..."
          className="min-h-[40px] md:min-h-[60px]"
        />
        <PresetSelector
          presets={PRESET_REF_TEXTS}
          onSelect={(preset) => setValue('ref_text', preset.text)}
        />
        {errors.ref_text && (
          <p className="text-sm text-destructive">{errors.ref_text.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="ref_audio">参考音频</Label>
        <Controller
          name="ref_audio"
          control={control}
          render={({ field }) => (
            <AudioInputSelector
              value={field.value}
              onChange={field.onChange}
              error={errors.ref_audio?.message}
            />
          )}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="language">语言（可选）</Label>
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
      </div>

      <div className="space-y-1">
        <Label htmlFor="text">合成文本</Label>
        <Textarea
          {...register('text')}
          placeholder="输入要合成的文本..."
          className="min-h-[40px] md:min-h-[60px]"
        />
        <PresetSelector
          presets={PRESET_REF_TEXTS}
          onSelect={(preset) => setValue('text', preset.text)}
        />
        {errors.text && (
          <p className="text-sm text-destructive">{errors.text.message}</p>
        )}
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Controller
            name="x_vector_only_mode"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="x_vector_only_mode"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="x_vector_only_mode" className="text-sm font-normal">
            快速模式
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Controller
            name="use_cache"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="use_cache"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label htmlFor="use_cache" className="text-sm font-normal">
            使用缓存
          </Label>
        </div>
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
}

export default VoiceCloneForm
