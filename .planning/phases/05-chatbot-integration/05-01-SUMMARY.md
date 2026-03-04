---
phase: 05-chatbot-integration
plan: 01
subsystem: ui
tags: [react-markdown, zustand, localStorage, chat, keyboard-shortcut, markdown]

# Dependency graph
requires:
  - phase: 02-core-transaction-views
    provides: chatStore stub, ChatPanel/ChatMessage/ChatInput stubs, AppShell with ChatButton
provides:
  - ChatMessage with react-markdown rendering and copy/delete/regenerate hover actions
  - ChatPanel with typing indicator (3 animated dots), Ctrl+Shift+K keyboard shortcut, clear chat button
  - chatStore with localStorage message history persistence under 'finance-chat-history'
  - chatStore deleteMessage(id) and setRegenerateCallback actions
  - ApiConfig shape changed to {apiKey, model} for Anthropic SDK preparation
affects:
  - 05-02-PLAN (ChatSettings API key configuration — model selector already updated)
  - 05-03-PLAN (Anthropic SDK integration — useChatApi.ts placeholder ready)

# Tech tracking
tech-stack:
  added:
    - react-markdown@10.1.0 (markdown rendering for assistant messages)
  patterns:
    - group/group-hover Tailwind pattern for hover-reveal action buttons
    - keyboard shortcut useEffect before early return so listener works even when panel is closed
    - localStorage side-effect in Zustand set() callbacks for message persistence

key-files:
  created: []
  modified:
    - src/stores/chatStore.ts (localStorage history, deleteMessage, setRegenerateCallback, ApiConfig shape)
    - src/features/chatbot/ChatMessage.tsx (react-markdown, copy/regenerate/delete hover actions)
    - src/features/chatbot/ChatPanel.tsx (typing indicator, keyboard shortcut, clear chat button)
    - src/features/chatbot/ChatSettings.tsx (updated to use model selector instead of endpoint URL)
    - src/features/chatbot/useChatApi.ts (updated to use new ApiConfig shape, placeholder for 05-03)

key-decisions:
  - "ApiConfig shape changed from {endpoint,apiKey} to {apiKey,model} — Anthropic SDK handles endpoint internally; ChatSettings updated to model selector"
  - "Keyboard shortcut useEffect placed before early return guard so Ctrl+Shift+K works when panel is closed"
  - "react-markdown renders assistant messages with Tailwind prose classes; no remark/rehype plugins needed for v1"
  - "Message persistence: saveMessages() called as side-effect inside every set() mutation (addMessage, clearMessages, deleteMessage)"
  - "useChatApi.ts updated to placeholder (shows error message) until 05-03 Anthropic SDK integration"

patterns-established:
  - "group/group-hover pattern: parent div has 'group' class, action buttons div has 'opacity-0 group-hover:opacity-100 transition-opacity'"
  - "useEffect before early return: keyboard shortcut listener registered unconditionally, panel visibility guard comes after"
  - "localStorage persistence in Zustand: each mutation action calls save*() helper then returns new state"

requirements-completed:
  - CHAT-01
  - CHAT-04

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 05 Plan 01: Chat UI Enhancement Summary

**react-markdown assistant message rendering, localStorage history persistence, Ctrl+Shift+K keyboard shortcut, and 3-dot typing indicator with hover copy/delete/regenerate actions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T00:50:22Z
- **Completed:** 2026-03-04T00:53:47Z
- **Tasks:** 3 auto tasks complete (Task 4 is checkpoint:human-verify)
- **Files modified:** 5

## Accomplishments

- chatStore enhanced with localStorage message history, deleteMessage/setRegenerateCallback actions, and ApiConfig shape updated to {apiKey, model} for Anthropic SDK
- ChatMessage rewritten with ReactMarkdown rendering for assistant responses and hover action buttons (copy, regenerate, delete for assistant; delete for user)
- ChatPanel enhanced with global Ctrl+Shift+K keyboard shortcut, 3-dot animated typing indicator, and "Clear Chat" button visible when messages exist

## Task Commits

Each task was committed atomically:

1. **Task 1: Install react-markdown and enhance chatStore** - `a25c4ad` (feat)
2. **Task 2: Enhance ChatMessage with markdown rendering and hover action buttons** - `c079c43` (feat)
3. **Task 3: Enhance ChatPanel with typing indicator and keyboard shortcut** - `3eee6fe` (feat)

## Files Created/Modified

- `src/stores/chatStore.ts` - Added localStorage persistence (finance-chat-history), deleteMessage(id), setRegenerateCallback actions; changed ApiConfig to {apiKey, model}
- `src/features/chatbot/ChatMessage.tsx` - ReactMarkdown for assistant messages; copy/regenerate/delete hover buttons; delete hover for user messages
- `src/features/chatbot/ChatPanel.tsx` - Ctrl+Shift+K keyboard shortcut (before early return), 3-dot typing indicator, Clear Chat button in header
- `src/features/chatbot/ChatSettings.tsx` - Updated to model selector dropdown (Claude 3.5 Sonnet/Haiku/Opus) replacing endpoint URL input
- `src/features/chatbot/useChatApi.ts` - Updated to use new ApiConfig shape; placeholder error response until 05-03

## Decisions Made

- **ApiConfig endpoint removed:** The plan specified changing `{ endpoint, apiKey }` to `{ apiKey, model }` since the Anthropic SDK handles endpoints internally. This required updating ChatSettings.tsx (model selector) and useChatApi.ts (placeholder) as blocking Rule 3 deviations.
- **Keyboard shortcut placement:** useEffect registered before `if (!isOpen) return null` so the shortcut toggles the panel even when closed.
- **react-markdown prose styling:** Used Tailwind arbitrary property selectors `[&_p]:my-1 [&_code]:bg-background` etc. instead of @tailwindcss/typography plugin — no extra plugin needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated ChatSettings.tsx for new ApiConfig shape**
- **Found during:** Task 1 (chatStore ApiConfig interface change)
- **Issue:** ChatSettings.tsx used `apiConfig.endpoint` and created `ApiConfig` with `endpoint` field — TypeScript would fail after chatStore change
- **Fix:** Rewrote ChatSettings to use model selector dropdown (3 Anthropic Claude models) instead of endpoint URL input field; `handleSave` creates `{ apiKey, model }` config
- **Files modified:** `src/features/chatbot/ChatSettings.tsx`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `a25c4ad` (Task 1 commit)

**2. [Rule 3 - Blocking] Updated useChatApi.ts for new ApiConfig shape**
- **Found during:** Task 1 (chatStore ApiConfig interface change)
- **Issue:** useChatApi.ts used `apiConfig.endpoint` for fetch URL and `apiConfig?.endpoint && apiConfig?.apiKey` for isConfigured check — TypeScript would fail
- **Fix:** Updated to use `apiConfig?.apiKey` for configured check; replaced fetch call with placeholder error message (full SDK integration in 05-03)
- **Files modified:** `src/features/chatbot/useChatApi.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `a25c4ad` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking)
**Impact on plan:** Both fixes required by the ApiConfig shape change specified in the plan. ChatSettings and useChatApi needed updating before TypeScript would accept the new interface. No scope creep — both were direct consequences of the planned change.

## Issues Encountered

None — all tasks executed cleanly with zero TypeScript errors and 15/15 tests passing.

## User Setup Required

None - no external service configuration required at this stage.

## Next Phase Readiness

- Chat UI layer fully functional: markdown rendering, hover actions, keyboard shortcut, typing indicator, localStorage persistence
- ChatSettings now shows model selector (Claude 3.5 Sonnet/Haiku/Opus) — ready for Anthropic API key input
- useChatApi.ts is a placeholder — 05-03 will replace the body with Anthropic SDK call using `apiConfig.apiKey` and `apiConfig.model`
- Dev server running at http://localhost:5176/ for Task 4 visual verification

## Self-Check: PASSED

All files verified present:
- FOUND: src/stores/chatStore.ts
- FOUND: src/features/chatbot/ChatMessage.tsx
- FOUND: src/features/chatbot/ChatPanel.tsx
- FOUND: src/features/chatbot/ChatSettings.tsx
- FOUND: src/features/chatbot/useChatApi.ts
- FOUND: .planning/phases/05-chatbot-integration/05-01-SUMMARY.md

All commits verified:
- FOUND: a25c4ad (Task 1 - chatStore + ChatSettings + useChatApi)
- FOUND: c079c43 (Task 2 - ChatMessage)
- FOUND: 3eee6fe (Task 3 - ChatPanel)

---
*Phase: 05-chatbot-integration*
*Completed: 2026-03-04*
