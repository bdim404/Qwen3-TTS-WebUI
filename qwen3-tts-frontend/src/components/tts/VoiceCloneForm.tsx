import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Settings, Globe2, Type, Play, FileText, Mic, ArrowRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { IconLabel } from '@/components/IconLabel'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ttsApi, jobApi } from '@/lib/api'
import { useJobPolling } from '@/hooks/useJobPolling'
import { useHistoryContext } from '@/contexts/HistoryContext'
import { LoadingState } from '@/components/LoadingState'
import { AudioPlayer } from '@/components/AudioPlayer'
import { FileUploader } from '@/components/FileUploader'
import { AudioRecorder } from '@/components/AudioRecorder'
import { PresetSelector } from '@/components/PresetSelector'
import { PRESET_REF_TEXTS, ADVANCED_PARAMS_INFO } from '@/lib/constants'
import type { Language } from '@/types/tts'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  const [step, setStep] = useState<1 | 2>(1)
  const [inputTab, setInputTab] = useState<'upload' | 'record'>('upload')
  const [tempAdvancedParams, setTempAdvancedParams] = useState({
    max_new_tokens: 2048
  })

  const { currentJob, isPolling, isCompleted, startPolling, elapsedTime } = useJobPolling()
  const { refresh } = useHistoryContext()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    trigger,
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

  useEffect(() => {
    if (inputTab === 'record' && PRESET_REF_TEXTS.length > 0) {
      setValue('ref_text', PRESET_REF_TEXTS[0].text)
    } else if (inputTab === 'upload') {
      setValue('ref_text', '')
    }
  }, [inputTab])

  const handleNextStep = async () => {
    // Validate step 1 fields
    const valid = await trigger(['ref_audio', 'ref_text'])
    if (valid) {
      setStep(2)
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const result = await ttsApi.createVoiceCloneJob({
        ...data,
        ref_audio: data.ref_audio,
      })
      toast.success('任务已创建')
      startPolling(result.job_id)
      try {
        await refresh()
      } catch { }
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Steps Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        <div className={`flex items-center space-x-2 ${step === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 1 ? 'border-primary bg-primary/10' : 'border-muted'}`}>1</div>
          <span className="text-sm font-medium">音频素材</span>
        </div>
        <div className="w-8 h-[2px] bg-muted" />
        <div className={`flex items-center space-x-2 ${step === 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 2 ? 'border-primary bg-primary/10' : 'border-muted'}`}>2</div>
          <span className="text-sm font-medium">合成设置</span>
        </div>
      </div>

      <div className={step === 1 ? 'block' : 'hidden'}>
        {/* Step 1: Input Selection */}
        <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              上传音频
            </TabsTrigger>
            <TabsTrigger value="record" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              在线录制
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4 mt-4">
            <div className="space-y-0.5">
              <Label>参考音频文件</Label>
              <Controller
                name="ref_audio"
                control={control}
                render={({ field }) => (
                  <FileUploader
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.ref_audio?.message}
                  />
                )}
              />
            </div>
            <div className="space-y-0.5">
              <Label>参考文稿（可选，提高准确率）</Label>
              <Textarea
                {...register('ref_text')}
                placeholder="参考音频对应的文本内容..."
                className="min-h-[100px]"
              />
              <PresetSelector
                presets={PRESET_REF_TEXTS}
                onSelect={(preset) => setValue('ref_text', preset.text)}
              />
            </div>

            <Button type="button" className="w-full mt-6" onClick={handleNextStep}>
              下一步
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </TabsContent>

          <TabsContent value="record" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-base font-medium">请朗读以下任一段落：</Label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_REF_TEXTS.map((preset, i) => {
                  const isSelected = watch('ref_text') === preset.text
                  return (
                    <div
                      key={i}
                      className={`p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors text-sm text-center ${
                        isSelected ? 'border-primary bg-primary/10' : ''
                      }`}
                      onClick={() => setValue('ref_text', preset.text)}
                    >
                      <div className="font-medium">{preset.label}</div>
                    </div>
                  )
                })}
              </div>
              <div className="space-y-0.5 pt-2">
                <Label>当前参考文本</Label>
                <Textarea
                  {...register('ref_text')}
                  placeholder="选中的文本将显示在这里..."
                  className="min-h-[80px]"
                />
              </div>
            </div>

            {/* Mobile-friendly Bottom Recorder Area */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t z-50 md:relative md:border-t-0 md:bg-transparent md:p-0 md:z-0">
              <div className="space-y-3">
                {watch('ref_audio') && (
                  <Button type="button" className="w-full" onClick={handleNextStep}>
                    下一步
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Controller
                  name="ref_audio"
                  control={control}
                  render={({ field }) => (
                    <AudioRecorder
                      onChange={field.onChange}
                    />
                  )}
                />
                {errors.ref_audio && (
                  <p className="text-sm text-destructive mt-2 text-center md:text-left">{errors.ref_audio.message}</p>
                )}
              </div>
            </div>
            {/* Spacer for mobile to prevent content being hidden behind fixed footer */}
            <div className="h-24 md:hidden" />
          </TabsContent>
        </Tabs>
      </div>

      <div className={step === 2 ? 'block space-y-4' : 'hidden'}>
        {/* Step 2: Synthesis Options */}
        <div className="space-y-0.5">
          <IconLabel icon={Globe2} tooltip="语言（可选）" />
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

        <div className="space-y-0.5">
          <IconLabel icon={Type} tooltip="合成文本" required />
          <Textarea
            {...register('text')}
            placeholder="输入要合成的文本..."
            className="min-h-[120px]"
          />
          <PresetSelector
            presets={PRESET_REF_TEXTS}
            onSelect={(preset) => setValue('text', preset.text)}
          />
          {errors.text && (
            <p className="text-sm text-destructive">{errors.text.message}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="x_vector_only_mode"
              checked={watch('x_vector_only_mode')}
              onCheckedChange={(c) => setValue('x_vector_only_mode', c as boolean)}
            />
            <Label htmlFor="x_vector_only_mode" className="text-sm font-normal cursor-pointer">
              快速模式
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="use_cache"
              checked={watch('use_cache')}
              onCheckedChange={(c) => setValue('use_cache', c as boolean)}
            />
            <Label htmlFor="use_cache" className="text-sm font-normal cursor-pointer">
              使用缓存
            </Label>
          </div>
        </div>

        <Dialog open={advancedOpen} onOpenChange={(open) => {
          if (open) {
            setTempAdvancedParams({
              max_new_tokens: watch('max_new_tokens') || 2048
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
              <DialogDescription>调整生成参数以控制音频质量和生成长度</DialogDescription>
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
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAdvancedOpen(false)
                }}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setValue('max_new_tokens', tempAdvancedParams.max_new_tokens)
                  setAdvancedOpen(false)
                }}
              >
                确定
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-1/3">
            <ArrowLeft className="mr-2 h-4 w-4" />
            上一步
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="submit" className="flex-1" disabled={isLoading || isPolling}>
                  <Play className="mr-2 h-4 w-4" />
                  {isLoading ? '创建中...' : '生成语音'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>生成语音</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

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
