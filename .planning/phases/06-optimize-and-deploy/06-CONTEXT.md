# Phase 6: Optimize & Deploy - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Performance optimization, UI polish refinements, comprehensive testing, and deployment to Vercel production. This phase prepares the v1.0 MVP for production use by:
- Reducing bundle size (current: 1.2MB minified, 372KB gzipped)
- Improving Lighthouse performance scores
- Polishing UI for visual consistency
- Adding comprehensive test coverage
- Deploying to Vercel with production configuration

</domain>

<decisions>
## Implementation Decisions

### Performance Optimization
- Primary goal: Reduce main JS bundle from 1.2MB to <400KB minified (with gzip ~100KB target)
- Code splitting strategy: Route-based lazy loading + dynamic imports for heavy features (chatbot SDK, charts/Recharts)
- Build optimization: Enable tree-shaking, minification, gzip compression verification
- Lighthouse targets: Mobile ≥90, Desktop ≥95

### Testing Strategy
- Add E2E tests for critical user flows (transaction viewing, filtering, chatbot interaction)
- Unit test coverage: All utility functions and hooks
- Integration tests: API integration, state management
- No specific test framework requirement - use existing vitest setup

### UI Polish & Refinements
- Typography: Consistent font weights, line heights across all components
- Spacing: Standardize padding/margins using Tailwind scale
- Visual hierarchy: Improve contrast ratios, color consistency
- Animations: Smooth transitions, no unnecessary animations
- Mobile responsiveness: Final pass on 375px-1200px viewport ranges

### Vercel Deployment
- Create vercel.json for production configuration
- Environment variables: API key management (MSW for dev, real API for prod)
- Build command: `tsc -b && vite build`
- Output directory: `dist/`
- Deploy branch: main (or specific branch if preferred)

### Claude's Discretion
- Specific Recharts components to lazy-load (may keep in main bundle if <50KB)
- Exact Lighthouse optimization techniques (image optimization, CSS splitting, etc.)
- E2E test framework choice (Playwright, Cypress, or Vitest E2E)
- Animation timing and easing functions
- Exact Vercel deployment settings (serverless functions, edge config, caching headers)

</decisions>

<specifics>
## Specific Ideas

- Vite already configured with tree-shaking enabled
- React 19 has fast refresh, can leverage for dev ergonomics
- Tailwind CSS v4 CSS-first config should reduce CSS output
- MSW deferred render guard already prevents hydration mismatch
- Consider lazy-loading @anthropic-ai/sdk (chatbot feature is optional for initial page load)
- Recharts is heavy (~300KB) - consider route-based lazy loading

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **vite.config.ts:** Already has defineConfig, React plugin, Tailwind plugin. Can add build optimization settings
- **vitest:** Already set up in vite.config.ts, test environment is jsdom. Can add E2E setup
- **package.json scripts:** dev, build, lint, preview. Can add test, e2e commands

### Established Patterns
- MSW deferred render guard prevents hydration issues
- React Router v7 with layout routes (AppShell) enables code splitting per page
- Zustand stores are lightweight, no optimization needed
- TanStack Query already configured with sensible defaults

### Integration Points
- Vercel: Deploy from git push, no custom server logic needed (frontend-only)
- Environment variables: VITE_* prefix for client-side access
- Build output: dist/ directory

</code_context>

<deferred>
## Deferred Ideas

- Server-side rendering (SSR) with Vercel Edge Functions - future enhancement, static site sufficient for v1
- CDN image optimization - not needed yet (no images in current design)
- Service Worker / offline mode - future feature
- Performance monitoring dashboard - can integrate later

</deferred>

---

*Phase: 06-optimize-and-deploy*
*Context gathered: 2026-03-04*
