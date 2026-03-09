interface ConversationStartersProps {
  onSelect: (text: string) => void
}

const STARTERS = [
  'Phân tích giao dịch của tôi',
  'Xu hướng chi tiêu là gì?',
  'Nhận xét chi tiêu tức thời',
  'Báo cáo chi tiêu hàng tháng',
]

export function ConversationStarters({ onSelect }: ConversationStartersProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center px-4">
      {STARTERS.map((text) => (
        <button
          key={text}
          onClick={() => onSelect(text)}
          className="px-3 py-1.5 text-sm font-medium rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors duration-200 border border-border"
        >
          {text}
        </button>
      ))}
    </div>
  )
}
