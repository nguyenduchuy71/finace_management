import { useState } from 'react'
import { Eye, EyeOff, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChatStore, type ApiConfig } from '@/stores/chatStore'

const MODELS = [
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
]

export function ChatSettings() {
  const { apiConfig, setApiConfig, toggleSettings } = useChatStore()

  const [model, setModel] = useState(apiConfig?.model ?? MODELS[0].value)
  const [apiKey, setApiKey] = useState(apiConfig?.apiKey ?? '')
  const [showKey, setShowKey] = useState(false)
  const [error, setError] = useState('')

  function handleSave() {
    if (!apiKey.trim()) {
      setError('Vui lòng nhập API key')
      return
    }

    const config: ApiConfig = { apiKey: apiKey.trim(), model }
    setApiConfig(config)
    setError('')
    toggleSettings()
  }

  function handleClear() {
    setApiConfig(null)
    setModel(MODELS[0].value)
    setApiKey('')
    toggleSettings()
  }

  return (
    <div className="p-4 space-y-3 border-b border-border">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Cài đặt API</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSettings}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full text-sm border border-input rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">API Key</label>
        <div className="relative">
          <Input
            type={showKey ? 'text' : 'password'}
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="text-sm pr-9"
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
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        API key được lưu trong localStorage của trình duyệt. Sử dụng Anthropic Claude API.
      </p>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} className="flex-1 min-h-[44px]">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Lưu cài đặt
        </Button>
        {apiConfig && (
          <Button size="sm" variant="outline" onClick={handleClear} className="min-h-[44px]">
            Xóa
          </Button>
        )}
      </div>
    </div>
  )
}
