# Phase 11: Chatbot UX Polish - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Chatbot UX Polish improves the chat user experience with conversation starters for empty state, verified copy button functionality, settings panel clarity, and mobile responsiveness. Builds on Phase 5 (Chatbot Integration v1.0).

This phase delivers 3 requirements:
- CHAT-UX-01: Empty chat state shows 4 Vietnamese conversation starters (pre-fill input only)
- CHAT-UX-02: Each assistant message has copy-to-clipboard button (verify & enhance discoverability)
- CHAT-UX-03: Chat settings panel displays current model name clearly with clean layout
- Plus: Mobile responsive audit (no horizontal overflow, touch targets ≥44px, keyboard handling)

</domain>

<decisions>
## Implementation Decisions

### Conversation Starters Chips

**Content:** 4 financial insight-focused questions (not generic; specific to analyzing spending trends)
- "Phân tích giao dịch của tôi" (Analyze my transactions)
- "Xu hướng chi tiêu là gì?" (What are my spending trends?)
- "Nhận xét chi tiêu tức thời" (Real-time spending insights)
- "Báo cáo chi tiêu hàng tháng" (Monthly spending report)

**Layout:** Flexible wrap (responsive grid)
- Chips arrange naturally on small screens (single row if space) and wrap as needed
- Chips are buttons/interactive elements styled consistently with existing shadcn/ui buttons
- Appears in empty state when chat.messages.length === 0

**Behavior:** Pre-fill input only — clicking a chip fills the input field with that question; user can edit before sending (no auto-send)

### Copy Button Discoverability

**Desktop:** Hover-only visibility (current pattern in ChatMessage)
- Copy button appears when user hovers over assistant message
- Keeps interface clean; interaction is discoverable through experimentation

**Mobile (touch devices):** Tap-to-reveal pattern
- User taps a message bubble → buttons (Copy, Regenerate, Delete) appear for 3-5 seconds then fade
- Requires touch handler on message element
- Provides clear CTA without always-visible clutter

**Feedback:** Toast notification (current implementation with sonner)
- "Đã sao chép tin nhắn" on success
- "Không thể sao chép" on failure

### Settings Panel Layout & Model Display

**Model selection display:** Minimal (current)
- Model selector dropdown shows model name + description (e.g., "Claude 3.5 Sonnet (Khuyên dùng)")
- No separate "Currently using" label needed
- Dropdown value reflects the active/saved model

**Button organization:** Current stacked vertical layout
- "Lưu cài đặt" button (primary, full-width)
- Second row: "Xóa API key" (if apiConfig exists) and "Xóa chat" (secondary buttons, flex row)
- Layout is clear and functional; no reorganization needed

### Mobile Responsive Audit

**Test breakpoints & device widths:**
- Small phones: 320–380px (iPhone SE, older devices) — challenging for chat UI
- Standard phones: 375–428px (iPhone 12/13/14) — most users
- Large phones: 430–480px (iPhone Pro, large Android)
- Tablets: 600px+ (iPad mini, 7–8 inch tablets)

**Specific issues to verify:**
1. **Horizontal overflow** — Chat message bubbles, long text, and code blocks must fit within viewport without horizontal scroll
2. **Touch targets** — Copy, Delete, Regenerate buttons must be ≥44×44px for WCAG AA compliance (currently may be 7×7; need to verify/expand)
3. **Keyboard handling** — Virtual keyboard appearing/disappearing should not cause message input or chat panel to shift unexpectedly
4. **Settings modal overflow** — Settings panel (especially on small screens) should fit within viewport without cutoff; scrollable if needed

**Testing method:** Browser DevTools emulation (Chrome/Safari mobile modes)
- Quick feedback loop
- Sufficient for v1.1 verification
- Will catch layout, overflow, and responsive breakpoint issues

### Claude's Discretion

- Exact styling and spacing of conversation starter chips
- Tap-to-reveal timer duration (3–5 sec range; exact timing up to implementation)
- Conversation starter chip color/hover states
- Settings panel visual refinements (padding, borders, grouping)
- Exact mobile breakpoint adjustments needed (may discover during testing)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ChatPanel.tsx** — Existing empty state with placeholder text; conversation starters chips will replace/augment the placeholder
- **ChatMessage.tsx** — Copy button already implemented with hover visibility (Copy icon, handleCopy, toast feedback); mobile tap-to-reveal requires touch handler addition
- **ChatSettings.tsx** — Model selector and settings buttons already in place; minimal layout is current design
- **useChatStore** — State management ready; may need to add conversation starters data (could be hardcoded array or derived from store)
- **shadcn/ui Button, Select components** — Already in use for chat UI

### Established Patterns
- **Hover/interaction patterns** — App uses opacity-0 group-hover:opacity-100 for revealing buttons on interaction (established in ChatMessage)
- **Toast notifications** — sonner library for user feedback (already configured)
- **Mobile responsiveness** — App uses Tailwind sm: breakpoint (640px) for desktop/mobile split; chat panel already responsive (85vh mobile, 380×520px desktop)
- **Touch targets** — touch-target utility class (min-h-[44px] min-w-[44px]) available for WCAG AA compliance
- **Tailwind responsive design** — Chat UI already responsive; may need refinement for conversation starter chips and button sizing

### Integration Points
- Conversation starters chips integrate with ChatInput (pre-fill input.value)
- Copy button enhancement integrates with existing ChatMessage component
- Settings panel already integrated with ChatPanel header
- Mobile responsive improvements affect ChatPanel and ChatMessage layout

</code_context>

<specifics>
## Specific Ideas

- Conversation starters should feel like suggestions, not commands — styling should reflect that they're optional entry points
- Copy button feedback (toast) is simple and familiar to users; no need for additional visual feedback like button state change
- Settings panel is functional; no visual overhaul needed, just ensure it fits mobile screens without cutoff
- Mobile keyboard handling is critical — test with actual virtual keyboard to ensure chat input stays accessible and doesn't slide off screen

</specifics>

<deferred>
## Deferred Ideas

- Context-aware conversation starters (e.g., showing different starters based on user's data or recent transactions) → Phase 12+ (requires data analysis in frontend)
- Chat history persistence across sessions → Phase 6+ decision (current: session-only, clears on refresh)
- Multi-turn context memory → Phase 6+
- Voice input/output → Phase 6+ (accessibility feature)
- Chatbot personality customization → Phase 6+

</deferred>

---

*Phase: 11-chatbot-ux-polish*
*Context gathered: 2026-03-09*
