---
name: chatbot-dev
description: >
  Develop or extend the AI chatbot feature in FinanceManager using the Anthropic SDK.
  Use this skill when the user wants to modify the chatbot, add streaming, change the AI model,
  update the chat UI, modify chatStore, add tool use to the chatbot, or integrate new Claude API features.
  Covers @anthropic-ai/sdk usage, chatStore, ChatPanel components, and API key management.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# Chatbot Dev Skill — FinanceManager

## Chatbot Architecture

```
src/features/chatbot/
├── ChatPanel.tsx       # Main chat container (open/close, message list)
├── ChatMessage.tsx     # Individual message bubble (user/assistant)
├── ChatInput.tsx       # Text input + send button
├── ChatSettings.tsx    # API key + model config dialog
├── ChatButton.tsx      # Floating button to open panel
└── useChatApi.ts       # Hook: sends messages to Anthropic API
```

**State:** `chatStore` (Zustand + localStorage)
**Button placement:** `AppShell.tsx` — floating chat button visible on all routes

## chatStore Fields

```ts
// src/stores/chatStore.ts
interface ChatState {
  messages: ChatMessage[]    // Persisted: finance-chat-history
  isOpen: boolean
  apiConfig: {               // Persisted: finance-chat-api-config
    apiKey: string
    model: string
  }
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
  setIsOpen: (open: boolean) => void
  setApiConfig: (config: Partial<ApiConfig>) => void
}
```

## Anthropic SDK Usage Pattern

Read `src/features/chatbot/useChatApi.ts` before modifying. The SDK is imported as:

```ts
import Anthropic from '@anthropic-ai/sdk'
```

### Basic Message (non-streaming)

```ts
const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

const response = await client.messages.create({
  model: apiConfig.model,   // e.g. 'claude-sonnet-4-6'
  max_tokens: 1024,
  messages: [
    { role: 'user', content: userMessage },
  ],
})

const text = response.content[0].type === 'text' ? response.content[0].text : ''
```

### Streaming Response

```ts
const stream = await client.messages.stream({
  model: apiConfig.model,
  max_tokens: 1024,
  messages: conversationHistory,
})

for await (const chunk of stream) {
  if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
    // Append chunk.delta.text to current message
    setCurrentResponse(prev => prev + chunk.delta.text)
  }
}
```

### With System Prompt (Finance Context)

```ts
const response = await client.messages.create({
  model: apiConfig.model,
  max_tokens: 2048,
  system: `You are a personal finance assistant for a Vietnamese user.
The user has bank accounts and credit cards with transactions in VND (Vietnamese Dong).
Help the user understand their spending, budgets, and financial patterns.
Format currency as "đ X.XXX.XXX" (Vietnamese format).`,
  messages: conversationHistory,
})
```

## Available Claude Models

Latest models (as of 2026):
- `claude-opus-4-6` — Most capable, slower
- `claude-sonnet-4-6` — Balanced (recommended default)
- `claude-haiku-4-5-20251001` — Fastest, most economical

## Tool Use Pattern (Claude API Tools)

If adding tool use to let the chatbot query transactions:

```ts
const tools: Anthropic.Tool[] = [
  {
    name: 'get_transaction_summary',
    description: 'Get spending summary for a date range',
    input_schema: {
      type: 'object' as const,
      properties: {
        dateFrom: { type: 'string', description: 'ISO date string' },
        dateTo: { type: 'string', description: 'ISO date string' },
        category: { type: 'string', description: 'Category to filter by' },
      },
      required: ['dateFrom', 'dateTo'],
    },
  },
]

const response = await client.messages.create({
  model, max_tokens: 2048,
  tools,
  messages,
})

// Handle tool_use blocks
if (response.stop_reason === 'tool_use') {
  const toolUseBlock = response.content.find(b => b.type === 'tool_use')
  // Execute tool locally, then send tool_result back
}
```

## API Key Security

- API key stored in localStorage: `finance-chat-api-config`
- `dangerouslyAllowBrowser: true` required for client-side Anthropic SDK
- Never commit API keys — chatStore only persists to localStorage
- User sets key via ChatSettings dialog

## Multi-turn Conversation History

```ts
// Build history from chatStore messages
const conversationHistory: Anthropic.MessageParam[] = messages.map(msg => ({
  role: msg.role,   // 'user' | 'assistant'
  content: msg.content,
}))
```

## Sub-Agent Usage

When extending chatbot functionality:
1. Read `src/features/chatbot/` files in parallel with an Explore sub-agent
2. Read `src/stores/chatStore.ts` to understand current state shape
3. Use the `claude-api` skill for advanced Anthropic SDK patterns

## UI Components for Chat

- `ChatPanel` — sliding panel with `isOpen` state
- `ChatMessage` — renders markdown from assistant with `prose` styling
- `ChatInput` — textarea with Shift+Enter newline, Enter to send
- `ChatSettings` — dialog for API key + model selection
- All use shadcn `Button`, `Input`, `Dialog` from `src/components/ui/`
