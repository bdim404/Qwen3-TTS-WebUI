import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEffect, useState, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Settings, Globe2, Type, Play, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { IconLabel } from '@/components/IconLabel'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ttsApi, jobApi } from '@/lib/api'
import { useJobPolling } from '@/hooks/useJobPolling'
import { useHistoryContext } from '@/contexts/HistoryContext'
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
  backend: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export interface VoiceDesignFormHandle {
  loadParams: (params: any) => void
}

const VoiceDesignForm = forwardRef<VoiceDesignFormHandle>((_props, ref) => {
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

  const { currentJob, isPolling, isCompleted, startPolling, elapsedTime } = useJobPolling()
  const { refresh } = useHistoryContext()

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
      backend: 'local',
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
      setValue('backend', params.backend || 'local')
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
      try {
        await refresh()
      } catch {}
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      <div className="space-y-0.5">
        <Label>后端选择</Label>
        <Select
          value={watch('backend')}
          onValueChange={(value: string) => setValue('backend', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">本地模型</SelectItem>
            <SelectItem value="aliyun">阿里云 API</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-0.5">
        <IconLabel icon={Globe2} tooltip="语言" required />
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

      <div className="space-y-0.5">
        <IconLabel icon={Type} tooltip="合成文本" required />
        <Textarea
          {...register('text')}
          placeholder="输入要合成的文本..."
          className="min-h-[40px] md:min-h-[60px]"
        />
        {errors.text && (
          <p className="text-sm text-destructive">{errors.text.message}</p>
        )}
      </div>

      <div className="space-y-0.5">
        <IconLabel icon={Palette} tooltip="音色描述" required />
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

      <Dialog open={advancedOpen} onOpenChange={(open) => {
        if (open) {
          setTempAdvancedParams({
            max_new_tokens: watch('max_new_tokens'),
            temperature: watch('temperature'),
            top_k: watch('top_k'),
            top_p: watch('top_p'),
            repetition_penalty: watch('repetition_penalty')
          })
        }
        setAdvancedOpen(open)
      }}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="w-full">
            <Settings className="mr-2 h-4 w-4" />
            高级选项
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>高级参数设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dialog-max_new_tokens">
                {ADVANCED_PARAMS_INFO.max_new_tokens.label}
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
                {ADVANCED_PARAMS_INFO.max_new_tokens.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-temperature">
                {ADVANCED_PARAMS_INFO.temperature.label}
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
                {ADVANCED_PARAMS_INFO.temperature.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-top_k">
                {ADVANCED_PARAMS_INFO.top_k.label}
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
                {ADVANCED_PARAMS_INFO.top_k.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-top_p">
                {ADVANCED_PARAMS_INFO.top_p.label}
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
                {ADVANCED_PARAMS_INFO.top_p.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-repetition_penalty">
                {ADVANCED_PARAMS_INFO.repetition_penalty.label}
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
                {ADVANCED_PARAMS_INFO.repetition_penalty.description}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTempAdvancedParams({
                  max_new_tokens: watch('max_new_tokens'),
                  temperature: watch('temperature'),
                  top_k: watch('top_k'),
                  top_p: watch('top_p'),
                  repetition_penalty: watch('repetition_penalty')
                })
                setAdvancedOpen(false)
              }}
            >
              取消
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
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="submit" className="w-full" disabled={isLoading || isPolling}>
              <Play className="mr-2 h-4 w-4" />
              {isLoading ? '创建中...' : '生成语音'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>生成语音</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

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
