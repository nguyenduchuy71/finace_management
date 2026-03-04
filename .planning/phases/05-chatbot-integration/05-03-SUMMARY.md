---
phase: 05-chatbot-integration
plan: "03"
subsystem: ui
tags: [anthropic, sdk, streaming, chat, llm, react, zustand]

# Dependency graph
requires:
  - phase: 05-01
    provides: ChatMessage with markdown rendering, chatStore with regenerateCallback, typing indicator in ChatPanel
  - phase: 05-02
    provides: ChatSettings with API key input and model selector writing to chatStore.apiConfig

provides:
  - useChatApi hook backed by @anthropic-ai/sdk with streaming, multi-turn history, transaction context

affects:
  - chatbot feature (ChatPanel, ChatInput, ChatMessage all benefit from real SDK integration)

# Tech tracking
tech-stack:
  added:
    - "@anthropic-ai/sdk@^0.78.0 — official Anthropic TypeScript SDK"
  patterns:
    - "Anthropic SDK instantiated per-call with dangerouslyAllowBrowser: true for browser usage"
    - "messages.stream() + finalMessage() pattern — accumulate full response behind typing indicator"
    - "Conversation history built from store messages (user+assistant only, error role excluded)"
    - "Transaction context injected into system prompt — up to 20 tx with filter description"
    - "Regenerate callback registered in chatStore via useEffect, cleaned up on unmount"

key-files:
  created: []
  modified:
    - src/features/chatbot/useChatApi.ts
    - package.json

key-decisions:
  - "Anthropic SDK dangerouslyAllowBrowser: true — browser CORS allowed by Anthropic API as of 2025; flag is explicit opt-in"
  - "Typing indicator pattern (not token streaming) — isLoading=true shows 3-dot indicator while stream.finalMessage() awaits; avoids chatStore modification for partial-text updates"
  - "conversationHistory excludes error-role messages — only user+assistant form valid Anthropic API message pairs"
  - "Transaction context capped at 20 items — prevents LLM token overflow with large transaction lists"

patterns-established:
  - "Anthropic SDK: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) per sendMessage call — picks up latest key from store"
  - "Stream + finalMessage: stream for SDK connection, finalMessage() to await full response text"
  - "useCallback for sendMessage with exhaustive deps — stable reference for useEffect dependency"

requirements-completed:
  - CHAT-03
  - CHAT-04

# Metrics
duration: 5min
completed: "2026-03-04"
---

# Phase 5 Plan 03: Anthropic SDK Integration Summary

**@anthropic-ai/sdk installed and useChatApi.ts rewritten with streaming, multi-turn conversation history, and Vietnamese transaction context in system prompt**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-04T12:18:29Z
- **Completed:** 2026-03-04T12:19:53Z
- **Tasks:** 1/2 (Task 2 is checkpoint:human-verify — awaiting user verification)
- **Files modified:** 3 (package.json, package-lock.json, useChatApi.ts)

## Accomplishments

- Installed `@anthropic-ai/sdk@^0.78.0` — no existing test regressions (15/15 pass)
- Replaced stub useChatApi.ts (placeholder "not configured" error) with full SDK implementation
- Multi-turn conversation history built from chatStore messages, errors excluded
- Transaction context (up to 20 transactions + active filter description) injected into system prompt
- Regenerate callback wired: re-sends last user message when Regenerate button clicked in ChatMessage

## Task Commits

1. **Task 1: Install @anthropic-ai/sdk and rewrite useChatApi with streaming** - `3dcf1a5` (feat)
2. **Task 2: End-to-end chat verification** - CHECKPOINT — awaiting human verification

**Plan metadata:** TBD after checkpoint resolved

## Files Created/Modified

- `D:\Vibe Coding\finace_management\src\features\chatbot\useChatApi.ts` — Full Anthropic SDK implementation replacing fetch stub
- `D:\Vibe Coding\finace_management\package.json` — @anthropic-ai/sdk added to dependencies
- `D:\Vibe Coding\finace_management\package-lock.json` — lockfile updated

## Decisions Made

- **Typing indicator over token streaming:** Used `stream.finalMessage()` to wait for full response rather than streaming token-by-token into the store. This keeps the chatStore unchanged (no `updateMessageContent` action needed) and the ChatPanel typing indicator (3 dots, already implemented) provides good UX during the wait.
- **Per-call client instantiation:** `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })` created inside `sendMessage` so any key change in ChatSettings is immediately picked up without stale closure issues.
- **Error exclusion from history:** Messages with `role === 'error'` are not sent to Anthropic API — only `user` and `assistant` roles form valid message pairs.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript check passed immediately with zero errors.

## User Setup Required

**External service requires manual configuration before chat works:**

1. **Obtain Anthropic API key:** Visit https://console.anthropic.com/settings/keys and create a new key (starts with `sk-ant-`)
2. **Enter key in app:** Open FinanceManager → click chat button (bottom right) or press Ctrl+Shift+K → click Settings icon (gear) → paste API key → select model → click "Luu cai dat"
3. **Verify:** Send a test message — typing indicator should appear, then a Vietnamese response

## Next Phase Readiness

- SDK integration complete — useChatApi now calls real Anthropic API
- ChatPanel, ChatInput, ChatMessage UI from 05-01 remains unchanged
- ChatSettings from 05-02 provides API key + model configuration UI
- All 3 chatbot plans complete pending Task 2 human verification
- Full chatbot feature ready for end-to-end testing with real API key

## Self-Check: PASSED

- `src/features/chatbot/useChatApi.ts` — FOUND
- `.planning/phases/05-chatbot-integration/05-03-SUMMARY.md` — FOUND
- Commit `3dcf1a5` — FOUND

---
*Phase: 05-chatbot-integration*
*Completed: 2026-03-04*
