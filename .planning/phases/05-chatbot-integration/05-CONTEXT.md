# Phase 5: Chatbot Integration - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Chatbot Integration delivers a conversational AI interface within the finance application. Users can configure and interact with an LLM chatbot to ask questions and get financial insights. The feature includes:
- Web chat interface integrated into the main app
- Settings/configuration for API credentials (API key) and model selection
- Chat communication via an LLM SDK library (Anthropic Claude SDK, OpenAI SDK, or similar)
- Basic chat history for the current session
- Message rendering with markdown support and streaming responses

</domain>

<decisions>
## Implementation Decisions

### Chat Interface Placement & Design
- **UI Pattern:** Floating chat button (bottom-right corner) that opens/closes a collapsible chat panel
- **Desktop:** Chat panel slides in from the right when chat button is clicked (≥768px width)
- **Mobile:** Chat panel takes full screen or fills available viewport (375px-768px)
- **Appearance:** Modern rounded design consistent with existing shadcn/ui components
- **Integration:** Chat button appears in AppHeader (far right) and optionally on main pages as floating button
- **State:** Chat panel state persists during session (stays open/closed based on user's last action)

### Settings & API Configuration
- **Access Point:** Gear icon / Settings button within the ChatPanel header or in app settings
- **Configuration Modal:** Settings dialog for:
  - API Key input field (password-masked, required)
  - Model selection dropdown (e.g., "Claude 3 Opus", "Claude 3 Sonnet", "GPT-4", etc.)
  - Save/Cancel buttons
- **Credential Storage:** localStorage (client-side, for this v1 — no server-side encryption yet)
- **Validation:** API key validation on form submit (check format, length)
- **Error Handling:** Clear error messages if API key is invalid or model not available

### LLM SDK & Connectivity
- **Primary SDK:** Anthropic Claude SDK (@anthropic-ai/sdk) — supports streaming, vision, tools
- **Fallback/Alternative:** Support for OpenAI SDK as a secondary option (claude's discretion on implementation order)
- **Communication:** Client-side API calls (direct from browser to LLM provider with user's API key)
- **Streaming:** Enable streaming responses for real-time message rendering (show tokens as they arrive)
- **Context Window:** Include conversation history in requests (previous messages as context)
- **System Prompt:** Default system prompt provides financial context (e.g., "You are a personal finance assistant for a Vietnamese user")

### Chat History & Message Features
- **History Storage:** localStorage for current session (clear on browser close or manually by user)
- **History UI:** Show conversation thread in ChatPanel, scrollable list of messages
- **Message Types:** User messages (left), assistant messages (right), with timestamps
- **Markdown Rendering:** Support markdown formatting in assistant responses (bold, italic, lists, code blocks)
- **Typing Indicator:** Show "Assistant is typing..." placeholder while waiting for streaming response
- **Message Features:**
  - Copy message to clipboard button
  - Regenerate assistant response on demand
  - Delete message from history
  - No message editing (keep simple for v1)
- **Error Recovery:** If API call fails, show error message in chat, allow user to retry

### Mobile Responsiveness
- **Chat Panel on Mobile:** Full-screen overlay (375px+) with bottom padding for keyboard
- **Input Field:** Native text input with send button (large touch targets >=48px)
- **Messages:** Full-width message bubbles with proper spacing for readability
- **Settings Modal:** Mobile-optimized modal that doesn't overflow viewport

### Claude's Discretion
- Exact color scheme for chat bubbles (user vs assistant)
- Chat panel width and animation timing
- Dropdown options for model selection (what models to include by default)
- System prompt exact wording and tone
- Message timestamp format (HH:MM, full date+time, relative time)
- Copy confirmation toast/notification

</decisions>

<specifics>
## Specific Ideas

- Chat button should have a dot/badge indicator when new messages arrive (if window is not focused)
- Allow users to clear chat history with a "Clear Chat" button in the settings
- Graceful degradation: if API key not set, show helpful message in chat asking user to configure
- Financial context: system prompt should mention the app's transaction data to encourage questions like "What was I spending on food last month?"
- Keyboard shortcut to focus/open chat (e.g., Cmd+Shift+K or Ctrl+Shift+K)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ChatButton, ChatInput, ChatMessage, ChatPanel, ChatSettings components** — Already stubbed in `src/features/chatbot/`, ready for implementation
- **useChatApi hook** — Stub exists, will handle LLM API calls
- **shadcn/ui components:** Button, Input, Dialog/Modal, Card, Badge — reuse for chat UI
- **Tailwind CSS:** Already configured with `@/` alias for imports
- **Zustand stores:** Can create a chatStore for chat state (messages, settings, UI state)
- **TanStack Query:** Can wrap API calls for caching/refetching if needed

### Established Patterns
- **State management:** Zustand stores (already used in app) — create `chatStore` for messages, settings, open/closed state
- **API communication:** axios + Zod validation (established pattern) — use for API key validation
- **Styling:** Tailwind CSS with shadcn/ui (consistent with existing pages)
- **Responsive design:** Tailwind breakpoints (sm, md, lg) — reuse same breakpoint strategy
- **Error handling:** Toast notifications via sonner (already imported in UI)

### Integration Points
- **Navigation:** Add chat button to AppHeader, integrate with existing nav layout
- **Settings:** Link to chat settings from app settings page or within ChatPanel
- **Data sharing:** Chatbot could reference transaction data (e.g., "Tell me about my spending trends") — future enhancement, not v1
- **localStorage:** Store API key, model choice, conversation history

</code_context>

<deferred>
## Deferred Ideas

- **Chat history persistence to server:** Save conversations to backend for cross-device access → Phase 6+
- **Chat history export:** Download chat as PDF or JSON → Phase 6+
- **Multi-conversation support:** Multiple separate chat threads/tabs → Phase 6+
- **Voice input/output:** Speak to chatbot, hear responses → Phase 6+ (accessibility feature)
- **Chatbot personality customization:** User chooses assistant tone (formal, casual, humorous) → Phase 6+
- **Financial data integration:** Chatbot accesses live transaction data to answer "What did I spend on X last month?" → Phase 6+ (requires data access controls)
- **Tool use / Function calling:** Chatbot can perform actions (create transactions, set budgets) → Phase 7+ (requires careful security)
- **Multi-language support:** Chatbot responses in Vietnamese, English, etc. → Phase 6+

</deferred>

---

*Phase: 05-chatbot-integration*
*Context gathered: 2026-03-04*
