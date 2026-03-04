import { useState } from 'react'
import { Eye, EyeOff, Save, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useChatStore } from '@/stores/chatStore'

const MODEL_OPTIONS = [
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Khuyên dùng)' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Nhanh)' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Mạnh nhất)' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Tiết kiệm)' },
] as const

export function ChatSettings() {
  const { apiConfig, setApiConfig, toggleSettings, clearMessages } = useChatStore()

  const [apiKey, setApiKey] = useState(apiConfig?.apiKey ?? '')
  const [model, setModel] = useState(apiConfig?.model ?? 'claude-3-5-sonnet-20241022')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')

  function handleSave() {
    if (!apiKey.trim()) {
      setError('Vui lòng nhập API key từ console.anthropic.com')
      return
    }
    if (!model) {
      setError('Vui lòng chọn model')
      return
    }
    setApiConfig({ apiKey: apiKey.trim(), model })
    setError('')
    toggleSettings()
  }

  function handleClearConfig() {
    setApiConfig(null)
    setApiKey('')
    setModel('claude-3-5-sonnet-20241022')
    setError('')
    toggleSettings()
  }

  function handleClearHistory() {
    clearMessages()
    toggleSettings()
  }

  return (
    <div className="p-4 space-y-3 border-b border-border bg-muted/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Cài đặt Chatbot</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleSettings}
          aria-label="Đóng cài đặt"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* API Key */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Anthropic API Key
        </label>
        <div className="relative">
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder="sk-ant-api03-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="text-sm pr-9"
            autoComplete="off"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setShowKey((v) => !v)}
            type="button"
            aria-label={showKey ? 'Ẩn API key' : 'Hiện API key'}
          >
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Lấy API key tại{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            console.anthropic.com
          </a>
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Model
        </label>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="text-sm min-h-[40px]">
            <SelectValue placeholder="Chọn model..." />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-sm">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error message */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          className="w-full min-h-[44px]"
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Lưu cài đặt
        </Button>

        <div className="flex gap-2">
          {apiConfig && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearConfig}
              className="flex-1 min-h-[44px] text-muted-foreground"
            >
              Xóa API key
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearHistory}
            className="flex-1 min-h-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Xóa chat
          </Button>
        </div>
      </div>
    </div>
  )
}
