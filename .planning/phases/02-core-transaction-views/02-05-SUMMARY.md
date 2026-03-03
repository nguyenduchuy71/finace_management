---
phase: "02"
plan: "05"
subsystem: chatbot
tags: [chatbot, zustand, floating-ui, api-integration, openai-compatible]
dependency_graph:
  requires: [02-03-PLAN.md, 02-04-PLAN.md]
  provides: [chatbot-ui, chat-store, useChatApi]
  affects: [AppShell]
tech_stack:
  added: []
  patterns: [zustand-localStorage-persistence, openai-compatible-api, mobile-bottom-sheet, fixed-floating-button]
key_files:
  created:
    - src/stores/chatStore.ts
    - src/features/chatbot/useChatApi.ts
    - src/features/chatbot/ChatButton.tsx
    - src/features/chatbot/ChatMessage.tsx
    - src/features/chatbot/ChatSettings.tsx
    - src/features/chatbot/ChatInput.tsx
    - src/features/chatbot/ChatPanel.tsx
  modified:
    - src/components/layout/AppShell.tsx
decisions:
  - chatStore API config persists to localStorage; message history does not (page-refresh clears chat)
  - useChatApi sends up to 20 visible transactions as context to avoid LLM token overflow
  - ChatPanel uses mobile bottom sheet (max-h-85vh) and desktop fixed side panel (380x520px)
  - OpenAI-compatible POST format with system prompt in Vietnamese for transaction analysis
metrics:
  duration: "3 min"
  completed_date: "2026-03-03"
  tasks_completed: 8
  files_created: 7
  files_modified: 1
---

# Phase 02 Plan 05: Chatbot Feature — Floating Toggle, Chat UI, API Integration Summary

**One-liner:** Conversational finance assistant with floating FAB, mobile bottom sheet + desktop side panel, OpenAI-compatible API integration, and localStorage-persisted API config.

## What Was Built

A complete chatbot feature layer on top of the transaction views: a floating action button (bottom-right) that opens a chat panel where users can ask questions about their current filtered transactions. The bot sends the visible transaction context (up to 20 items) to a user-configured OpenAI-compatible API endpoint.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| T01 | Create Zustand chat store | 6143b54 | src/stores/chatStore.ts |
| T02 | Create useChatApi hook | 7241180 | src/features/chatbot/useChatApi.ts |
| T03 | Create ChatButton floating toggle | fcc9ad4 | src/features/chatbot/ChatButton.tsx |
| T04 | Create ChatMessage component | ff56d2b | src/features/chatbot/ChatMessage.tsx |
| T05 | Create ChatSettings component | ec725dc | src/features/chatbot/ChatSettings.tsx |
| T06 | Create ChatInput component | 4562f3c | src/features/chatbot/ChatInput.tsx |
| T07 | Create ChatPanel component | f2cb217 | src/features/chatbot/ChatPanel.tsx |
| T08 | Wire ChatButton and ChatPanel into AppShell | 566eaab | src/components/layout/AppShell.tsx |

## Decisions Made

1. **API config persists to localStorage; messages do not** — Per CONTEXT.md decision: no localStorage persistence for chat history. Messages clear on page refresh. API credentials (endpoint + key) are persisted so user doesn't re-enter on every visit.

2. **Transaction context capped at 20 items** — To prevent LLM token overflow, `useChatApi` slices `visibleTransactions` to 20 before building the context string. The filter state (accountId, dateRange, txType, searchQuery) is included in the context text.

3. **OpenAI-compatible POST format** — Uses `model: 'gpt-4o-mini'` with `messages` array (system + user roles). Compatible with OpenAI API, local LLM servers (Ollama, LM Studio), and any OpenAI-compatible endpoint.

4. **Mobile bottom sheet + desktop side panel** — ChatPanel uses responsive Tailwind classes: full-width bottom sheet with 85vh cap on mobile, 380x520px fixed bottom-right panel on desktop (sm: breakpoint).

5. **Vietnamese UI throughout** — All user-facing text (placeholders, error messages, labels, empty states) is in Vietnamese for the target user base.

## Verification Results

All 19 verification checks passed:
- All 7 chatbot files created
- chatStore: localStorage, isOpen, toggleChat present
- ChatButton: fixed positioning, MessageCircle/X icons
- useChatApi: fetch, apiConfig, transaction context
- ChatSettings: password input, setApiConfig
- AppShell: ChatButton, ChatPanel integrated
- ChatPanel: sm:w-[380px] responsive breakpoints
- `npx tsc --noEmit` exits with 0 errors

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files confirmed present:
- src/stores/chatStore.ts: FOUND
- src/features/chatbot/useChatApi.ts: FOUND
- src/features/chatbot/ChatButton.tsx: FOUND
- src/features/chatbot/ChatMessage.tsx: FOUND
- src/features/chatbot/ChatSettings.tsx: FOUND
- src/features/chatbot/ChatInput.tsx: FOUND
- src/features/chatbot/ChatPanel.tsx: FOUND
- src/components/layout/AppShell.tsx: FOUND (modified)

Commits confirmed: 6143b54, 7241180, fcc9ad4, ff56d2b, ec725dc, 4562f3c, f2cb217, 566eaab
