import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | null = null

/** Nạp script Turnstile MỘT lần cho cả app; lỗi mạng thì cho phép thử lại ở lần mount sau. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    script.onerror = () => reject(new Error('turnstile script failed'))
    document.head.appendChild(script)
  }).catch((e: unknown) => {
    scriptPromise = null
    throw e
  })
  return scriptPromise
}

type Props = {
  siteKey: string
  /** Token mới khi giải xong; null khi hết hạn / lỗi (token chỉ dùng 1 lần — form phải mount lại widget sau mỗi lần gửi). */
  onToken: (token: string | null) => void
}

/** Widget Cloudflare Turnstile. Đổi `key` của component để lấy token mới sau mỗi lần submit. */
export function CaptchaWidget({ siteKey, onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Ref để effect không chạy lại (render lại widget) mỗi khi parent tạo callback mới.
  const onTokenRef = useRef(onToken)
  useEffect(() => { onTokenRef.current = onToken })

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return
        widgetId = api.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          language: 'vi',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => onTokenRef.current(null))
    return () => {
      cancelled = true
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [siteKey])

  return <div ref={containerRef} className="min-h-[65px]" />
}
