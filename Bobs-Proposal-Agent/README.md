# Bob's Proposal Agent

An AI-powered proposal generation system that automatically creates sales proposals from customer conversations. The system uses Google Gemini Flash 2.5 to analyze conversations, extract customer requirements, match products, and generate professional proposals.

## 🎯 Overview

This application automatically generates sales proposals by:
1. Analyzing customer conversations (from HubSpot or manual input)
2. Using AI to extract product requirements, quantities, and customer information
3. Matching products from a catalog
4. Generating professional proposals with pricing

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS + shadcn/ui components
- React Query for data fetching
- Wouter for routing

**Backend:**
- Express.js server
- TypeScript
- Drizzle ORM with PostgreSQL
- OpenAI SDK (for Gemini compatibility)

**AI/LLM:**
- Google Gemini Flash 2.5 (default)
- OpenAI GPT-4o-mini (optional)
- Easily switchable via environment variables

**Database:**
- PostgreSQL (via Neon or any PostgreSQL database)
- Drizzle ORM for type-safe database operations

## 📁 Project Structure

```
Bobs-Proposal-Agent/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   │   ├── instant-proposal.tsx    # Main proposal generation page
│   │   │   ├── hubspot-conversations.tsx # HubSpot integration
│   │   │   ├── proposal-detail.tsx     # Proposal viewing/editing
│   │   │   └── ...
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and API client
│   └── index.html
│
├── server/                 # Backend Express server
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # API route handlers
│   ├── ai-service.ts      # AI/LLM integration (Gemini/OpenAI)
│   ├── storage.ts         # Database operations
│   ├── load-products.ts   # CSV product loader
│   ├── pdf-generator.ts   # PDF generation
│   ├── product-bundler.ts # Product bundling logic
│   └── hubspot-service.ts # HubSpot API integration
│
├── shared/                 # Shared types and schemas
│   └── schema.ts          # Database schemas (Drizzle)
│
├── attached_assets/        # Product catalog CSV
│   └── Bob's Containers - All Products (SKUs) - For Agent_*.csv
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── drizzle.config.ts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or cloud like Neon)
- Google Gemini API key (or OpenAI API key)

### Installation

1. **Clone/Navigate to the project:**
   ```bash
   cd Bobs-Proposal-Agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   
   Create a `.env` file in the `Bobs-Proposal-Agent` directory:
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/bobs_proposals
   
   # AI Provider (Gemini is default)
   AI_PROVIDER=gemini
   AI_API_KEY=your-gemini-api-key-here
   AI_MODEL=gemini-2.5-flash
   
   # Or use OpenAI:
   # AI_PROVIDER=openai
   # AI_API_KEY=sk-your-openai-key
   # AI_MODEL=gpt-4o-mini
   
   # Server Port (default: 5000)
   PORT=5000
   
   # Optional: HubSpot Integration
   HUBSPOT_PRIVATE_APP_TOKEN=your-hubspot-token
   ```

4. **Set up the database:**
   ```bash
   # Push schema to database
   npm run db:push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Access the application:**
   - Open http://localhost:5000 in your browser

## 📋 Detailed Setup

### Database Setup

The application uses PostgreSQL. You can use:

**Option 1: Local PostgreSQL**
```bash
# Install PostgreSQL locally
# Create database
createdb bobs_proposals

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://localhost:5432/bobs_proposals
```

**Option 2: Neon (Cloud PostgreSQL)**
1. Sign up at https://neon.tech
2. Create a new project
3. Copy the connection string
4. Set `DATABASE_URL` in `.env`

**Option 3: Other PostgreSQL Providers**
- Heroku Postgres
- Supabase
- AWS RDS
- Any PostgreSQL-compatible database

### Product Catalog

The product catalog is loaded from a CSV file on server startup:

**Location:** `attached_assets/Bob's Containers - All Products (SKUs) - For Agent_*.csv`

**Format:**
```csv
Product Name,Price
20ft New High Cube Container,3785.00
20ft Container Office,25099.00
...
```

**Note:** Products are automatically loaded when the server starts. The CSV file must be in the `attached_assets/` directory.

### AI Provider Configuration

**Default: Google Gemini Flash 2.5**

The system is pre-configured with Gemini. No setup needed if using the default API key.

**To use your own Gemini key:**
```bash
export AI_API_KEY=your-gemini-api-key
```

**To switch to OpenAI:**
```bash
export AI_PROVIDER=openai
export AI_API_KEY=sk-your-openai-key
export AI_MODEL=gpt-4o-mini
```

See `AI_PROVIDER_CONFIG.md` for detailed configuration options.

## 🎮 Usage

### Generating Proposals

#### Method 1: Instant Proposal (Manual Input)

1. Navigate to **"Instant Proposal"** in the sidebar
2. Paste a customer conversation:
   ```
   Customer: I need a 20-ft container for my backyard rental. I need two of them.
   
   Sales: Great! We have several 20-ft ADU options...
   
   Customer: Off-grid would be ideal. My budget is $50,000.
   ```
3. Click **"Generate Proposal"**
4. Review and edit the generated proposal

#### Method 2: HubSpot Conversations

1. Configure HubSpot API key in **"HubSpot Settings"**
2. Navigate to **"HubSpot Conversations"**
3. Select a conversation thread
4. Click **"Generate Proposal"**
5. The system extracts customer info and conversation automatically

### Proposal Features

- **Automatic Product Matching:** AI matches customer requests to products
- **Quantity Detection:** Extracts quantities from conversation ("two" → 2)
- **Customer Info Extraction:** Extracts name, email, phone from conversation
- **Timeline Extraction:** Extracts delivery dates/timelines
- **Budget Extraction:** Extracts budget information
- **PDF Generation:** Download proposals as PDFs
- **Proposal Management:** View, edit, approve/reject proposals

## 🔧 Development

### Available Scripts

```bash
# Development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run check

# Push database schema changes
npm run db:push
```

### Development Workflow

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Make changes:**
   - Frontend: Edit files in `client/src/`
   - Backend: Edit files in `server/`
   - Changes hot-reload automatically

3. **Test changes:**
   - Open http://localhost:5000
   - Test proposal generation
   - Check server logs in terminal

### Code Structure

**Frontend Pages:**
- `instant-proposal.tsx` - Main proposal generation
- `hubspot-conversations.tsx` - HubSpot integration
- `proposal-detail.tsx` - Proposal viewing/editing
- `dashboard.tsx` - Overview dashboard
- `catalog.tsx` - Product catalog browser

**Backend Services:**
- `ai-service.ts` - AI/LLM integration (Gemini/OpenAI)
- `routes.ts` - API endpoints
- `storage.ts` - Database operations
- `load-products.ts` - CSV product loader
- `pdf-generator.ts` - PDF generation
- `product-bundler.ts` - Bundle identification

## 🔌 API Endpoints

### Proposals

- `POST /api/proposals/generate` - Generate proposal from conversation
- `POST /api/proposals/analyze` - Analyze conversation (returns AI analysis)
- `GET /api/proposals` - List all proposals
- `GET /api/proposals/:id` - Get single proposal
- `PATCH /api/proposals/:id/status` - Update proposal status
- `POST /api/proposals/:id/pdf` - Generate PDF

### Products

- `GET /api/products` - List all products
- `GET /api/products/:id` - Get single product

### HubSpot

- `GET /api/hubspot/conversations` - List conversations
- `GET /api/hubspot/conversations/:threadId` - Get conversation details
- `POST /api/hubspot/config` - Configure HubSpot API key

## 🤖 How AI Proposal Generation Works

### Process Flow

1. **Input:** Customer conversation (text or HubSpot)
2. **AI Analysis:** Gemini analyzes conversation with full product catalog
3. **Product Matching:** AI matches customer requests to exact products
4. **Extraction:** AI extracts:
   - Products and quantities
   - Customer name and contact info
   - Timeline and budget
   - Special requirements
5. **Proposal Creation:** System creates proposal with:
   - Line items with pricing
   - Tax calculation (8.25%)
   - Total pricing
   - AI reasoning steps

### Key Features

- **No Keyword Matching:** Conversation goes directly to AI (no regex patterns)
- **Context Understanding:** AI distinguishes customer requests from sales options
- **Smart Extraction:** Extracts names, quantities, timelines automatically
- **Caching:** Results cached for identical inputs (deterministic)

## 📊 Database Schema

### Products Table
```sql
products (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL  -- in cents
)
```

### Proposals Table
```sql
proposals (
  id VARCHAR PRIMARY KEY,
  proposal_number TEXT UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  conversation_notes TEXT NOT NULL,
  ai_analysis JSONB,
  line_items JSONB NOT NULL,
  subtotal INTEGER NOT NULL,
  tax INTEGER,
  total INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## 🔐 Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | ✅ Yes |
| `AI_PROVIDER` | AI provider: 'gemini' or 'openai' | 'gemini' | No |
| `AI_API_KEY` | AI provider API key | Pre-configured | No* |
| `AI_MODEL` | AI model name | 'gemini-2.5-flash' | No |
| `PORT` | Server port | 5000 | No |
| `USE_LLM` | Enable/disable AI | 'true' | No |
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot API token | - | No |

*Required if using custom API key

## 🐛 Troubleshooting

### Server Won't Start

**Issue:** Port 5000 already in use
```bash
# Check what's using the port
lsof -i :5000

# Kill the process or use different port
export PORT=3000
npm run dev
```

**Issue:** Database connection error
```bash
# Check DATABASE_URL is set correctly
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Products Not Loading

**Issue:** CSV file not found
- Ensure CSV file is in `attached_assets/` directory
- Check file name matches expected pattern
- Check server logs for errors

### AI Not Working

**Issue:** Wrong products matched
- Check AI provider is configured correctly
- Check API key is valid
- Review server logs for AI errors
- Try switching providers (Gemini ↔ OpenAI)

**Issue:** Customer name shows "Valued Customer"
- AI should extract name from conversation
- Check if name is mentioned in conversation
- Review extraction patterns in `instant-proposal.tsx`

### Build Errors

**Issue:** TypeScript errors
```bash
# Check for type errors
npm run check

# Fix common issues
npm install --save-dev @types/node
```

## 📚 Additional Documentation

- `AI_PROVIDER_CONFIG.md` - Detailed AI provider configuration
- `PROPOSAL_SYSTEM_EXPLANATION.md` - How proposal generation works
- `TESTING_LLM_INTEGRATION.md` - Testing guide
- `CUSTOMER_NAME_FIX.md` - Customer name extraction details
- `KEYWORD_MATCHING_REMOVED.md` - Why keyword matching was removed

## 🚢 Production Deployment

### Build for Production

```bash
# Build frontend and backend
npm run build

# Start production server
npm start
```

### Environment Setup

1. Set production environment variables
2. Use production database
3. Configure production AI API keys
4. Set up proper logging
5. Configure CORS if needed

### Recommended Hosting

- **Frontend + Backend:** Vercel, Railway, Render, Fly.io
- **Database:** Neon, Supabase, AWS RDS
- **File Storage:** (if needed) AWS S3, Cloudflare R2

## 🤝 Contributing

1. Make changes in feature branch
2. Test thoroughly
3. Ensure TypeScript compiles: `npm run check`
4. Test proposal generation
5. Submit pull request

## 📝 License

MIT

## 🆘 Support

For issues or questions:
1. Check troubleshooting section
2. Review server logs
3. Check browser console for errors
4. Review documentation files

---

**Built with:** React, TypeScript, Express, PostgreSQL, Google Gemini Flash 2.5
