# CogNerd - AI-Powered Brand Intelligence Platform

A sophisticated SaaS platform that combines brand monitoring, competitive analysis, and AI-powered content generation. Built with Next.js 15 and powered by multiple LLM providers, CogNerd helps businesses understand their competitive landscape and generate high-quality content at scale.

## ✨ Key Features

### 🔍 Brand Intelligence
- **Competitor Analysis**: Automated identification and analysis of competitors using AI
- **Brand Monitoring**: Real-time tracking of brand mentions and competitive insights
- **Web Scraping**: Extract and analyze competitor websites with Firecrawl integration
- **Brand Profiles**: Saved profiles with detailed company data and analysis

### 🤖 AI-Powered Content Generation
- **Blog Writer**: Multi-agent blog generation with research, planning, writing, and optimization stages
- **Social Media Posts**: Generate Twitter, LinkedIn, and Reddit content variants
- **AEO Reports**: AI Engine Optimization reports for voice search and AI assistants
- **Batch File Generation**: Generate multiple files asynchronously with webhook callbacks

### 💬 Real-Time Chat
- **Streaming AI Responses**: Real-time conversations with multiple LLM providers
- **Conversation History**: Persistent chat threads with feedback system
- **Token Tracking**: Monitor usage and costs across conversations

### 💳 Credit System
- **Feature-Based Billing**: Consumption-based pricing (5-30 credits per action)
- **Real-Time Balance**: Live credit tracking in UI
- **Flexible Plans**: Multiple subscription tiers with Stripe integration

### 🔔 Notifications
- **Real-Time Alerts**: In-app notifications for completed jobs and updates
- **Asset Linking**: Direct links to generated reports and files
- **Unread Count**: Track notification status

## 🏗️ Architecture

### Monolithic Full-Stack Application
```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 15 App Router                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Frontend (React 19 + TypeScript)                       │ │
│  │  - 24 pages (dashboard, chat, brand monitor, etc.)     │ │
│  │  - 58 components (21 base UI components)               │ │
│  │  - TanStack Query for state management                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  API Layer (63 Serverless Routes)                      │ │
│  │  - Chat, Brand Monitor, Files, Blog, AEO, Auth         │ │
│  │  - Better Auth + Drizzle ORM                           │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Python Backend (Flask + Agno Agents)              │
│  - Multi-agent blog generation workflow                     │
│  - Knowledge base with RAG (Qdrant vector DB)               │
│  - Langfuse LLM observability                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  PostgreSQL (primary) + MongoDB + Qdrant (vectors)          │
└─────────────────────────────────────────────────────────────┘
```

### Project Structure

```
cognerd/
├── WebApp/                      # Main Next.js application
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # 63 API endpoints
│   │   │   ├── chat/            # Real-time chat (3 routes)
│   │   │   ├── brand-monitor/   # Brand analysis (6 routes)
│   │   │   ├── files/           # File generation (7 routes)
│   │   │   ├── blog/            # Blog generation (5 routes)
│   │   │   ├── aeo-report/      # AEO reports (5 routes)
│   │   │   └── ...              # Auth, credits, notifications
│   │   ├── dashboard/           # User dashboard
│   │   ├── brand-monitor/       # Brand monitoring UI
│   │   ├── blog-writer/         # Blog generation UI
│   │   ├── chat/                # Chat interface
│   │   └── ...                  # 20+ more pages
│   ├── components/              # React components
│   │   ├── ui/                  # Base components (Shadcn/UI)
│   │   ├── navbar.tsx           # Main navigation
│   │   └── ...                  # Feature components
│   ├── lib/                     # Core business logic
│   │   ├── auth.ts              # Better Auth configuration
│   │   ├── db/                  # Database schema & ORM
│   │   ├── ai-utils.ts          # AI integration utilities
│   │   ├── provider-config.ts   # Multi-provider LLM config
│   │   └── api-errors.ts        # Error handling
│   ├── prompts/                 # Managed AI prompts
│   ├── config/                  # Constants & configuration
│   ├── hooks/                   # Custom React hooks
│   └── types/                   # TypeScript definitions
├── PyCode/                      # Python backend services
│   └── Intelliwrite/            # Blog generation engine
│       ├── api.py               # Flask API server
│       ├── agents.py            # Agno agent definitions
│       ├── blog_workflow.py     # 5-stage generation pipeline
│       ├── services.py          # Business logic
│       ├── database/            # SQLAlchemy models
│       └── knowledge/           # RAG knowledge base
└── Scripts/                     # Utility scripts
```

## 🛠️ Tech Stack

### Frontend & Full-Stack
- **Framework**: Next.js 15 (App Router), React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4, Radix UI, Shadcn/UI
- **State Management**: TanStack Query 5.82.0
- **Forms**: React Hook Form + Zod validation

### Backend & APIs
- **Runtime**: Node.js 18+ with Vercel serverless functions
- **Database ORM**: Drizzle ORM 0.44.2
- **Authentication**: Better Auth 1.2.12 (OAuth + Email/Password)
- **Billing**: Autumn.js 0.0.96 (Stripe integration)
- **Email**: Nodemailer + Resend

### AI & Machine Learning
- **LLM Gateway**: OpenRouter (unified access to multiple providers)
- **Supported Models**:
  - OpenAI (GPT-4, GPT-4o)
  - Anthropic (Claude 3.5 Sonnet)
  - Google (Gemini Pro)
  - Perplexity
  - DeepSeek, XAI (Grok)
- **AI SDK**: Vercel AI SDK 4.3.17
- **Python Framework**: Agno (multi-agent orchestration)
- **Observability**: Langfuse
- **Vector Database**: Qdrant

### Databases
- **PostgreSQL**: Primary relational database (15+ tables)
- **MongoDB**: Secondary NoSQL storage
- **Qdrant**: Vector database for embeddings

### Utilities & Tools
- **Web Scraping**: Firecrawl 1.29.1
- **PDF Generation**: html-pdf-node
- **Browser Automation**: Puppeteer
- **File Handling**: jszip
- **Date Handling**: date-fns
- **Charts**: Recharts
- **Notifications**: Sonner (toast)

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **Python** 3.10+ (for PyCode backend)
- **PostgreSQL** database
- **MongoDB** database
- **Qdrant** instance (optional, for vector search)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cognerd
   ```

2. **Install Node.js dependencies**
   ```bash
   cd WebApp
   pnpm install
   ```

3. **Install Python dependencies**
   ```bash
   cd ../PyCode/Intelliwrite
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cd ../../WebApp
   cp .env.example .env.local
   ```

   Fill in the required values (see [Environment Variables](#environment-variables))

5. **Run database migrations**
   ```bash
   pnpm run db:push
   ```

6. **Start the development servers**

   Terminal 1 - Next.js:
   ```bash
   cd WebApp
   pnpm dev
   ```

   Terminal 2 - Python backend:
   ```bash
   cd PyCode/Intelliwrite
   python api.py
   ```

The application will be running at:
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Python API**: [http://localhost:5000](http://localhost:5000)

## ⚙️ Environment Variables

### Required

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cognerd"
MONGODB_URI="mongodb://localhost:27017/cognerd"

# Authentication (Better Auth)
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI Providers (choose at least one)
OPENROUTER_API_KEY="your-openrouter-key"
ANTHROPIC_API_KEY="your-anthropic-key"
OPENAI_API_KEY="your-openai-key"
GOOGLE_GENERATIVE_AI_API_KEY="your-google-key"

# Web Scraping
FIRECRAWL_API_KEY="your-firecrawl-key"

# Billing (Autumn.js + Stripe)
AUTUMN_API_KEY="your-autumn-key"
STRIPE_SECRET_KEY="your-stripe-key"
STRIPE_WEBHOOK_SECRET="your-webhook-secret"

# Email
RESEND_API_KEY="your-resend-key"
```

### Optional

```bash
# LLM Observability
LANGFUSE_PUBLIC_KEY="your-langfuse-public-key"
LANGFUSE_SECRET_KEY="your-langfuse-secret-key"

# Vector Database
QDRANT_URL="http://localhost:6333"
QDRANT_API_KEY="your-qdrant-key"

# Monitoring
BETTER_STACK_SOURCE_TOKEN="your-betterstack-token"
```

## 📊 Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `user` | Base authentication users (Better Auth) |
| `user_profile` | Extended user data (name, company, etc.) |
| `user_settings` | User preferences (theme, notifications) |
| `conversations` | Chat thread records |
| `messages` | Individual chat messages with token counts |
| `message_feedback` | User ratings on AI responses |
| `brand_profile` | Saved company/brand profiles |
| `brand_analyses` | Competitive analysis results |
| `aeo_reports` | AI Engine Optimization reports |
| `files` | Generated file records |
| `file_generation_jobs` | Async job tracking with webhooks |
| `blogs` | Generated blog posts |
| `topic_suggestions` | AI-generated topic ideas |
| `notifications` | User notification system |

## 🎯 API Endpoints

### Chat (`/api/chat/*`)
- `POST /api/chat` - Send message and get streaming response
- `GET /api/chat/conversations` - List user conversations
- `POST /api/chat/feedback` - Submit message feedback

### Brand Monitor (`/api/brand-monitor/*`)
- `POST /api/brand-monitor/search` - Search and analyze brands
- `POST /api/brand-monitor/identify-competitors` - AI competitor identification
- `POST /api/brand-monitor/analyze` - Deep brand analysis
- `POST /api/brand-monitor/generate-prompt` - Create AEO prompts

### Files (`/api/files/*`)
- `POST /api/files/generate` - Start batch file generation
- `GET /api/files/[id]` - Get file details
- `GET /api/files/[id]/download` - Download generated file
- `POST /api/files/callback` - Webhook for job completion

### Blog (`/api/blog/*`)
- `POST /api/blog/generate` - Generate blog post
- `GET /api/blog/[id]` - Get blog details
- `POST /api/blog/social-posts` - Generate social media variants
- `PUT /api/blog/[id]` - Update blog content

### AEO Reports (`/api/aeo-report/*`)
- `POST /api/aeo-report/generate` - Create AEO report
- `GET /api/aeo-report/[id]` - View report
- `GET /api/aeo-report/list` - List user reports

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm dev              # Start Next.js dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:push          # Push schema changes
pnpm db:studio        # Open Drizzle Studio
pnpm db:generate      # Generate migrations

# Code Quality
pnpm lint             # Run ESLint
pnpm type-check       # TypeScript type checking
```

### Python Backend Scripts

```bash
# Start Flask server
python api.py

# Run tests
pytest tests/

# Database migrations
alembic upgrade head
```

## 🎨 Component Library

Built with Shadcn/UI components:
- `Button`, `Input`, `Textarea`, `Select`
- `Dialog`, `Sheet`, `Popover`, `Tooltip`
- `Card`, `Table`, `Tabs`, `Badge`
- `Form`, `Label`, `Checkbox`, `Radio`
- `Alert`, `Toast`, `Progress`, `Skeleton`

All components are fully typed and customizable with Tailwind CSS.

## 🔐 Authentication Flow

1. **Better Auth** handles authentication with:
   - Google OAuth 2.0
   - Email/Password with verification
   - Session management
   - Profile syncing

2. **Middleware Protection** (`middleware.ts`):
   - Routes protected by default
   - Public routes: `/`, `/login`, `/register`, `/pricing-public`
   - Automatic redirect to login for unauthenticated users

3. **Client-Side Auth Hooks**:
   - `useSession()` - Get current user session
   - `useAuth()` - Auth actions (login, logout, signup)

## 💰 Credit System

### Credit Costs

| Feature | Credits | Notes |
|---------|---------|-------|
| Chat Message | 5 | Per message sent |
| Brand Analysis | 30 | Full competitor analysis |
| File Generation | 30 | Per file in batch |
| Blog Generation | 10 | Multi-agent blog post |
| AEO Report | 50 | Comprehensive report |

### Billing Integration

- **Autumn.js** manages credit purchases and subscriptions
- **Stripe** processes payments
- **Real-time balance** displayed in navbar
- **Insufficient credits** trigger upgrade prompts

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect Repository** to Vercel
2. **Configure Environment Variables** in Vercel dashboard
3. **Deploy**: Automatic deployments on push to main

### Database Hosting

- **PostgreSQL**: Vercel Postgres, Supabase, or Railway
- **MongoDB**: MongoDB Atlas
- **Qdrant**: Qdrant Cloud or self-hosted

### Python Backend

- **Vercel Functions**: Deploy as serverless functions
- **Alternative**: Railway, Render, or Fly.io

## 🧪 Testing

```bash
# Frontend tests
pnpm test

# Python tests
cd PyCode/Intelliwrite
pytest tests/

# E2E tests
pnpm test:e2e
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Code Style

- **TypeScript**: Follow ESLint configuration
- **Python**: Follow PEP 8 with Black formatter
- **Components**: Use functional components with hooks
- **Commits**: Use conventional commits (feat:, fix:, docs:, etc.)

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI integration
- [Better Auth](https://www.better-auth.com/) - Authentication
- [Drizzle ORM](https://orm.drizzle.team/) - Database toolkit
- [Shadcn/UI](https://ui.shadcn.com/) - Component library
- [Agno](https://github.com/agno-agi/agno) - Multi-agent framework

## 📞 Support

For issues and feature requests, please [open an issue](https://github.com/your-org/cognerd/issues) on GitHub.

---

**Built with ❤️ for modern SaaS applications**