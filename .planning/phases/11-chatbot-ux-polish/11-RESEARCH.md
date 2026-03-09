# Phase 11: Chatbot UX Polish - Research

**Researched:** 2026-03-09
**Domain:** React chat UI, touch accessibility, responsive design, state management
**Confidence:** HIGH

## Summary

Phase 11 improves the existing chatbot UI (Phase 5: Chatbot Integration v1.0) with three focused enhancements: conversation starter chips in the empty state, verified copy-to-clipboard button functionality with mobile tap-to-reveal pattern, and clarified settings panel display. The phase also includes a mobile responsiveness audit to ensure proper layout, touch targets (≥44px WCAG AA), and keyboard handling across device widths.

All required components already exist in src/features/chatbot/. The research found:
- **Copy button** is already implemented in ChatMessage.tsx with hover visibility; mobile tap-to-reveal requires touch handler addition
- **Conversation starters** require UI component in empty state; pre-fill behavior (no auto-send) is straightforward
- **Settings panel** is functional; just needs layout verification for mobile
- **Touch accessibility** is partially in place; button elements meet 44px minimum, but message bubbles may need mobile tap-to-reveal adjustment

**Primary recommendation:** Implement conversation starters as a flexible wrap grid component in ChatPanel's empty state, enhance ChatMessage with mobile touch-to-reveal pattern (3-5 sec fade), verify responsive CSS for all breakpoints.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Conversation Starters Content:** 4 fixed Vietnamese questions focused on financial analysis (not generic; pre-fill input only, no auto-send)
- **Copy Button Behavior:** Desktop hover-only visibility (established pattern); mobile tap-to-reveal with 3-5 sec auto-hide
- **Settings Panel:** Minimal design; model selector with description already works well
- **Mobile Responsive Audit:** Test across 320–480px widths; check overflow, touch targets, keyboard handling

### Claude's Discretion
- Exact styling and spacing of conversation starter chips
- Tap-to-reveal timer duration (3–5 sec range; exact timing up to implementation)
- Conversation starter chip color/hover states
- Settings panel visual refinements (padding, borders, grouping)
- Exact mobile breakpoint adjustments discovered during testing

### Deferred Ideas (OUT OF SCOPE)
- Context-aware conversation starters (requires data analysis logic)
- Chat history persistence across sessions (already session-only by Phase 5 decision)
- Multi-turn context memory enhancements
- Voice input/output
- Chatbot personality customization

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAT-UX-01 | Empty chat state shows 4 Vietnamese conversation starters (pre-fill input only) | ChatPanel.tsx empty state (lines 99-106) can host starter chips component; ChatInput.tsx has setText hook for pre-fill |
| CHAT-UX-02 | Each assistant message has copy-to-clipboard button (verify & enhance discoverability) | ChatMessage.tsx already implements Copy button (lines 18-24, 103-112) with hover visibility; mobile tap-to-reveal requires new touch handler |
| CHAT-UX-03 | Chat settings panel displays current model name clearly with clean layout | ChatSettings.tsx model selector (lines 109-126) displays model + description; layout is already minimal and functional |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | Chat UI components (ChatPanel, ChatMessage, ChatInput, ChatSettings) | Established Phase 1; strict mode enables early error detection |
| TypeScript | 5.9.3 | Type-safe chat store, message interfaces, API config | Strict mode prevents silent failures in state management |
| Tailwind CSS | v4 | Responsive utility-first styling for chat UI | CSS-first config (no config file); already powers all chat components |
| shadcn/ui | (New York) | Button, Input, Select components in chat UI | Consistent with Phase 1 setup; shadcn Button already used in ChatMessage, ChatInput, ChatSettings |
| Zustand | v5 | Chat state management (messages, loading, settings, UI state) | Established Phase 1 decision; useChatStore manages all chat state |
| Sonner | v2.12 | Toast notifications for copy feedback | Confirmed in ChatMessage.tsx (lines 4, 20-22); Vietnamese UI copy "Đã sao chép tin nhắn" |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-markdown | (latest in Phase 5) | Render assistant messages with markdown formatting | ChatMessage.tsx uses it for message rendering with prose styling |
| lucide-react | (latest) | Icons (Copy, Delete, Regenerate, Settings, MessageCircle, etc.) | ChatMessage, ChatPanel, ChatInput, ChatSettings all use lucide icons |

### Utilities Already Established
- **touch-target**: Tailwind utility class `min-h-[44px] min-w-[44px]` defined in index.css (line 195) — meets WCAG AA 44px minimum
- **heading-label, body-sm**: Typography utilities used in ChatPanel, ChatMessage (established Phase 1)
- **group-hover**: Tailwind pattern for hover-triggered visibility (ChatMessage lines 52, 102 use `opacity-0 group-hover:opacity-100`)
- **sm: breakpoint**: Tailwind sm:640px breakpoint used for mobile/desktop split in ChatPanel (line 51: `sm:bottom-20 sm:right-4` etc.)

## Architecture Patterns

### Recommended Project Structure
```
src/
├── features/chatbot/
│   ├── ChatButton.tsx           # Toggle button in AppHeader
│   ├── ChatPanel.tsx            # Main panel (fixed/mobile, responsive)
│   ├── ChatMessage.tsx          # Individual message render (Copy, Delete, Regenerate buttons)
│   ├── ChatInput.tsx            # Text input + Send button
│   ├── ChatSettings.tsx         # API key, model selector, action buttons
│   ├── ConversationStarters.tsx # NEW: Chips component for empty state (Phase 11)
│   ├── useChatApi.ts            # Anthropic SDK logic, message sending
│   └── ChatPanel.test.tsx       # Existing test for ChatPanel
├── stores/
│   ├── chatStore.ts            # Zustand store (messages, loading, API config, settings)
│   └── chatStore.test.ts       # Store tests
└── index.css                   # touch-target, heading-label, body-sm utilities
```

### Pattern 1: Empty State Conversation Starters
**What:** Grid of interactive chips that pre-fill the ChatInput when clicked, without auto-sending.

**When to use:** When chat.messages.length === 0 and !isLoading

**Example:**
```typescript
// src/features/chatbot/ConversationStarters.tsx
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
    <div className="flex flex-wrap gap-2 justify-center">
      {STARTERS.map((text) => (
        <button
          key={text}
          onClick={() => onSelect(text)}
          className="px-3 py-1.5 text-sm font-medium rounded-full
            bg-muted hover:bg-muted/80 text-foreground
            transition-colors duration-200 border border-border"
        >
          {text}
        </button>
      ))}
    </div>
  )
}
```

**Integration in ChatPanel.tsx (replaces lines 100-105):**
```typescript
{!hasMessages && !isLoading && (
  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-4">
    <MessageCircle className="h-8 w-8 opacity-40" />
    <ConversationStarters onSelect={(text) => {
      // Pre-fill ChatInput without sending
      // ChatInput manages its own state; communicate via ref or prop
    }} />
    <p className="text-xs text-muted-foreground/60">Ctrl+Shift+K để mở/đóng</p>
  </div>
)}
```

### Pattern 2: Mobile Tap-to-Reveal for Message Actions
**What:** On mobile/touch devices, tapping a message reveals action buttons (Copy, Delete, Regenerate) for 3-5 seconds, then they fade out.

**When to use:** On ChatMessage.tsx for touch devices (detect via touch event handlers)

**Implementation approach:**
```typescript
// In ChatMessage.tsx component
const [showActions, setShowActions] = useState(false)
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

function handleTouchStart() {
  setShowActions(true)
  // Clear any existing timeout
  if (timeoutRef.current) clearTimeout(timeoutRef.current)
  // Auto-hide after 4 seconds
  timeoutRef.current = setTimeout(() => setShowActions(false), 4000)
}

useEffect(() => {
  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }
}, [])

// Detect if touch device
const isTouchDevice = () => {
  return (('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0))
}

// Apply tap handler only on touch devices; keep hover for desktop
const messageGroup = (
  <div
    className="group flex justify-start mb-3"
    onTouchStart={isTouchDevice() ? handleTouchStart : undefined}
  >
    {/* ... message content ... */}
    {/* Action buttons visibility: desktop hover + mobile tap */}
    <div className={`flex gap-1 ml-8 transition-opacity duration-200
      ${isTouchDevice()
        ? (showActions ? 'opacity-100' : 'opacity-0')
        : 'opacity-0 group-hover:opacity-100'}`}>
      {/* Copy, Regenerate, Delete buttons */}
    </div>
  </div>
)
```

### Pattern 3: Responsive Chat Panel Layout
**What:** Mobile uses bottom sheet (max-h-85vh, full width), desktop uses fixed side panel (380x520px at sm:640px breakpoint).

**When to use:** ChatPanel.tsx already implements this (see lines 49-51)

**Verified pattern (from existing code):**
```typescript
<div className="fixed z-50 bg-background border border-border shadow-2xl flex flex-col overflow-hidden
  bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]
  sm:bottom-20 sm:right-4 sm:left-auto sm:w-[380px] sm:h-[520px] sm:rounded-2xl sm:max-h-none">
```

This pattern handles:
- Mobile: full viewport width, bottom anchored, partial height (85vh)
- Desktop (sm:640px+): fixed width/height, bottom-right corner, no max-height constraint

### Anti-Patterns to Avoid
- **Always-visible action buttons:** Clutters the UI; use hover (desktop) and tap-to-reveal (mobile) instead
- **Auto-sending conversation starters:** User should preview and edit the question before sending (Phase 5 decision)
- **Unstructured touch handling:** Use proper touch event detection; don't assume all clicks are intended interactions
- **Hardcoded button sizes:** Use touch-target utility (44px minimum) consistently across all message action buttons
- **Ignoring keyboard state on mobile:** Verify that virtual keyboard appearing/disappearing doesn't shift chat input off-screen

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chat message rendering with markdown | Custom markdown parser | react-markdown (already in Phase 5) | Already integrated; handles code blocks, lists, formatting with prose styling |
| Copy-to-clipboard interaction | Custom clipboard API wrapper | navigator.clipboard (native API) + sonner toast | Native API is reliable; sonner provides toast feedback automatically |
| Responsive grid for conversation starters | Custom breakpoint logic | Tailwind flex flex-wrap + gap utilities | Tailwind handles wrapping, spacing, and breakpoint queries automatically |
| Touch event detection | Custom pointer event handling | ontouchstart/navigator.maxTouchPoints | Browser-native detection is reliable; simpler than pointer events for this use case |
| Message auto-scroll behavior | Custom scroll observer | useRef + scrollIntoView (already in ChatPanel) | Established pattern in Phase 5; useEffect manages scroll on message changes |

**Key insight:** The chat UI is already well-structured. Phase 11 is an enhancement phase — avoid over-engineering. Conversation starters are just a styled button grid; tap-to-reveal is a simple state toggle with a timeout.

## Common Pitfalls

### Pitfall 1: Touch-to-Reveal Timer Not Canceling
**What goes wrong:** Mobile user taps multiple messages in succession; timers overlap and buttons don't hide predictably.

**Why it happens:** Not clearing the previous timeout before starting a new one.

**How to avoid:** Store timeout ID in useRef; clear it before setting a new timeout. Use cleanup function in useEffect to cancel on unmount.

**Prevention code:**
```typescript
const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

function handleTouchStart() {
  setShowActions(true)
  if (timeoutRef.current) clearTimeout(timeoutRef.current) // Cancel previous timer
  timeoutRef.current = setTimeout(() => setShowActions(false), 4000)
}

useEffect(() => {
  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current) // Cleanup on unmount
  }
}, [])
```

**Warning signs:** Buttons appearing/disappearing erratically; multiple messages showing buttons at once on mobile.

### Pitfall 2: Conversation Starters Not Pre-filling Input
**What goes wrong:** Clicking a starter chip doesn't populate ChatInput.value; user has to manually type.

**Why it happens:** ConversationStarters component doesn't have a way to update ChatInput state (separate component, no shared prop).

**How to avoid:** Pass a callback prop from ChatPanel → ConversationStarters → ChatInput.setText. Or use Zustand if needed, but simpler to lift state up.

**Prevention code:**
```typescript
// ChatPanel.tsx
const inputRef = useRef<HTMLTextAreaElement>(null)

function handleStarterSelect(text: string) {
  if (inputRef.current) {
    inputRef.current.value = text
    inputRef.current.focus()
  }
}

// Pass ref and callback to ConversationStarters
<ConversationStarters onSelect={handleStarterSelect} />
```

**Warning signs:** Starters render but clicking them has no effect; user confused about next step.

### Pitfall 3: Copy Button Always Visible on Mobile
**What goes wrong:** Desktop hover-only pattern shows buttons permanently on mobile, cluttering the UI.

**Why it happens:** CSS `group-hover:opacity-100` doesn't apply to touch devices; buttons stay visible due to missing mobile-specific CSS class.

**How to avoid:** Detect touch device capability; apply different CSS classes or use JavaScript to toggle visibility. Use `@supports` media query as fallback.

**Prevention code:**
```typescript
// Detect touch at component level
const isTouchDevice = () => {
  return (('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0))
}

// Conditional class
<div className={isTouchDevice() ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}>
```

**Warning signs:** Mobile screenshots show action buttons always visible; users report UI clutter on phones.

### Pitfall 4: Settings Panel Overflow on Small Screens
**What goes wrong:** ChatSettings.tsx doesn't fit in 320–380px width; API key input or model select overflows or gets cut off.

**Why it happens:** Fixed padding (p-4) + large select/input elements exceed viewport on small phones.

**How to avoid:** Test with Browser DevTools mobile emulation (Chrome DevTools → Toggle Device Toolbar, select iPhone SE 320px). Use max-w-full on inputs; reduce padding on xs screens if needed.

**Prevention test:**
```bash
# Open Chrome DevTools, toggle Device Toolbar, select iPhone SE (320px)
# Navigate to chat, open settings, verify no horizontal scroll
```

**Warning signs:** DevTools shows horizontal red overflow bar; text input extends beyond right edge.

### Pitfall 5: Keyboard Covering Input on Mobile
**What goes wrong:** Virtual keyboard appears, pushes ChatInput off-screen; user can't type or see input.

**Why it happens:** ChatPanel uses fixed positioning; virtual keyboard doesn't trigger resize on some mobile browsers.

**How to avoid:** Use `max-h-[85vh]` (established pattern, already in code) to constrain panel size. Ensure input stays visible with proper overflow-y: auto on messages container.

**Prevention test:**
```bash
# Test on actual mobile device or emulated mobile keyboard
# Open chat, start typing, verify input stays above keyboard
```

**Warning signs:** Input field disappears when keyboard opens; messages container becomes inaccessible.

## Code Examples

Verified patterns from existing codebase and Phase 5 decisions:

### Example 1: Conversation Starters Component
```typescript
// Source: Phase 11 CONTEXT.md locked decisions + existing ChatPanel.tsx pattern
interface ConversationStartersProps {
  onSelect: (text: string) => void
}

export function ConversationStarters({ onSelect }: ConversationStartersProps) {
  const starters = [
    'Phân tích giao dịch của tôi',
    'Xu hướng chi tiêu là gì?',
    'Nhận xét chi tiêu tức thời',
    'Báo cáo chi tiêu hàng tháng',
  ]

  return (
    <div className="flex flex-wrap gap-2 justify-center px-4">
      {starters.map((text) => (
        <button
          key={text}
          onClick={() => onSelect(text)}
          className="px-3 py-1.5 text-sm font-medium rounded-full
            bg-muted hover:bg-muted/80 text-foreground
            transition-colors duration-200 border border-border"
        >
          {text}
        </button>
      ))}
    </div>
  )
}
```

### Example 2: Mobile Tap-to-Reveal Implementation
```typescript
// Source: ChatMessage.tsx pattern + touch event best practice
import { useState, useRef, useEffect } from 'react'

function useTouchActions() {
  const [showActions, setShowActions] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = () => {
    setShowActions(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setShowActions(false), 4000)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { showActions, handleTouchStart }
}

// Usage in ChatMessage
const { showActions, handleTouchStart } = useTouchActions()
const isTouchDevice = () => {
  return (('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0))
}

<div
  className="group flex justify-start mb-3"
  onTouchStart={isTouchDevice() ? handleTouchStart : undefined}
>
  {/* message content */}
  <div className={`flex gap-1 transition-opacity duration-200 ${
    isTouchDevice()
      ? (showActions ? 'opacity-100' : 'opacity-0')
      : 'opacity-0 group-hover:opacity-100'
  }`}>
    {/* Copy, Regenerate, Delete buttons */}
  </div>
</div>
```

### Example 3: Copy Button with Toast (Already Implemented)
```typescript
// Source: ChatMessage.tsx lines 18-24 (verified Phase 5 code)
function handleCopy() {
  navigator.clipboard.writeText(message.content).then(() => {
    toast('Đã sao chép tin nhắn')  // sonner v2.12 confirmed
  }).catch(() => {
    toast.error('Không thể sao chép')
  })
}
```

### Example 4: Responsive Chat Panel (Already Implemented)
```typescript
// Source: ChatPanel.tsx lines 49-51 (verified Phase 5 code)
<div className="fixed z-50 bg-background border border-border shadow-2xl flex flex-col overflow-hidden
  bottom-0 left-0 right-0 rounded-t-2xl max-h-[85vh]
  sm:bottom-20 sm:right-4 sm:left-auto sm:w-[380px] sm:h-[520px] sm:rounded-2xl sm:max-h-none">
  {/* Panel content */}
</div>
```

### Example 5: Touch Target Sizing (Already Established)
```typescript
// Source: index.css line 195 + ChatSettings.tsx line 136
// Use touch-target utility class for any interactive element
<Button className="touch-target">Action</Button>

// Or inline if component doesn't support className extension
<button className="min-h-[44px] min-w-[44px]">Action</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Always-visible message action buttons | Hover-only (desktop) + tap-to-reveal (mobile) | Phase 5 decision | Cleaner UI; discoverability through experimentation works well for power users |
| Inline emoji/custom icons | lucide-react icon library | Phase 1 | Consistent icon sizing, fill/stroke control, tree-shaking efficiency |
| localStorage.setItem in component logic | Zustand store with side-effects (Phase 5) | Phase 5 decision | Centralized state; saveMessages() called in every mutation for consistency |
| Fixed chat model options | Model selector dropdown with descriptions | Phase 5 update | Better UX; users see model name + recommendation (e.g., "Claude 3.5 Sonnet (Khuyên dùng)") |

**Deprecated/outdated:**
- **Old endpoint-based config:** Phase 5 changed from `{endpoint, apiKey}` to `{apiKey, model}` — Anthropic SDK handles routing internally. ChatSettings.tsx no longer has endpoint field.
- **Auto-send conversation starters:** Earlier brainstorm considered auto-sending; locked decision is pre-fill only (user can edit).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest v4 + React Testing Library |
| Config file | vite.config.ts (test block, lines 32–38) |
| Quick run command | `npm test -- src/features/chatbot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-UX-01 | Conversation starters render when messages.length === 0 | unit | `npm test -- src/features/chatbot/ConversationStarters.test.tsx` | ❌ Wave 0 |
| CHAT-UX-01 | Clicking starter pre-fills ChatInput without auto-send | integration | `npm test -- src/features/chatbot/ChatPanel.test.tsx` | ✅ Partial (existing, needs update) |
| CHAT-UX-02 | Copy button appears on assistant message (desktop hover) | unit | `npm test -- src/features/chatbot/ChatMessage.test.tsx` | ❌ Wave 0 |
| CHAT-UX-02 | Mobile tap-to-reveal shows buttons for 3–5 sec | unit | `npm test -- src/features/chatbot/ChatMessage.test.tsx` | ❌ Wave 0 |
| CHAT-UX-03 | Settings panel displays model name + description | unit | `npm test -- src/features/chatbot/ChatSettings.test.tsx` | ❌ Wave 0 |
| Mobile audit | No horizontal overflow on 320–480px widths | integration | Manual DevTools emulation (Chrome, Safari mobile modes) | ❌ Manual-only |
| Mobile audit | Touch targets ≥44×44px on all buttons | integration | Manual DevTools inspection + computed styles | ❌ Manual-only |
| Mobile audit | Virtual keyboard doesn't cover input on mobile | e2e | Manual testing on actual mobile device or Browserstack | ❌ Manual-only |

### Sampling Rate
- **Per task commit:** `npm test -- src/features/chatbot` (tests for chatbot feature)
- **Per wave merge:** `npm test` (full suite; requires 247+ existing tests passing)
- **Phase gate:** Full suite green + manual mobile audit (DevTools 320–480px emulation) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/chatbot/ConversationStarters.test.tsx` — covers CHAT-UX-01 (render + click behavior)
- [ ] `src/features/chatbot/ChatMessage.test.tsx` — covers CHAT-UX-02 (copy button, mobile tap-to-reveal)
- [ ] `src/features/chatbot/ChatSettings.test.tsx` — covers CHAT-UX-03 (settings panel rendering)
- [ ] Manual test checklist for mobile responsive audit (DevTools emulation 320–480px)

**Note:** ChatPanel.test.tsx exists but may need updates to cover ConversationStarters integration. If framework install or setup needed, check test-setup.ts (already configured in Phase 1).

## Sources

### Primary (HIGH confidence)
- **Phase 5: Chatbot Integration v1.0** — ChatPanel.tsx, ChatMessage.tsx, ChatInput.tsx, ChatSettings.tsx, useChatApi.ts (all verified in codebase)
- **Phase 1 Tech Stack** — React 19, TypeScript 5.9.3, Tailwind CSS v4, shadcn/ui, Zustand v5, Sonner v2.12 (confirmed in package.json, vite.config.ts, src/index.css)
- **CONTEXT.md Phase 11** — Locked decisions on conversation starters, copy button, settings panel, mobile audit
- **REQUIREMENTS.md** — CHAT-UX-01, CHAT-UX-02, CHAT-UX-03 requirement definitions

### Secondary (MEDIUM confidence)
- **Tailwind CSS Responsive Design** — sm: breakpoint (640px) pattern verified in ChatPanel.tsx (line 51)
- **WCAG AA Touch Target Minimum** — 44×44px standard confirmed in index.css (line 195) and established in Phase 6
- **React Event Handling** — ontouchstart, navigator.maxTouchPoints detection pattern from standard browser APIs

## Metadata

**Confidence breakdown:**
- **Standard Stack:** HIGH — All libraries verified in Phase 5 code and package.json
- **Architecture:** HIGH — Chat UI structure already exists; Phase 11 adds components to existing structure
- **Patterns:** HIGH — Hover visibility, responsive layout, touch handling all established in Phase 5
- **Pitfalls:** MEDIUM — Mobile UX pitfalls identified through code review and UX principles; test coverage gaps flagged

**Research date:** 2026-03-09
**Valid until:** 2026-03-23 (stable tech stack, no breaking changes expected)
