import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, Mic } from 'lucide-react'
import { FileUploader } from '@/components/FileUploader'
import { AudioRecorder } from '@/components/AudioRecorder'

interface AudioInputSelectorProps {
  value: File | null
  onChange: (file: File | null) => void
  error?: string
}

export function AudioInputSelector({ value, onChange, error }: AudioInputSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>('upload')

  const handleTabChange = (newTab: string) => {
    onChange(null)
    setActiveTab(newTab)
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="upload" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          上传文件
        </TabsTrigger>
        <TabsTrigger value="record" className="flex items-center gap-2">
          <Mic className="h-4 w-4" />
          录制音频
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-4">
        <FileUploader value={value} onChange={onChange} error={error} />
      </TabsContent>

      <TabsContent value="record" className="mt-4">
        <AudioRecorder onChange={onChange} />
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </TabsContent>
    </Tabs>
  )
}
