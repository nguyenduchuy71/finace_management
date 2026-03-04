---
phase: 05-chatbot-integration
plan: 02
subsystem: ui
tags: [react, chatbot, anthropic, shadcn, zustand, localStorage]

# Dependency graph
requires:
  - phase: 05-01
    provides: "chatStore with ApiConfig {apiKey, model} shape, ChatPanel with settings toggle"
provides:
  - "ChatSettings form with Anthropic API key input (password-masked, Eye/EyeOff toggle)"
  - "Model selection dropdown with 4 Claude model options via shadcn Select"
  - "Save validates both fields non-empty, persists {apiKey, model} to localStorage via chatStore"
  - "Xoa API key button to clear credentials (visible when apiConfig exists)"
  - "Xoa chat button to call clearMessages() and clear conversation history"
affects:
  - 05-03

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Password-masked input with Eye/EyeOff toggle using local showKey state"
    - "Hardcoded MODEL_OPTIONS array as const for type-safe model selection"
    - "Validation on save: check both apiKey.trim() and model before calling setApiConfig"

key-files:
  created: []
  modified:
    - src/features/chatbot/ChatSettings.tsx

key-decisions:
  - "ChatSettings removed endpoint field entirely — Anthropic SDK handles routing internally; only apiKey + model needed"
  - "Model pre-selected to claude-3-5-sonnet-20241022 as default — avoids empty selection UX issue"
  - "Xoa API key button only visible when apiConfig exists — avoids confusing clear action when nothing is configured"
  - "All buttons use min-h-[44px] for touch targets matching mobile UX requirements"

patterns-established:
  - "Settings form pattern: local state initialized from store, validate on save, call store action, toggleSettings to close"

requirements-completed: [CHAT-02]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 5 Plan 02: Chat Settings Summary

**ChatSettings replaced with Anthropic API key input (password-masked + Eye/EyeOff toggle), 4-model Claude dropdown via shadcn Select, and separate Clear Chat button — persists {apiKey, model} to localStorage via chatStore**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T00:55:00Z
- **Completed:** 2026-03-04T00:55:14Z
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 1

## Accomplishments
- Replaced ChatSettings stub (which had endpoint+apiKey fields) with production-ready form using new ApiConfig shape
- Added password-masked API key input with Eye/EyeOff toggle and link to console.anthropic.com
- Added shadcn Select model dropdown with 4 Claude options (Sonnet 3.5 pre-selected as default)
- Validation on save: both fields must be non-empty before calling setApiConfig({apiKey, model})
- "Xoa API key" button (visible when apiConfig exists) clears credentials via setApiConfig(null)
- "Xoa chat" button calls clearMessages() and closes settings panel
- All touch targets use min-h-[44px] — mobile-safe
- Zero TypeScript errors confirmed via npx tsc --noEmit

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace ChatSettings with API key + model selector + clear chat** - `fdc8385` (feat)
2. **Task 2: Visual verification of ChatSettings** - approved by user (no code change)

**Plan metadata:** TBD (docs commit)

## Files Created/Modified
- `src/features/chatbot/ChatSettings.tsx` - Production-ready settings form: API key input with show/hide toggle, model Select dropdown with 4 Claude options, Luu cai dat save button, Xoa API key clear-credentials button, Xoa chat clear-history button

## Decisions Made
- Removed endpoint field entirely — Anthropic SDK handles endpoint internally; ChatSettings only needs apiKey + model
- Pre-selected claude-3-5-sonnet-20241022 as default model to avoid empty dropdown UX
- "Xoa API key" button conditionally visible (only when apiConfig exists) to avoid confusing delete on empty state
- All buttons at min-h-[44px] matching mobile touch target requirements from CONTEXT.md

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ChatSettings fully functional and visually verified by user
- chatStore.setApiConfig({apiKey, model}) wired correctly — 05-03 SDK integration can read apiConfig directly from store
- clearMessages() confirmed working from settings panel
- Ready for 05-03: Anthropic SDK integration and real LLM response streaming

---
*Phase: 05-chatbot-integration*
*Completed: 2026-03-04*
