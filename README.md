# FinanceManager

A personal finance dashboard for managing bank accounts and credit card transactions in one unified interface. Built with React, TypeScript, and Vite.

## Features

- View and manage multiple bank accounts and credit cards
- Filter transactions by date range, category, type, and keyword search
- Dashboard with income/expense stats and month-over-month comparison
- Category-based budget tracking with alerts
- Billing cycle grouping for credit card transactions
- CSV export
- AI-powered chatbot (via Claude API)
- Light/dark theme

## Tech Stack

- **React 19** + **TypeScript 5** + **Vite 7**
- **TanStack React Query 5** — data fetching & caching
- **Zustand 5** — state management
- **Zod 4** — schema validation
- **Tailwind CSS 4** + **shadcn/ui** — styling
- **Recharts** — charts
- **MSW 2** — mock API for development
- **Vitest** — unit testing

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/nguyenduchuy71/finace_management.git
cd finace_management

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

```bash
# .env.local
VITE_API_ENDPOINT=http://localhost:3000/api
VITE_ENABLE_MSW=true   # Uses mock API in development — no backend required
```

### Run Development Server

```bash
npm run dev
# App available at http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests in watch mode |
| `npm run test:ui` | Run tests with interactive UI |
| `npm run test:coverage` | Generate coverage report |

## Project Structure

```
src/
├── pages/          # Route-level page components
├── features/       # Feature modules (accounts, transactions, creditCards, dashboard, chatbot)
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks
├── services/       # API client and service functions
├── stores/         # Zustand state stores
├── types/          # TypeScript interfaces and Zod schemas
├── utils/          # Utility functions (currency, dates, categories, CSV)
└── mocks/          # MSW mock handlers and fixtures
```

## Deployment

Configured for deployment on [Vercel](https://vercel.com). The `VITE_ENABLE_MSW` flag is automatically set to `false` in production.

```bash
npm run build   # Output: dist/
```
