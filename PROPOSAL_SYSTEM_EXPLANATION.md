# Bob's Proposal Agent - System Explanation

## Overview
This document explains how the conversation chatbot phase works and how proposals are generated from conversations.

---

## 🔄 **Conversation Flow**

### 1. **Data Sources**

#### **Product Catalog (CSV)**
- **Location**: `attached_assets/Bob's Containers - All Products (SKUs) - For Agent_1761233039039.csv`
- **Loading**: Products are loaded on server startup via `server/load-products.ts`
- **Format**: CSV with columns: Product Name, Price
- **Storage**: Products stored in database via `server/storage.ts`
- **Usage**: All products are loaded into memory for matching against conversation keywords

#### **HubSpot Conversations**
- **Integration**: `server/hubspot-service.ts` connects to HubSpot API
- **Data Retrieved**:
  - Conversation threads (threads with messages)
  - Messages (customer and sales rep messages)
  - Contact information (name, email, phone, company)
  - Associated deals
- **API Endpoint**: `/api/hubspot/conversations/:threadId`
- **Frontend**: `client/src/pages/hubspot-conversations.tsx` displays conversations

---

## 🤖 **AI/LLM Usage**

### **Current Implementation: Rule-Based (No LLM Calls)**

**Important**: The system currently uses a **deterministic, rule-based approach** instead of actual LLM calls for consistency and reproducibility.

#### **OpenAI Client Setup**
```typescript
// server/ai-service.ts
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL,
});
```

**Note**: The OpenAI client is initialized but **NOT currently used** in the proposal generation flow. The system was refactored to use deterministic keyword matching instead.

#### **Prompts Defined (But Not Used)**
The following prompts are defined in `server/ai-service.ts` but are not currently called:

**System Prompt** (lines 508-530):
```
You are a deterministic quantity parser for Bob's Containers.

ALREADY SELECTED PRODUCTS (by scoring system):
[list of pre-selected products with scores]

YOUR TASKS:
1. Determine QUANTITIES for the pre-selected products
2. Identify which selected products to actually include based on conversation
3. Extract any timeline or budget mentioned

QUANTITY RULES:
- "two" or "2" → quantity: 2
- "a couple" → quantity: 2
- "a few" → quantity: 3
- "several" → quantity: 4
- No mention → quantity: 1

CONTEXT RULES:
- "discussing X vs Y" → This is comparison, NOT a purchase request
- Only include products that are explicitly requested or clearly needed
- If customer just "discussed" or "compared" something, don't include it
```

**User Prompt** (lines 532-568):
```
PRODUCT CATALOG ([N] products):
[formatted product list with IDs, names, prices]

CUSTOMER: [customer name]
CONVERSATION NOTES:
[full conversation text]

TASK: Analyze this conversation and match to exact products with perfect accuracy.

[Detailed instructions for product matching...]

Return a JSON response with this EXACT structure:
{
  "requirements": [...],
  "reasoningSteps": [...],
  "matchedProducts": [...],
  "unmatchedNeeds": [...],
  "estimatedBudget": "...",
  "timeline": "...",
  "additionalNotes": "..."
}
```

---

## 🎯 **Proposal Generation Process**

### **Step-by-Step Flow**

#### **1. Conversation Input**
- User pastes conversation text OR selects HubSpot conversation
- Conversation is formatted as: `"Customer: [message]\n\nSales: [message]"`
- Customer name and email extracted from HubSpot contact or conversation text

#### **2. Analysis Endpoint** (`/api/proposals/analyze`)
**File**: `server/routes.ts` (lines 44-65)

```typescript
POST /api/proposals/analyze
Body: {
  conversationNotes: string,
  customerName: string
}
```

#### **3. Keyword Extraction** (Deterministic)
**File**: `server/ai-service.ts` (lines 156-170)

**Keyword Patterns** (30+ patterns defined):
- Container types: `container`, `20ft`, `40ft`, `53ft`, `office`, `kitchen`, `bathroom`
- ADU/Studio: `adu`, `studio`, `backyard rental`, `guest house`
- Features: `rooftop_deck`, `upgrade`, `solar`, `offgrid`, `composting`, `insulation`
- Services: `onsite`, `consultation`, `permit`, `foundation`
- Each pattern has:
  - **Label**: identifier (e.g., "adu")
  - **Regex patterns**: multiple patterns to match (e.g., `/adu/gi`, `/backyard\s+rental/gi`)
  - **Weight**: scoring weight (e.g., 10 for high priority)

**Example Extraction**:
```typescript
Input: "I need a 20-ft container for my backyard rental unit"
Keywords extracted: Set(['20ft', 'container', 'adu'])
```

#### **4. Product Scoring** (Deterministic)
**File**: `server/ai-service.ts` (lines 180-332)

**Scoring Algorithm**:
1. For each product in catalog
2. For each extracted keyword
3. Check if product name contains keyword
4. Award points: `score += pattern.weight * 2`
5. Special cases get bonus points

**Example**:
```typescript
Product: "20-ft ADU Studio Container"
Keywords: ['20ft', 'adu', 'container']
Score calculation:
  - '20ft' matches → +20 points (weight 10 * 2)
  - 'adu' matches → +20 points (weight 10 * 2)
  - 'container' matches → +24 points (weight 12 * 2)
Total Score: 64
```

#### **5. Product Selection** (Deterministic)
**File**: `server/ai-service.ts` (lines 334-366)

**Selection Process**:
1. Filter products with score > 0
2. Sort by:
   - Score (descending)
   - Price (ascending) - tiebreaker
   - Name (alphabetical) - tiebreaker
   - ID (alphabetical) - final tiebreaker
3. Take top 5 products with score >= 6

#### **6. Bundle Identification** (Optional)
**File**: `server/product-bundler.ts`

**Bundle Patterns**:
- "Off-Grid Living Package" (trigger: offgrid, solar)
- "Complete Office Setup" (trigger: office, workspace)
- "ADU Living Package" (trigger: adu, rental)
- "Construction Site Bundle" (trigger: construction, site)
- "Startup Workspace" (trigger: startup, tech)

**Bundle Logic**:
- Checks if conversation keywords match bundle triggers
- Finds products matching bundle requirements
- Calculates bundle discount (5-10%)
- Returns bundle with savings amount

#### **7. Complementary Product Suggestions** (Optional)
**File**: `server/product-bundler.ts` (lines 160-235)

**Rules**:
- If container selected → suggest electrical upgrades
- If office selected → suggest AC/HVAC
- If ADU selected → suggest rooftop deck
- If large container (40ft/53ft) → suggest site assessment

#### **8. Result Caching** (Deterministic)
**File**: `server/ai-service.ts` (lines 460-475)

**Caching Strategy**:
1. Normalize conversation text (remove punctuation, lowercase, trim whitespace)
2. Create SHA256 hash of: `normalizedConversation + normalizedCustomerName`
3. Check cache for existing result
4. If found → return cached result (ensures identical inputs = identical outputs)
5. If not found → compute result and cache it

**Why Caching?**
- Ensures 100% reproducibility
- Same conversation always produces same proposal
- Reduces computation for repeated inputs

#### **9. Proposal Creation**
**File**: `server/routes.ts` (lines 67-136)

**Process**:
1. Call `analyzeConversation()` to get matched products
2. Create line items from matched products:
   ```typescript
   lineItems = matchedProducts.map(match => ({
     productId: match.productId,
     productName: match.productName,
     quantity: match.quantity,  // Default: 1
     unitPrice: match.unitPrice,
     total: unitPrice * quantity
   }))
   ```
3. Calculate pricing:
   - Subtotal = sum of all line item totals
   - Tax = subtotal * 0.0825 (8.25%)
   - Total = subtotal + tax
4. Generate proposal number: `BC-YYYYMM-XXXX`
5. Store proposal in database

---

## 📊 **Data Flow Diagram**

```
HubSpot Conversation
    ↓
Extract Messages → Format as Text
    ↓
/api/proposals/analyze
    ↓
analyzeConversation()
    ↓
┌─────────────────────────────────┐
│ 1. Normalize & Hash Input       │ → Check Cache → Return if exists
│ 2. Extract Keywords (Regex)     │
│ 3. Score All Products           │
│ 4. Select Top 5 Products        │
│ 5. Identify Bundles (optional) │
│ 6. Suggest Complements (opt)    │
│ 7. Cache Result                 │
└─────────────────────────────────┘
    ↓
Return AIAnalysisResult {
  matchedProducts: [...],
  requirements: [...],
  bundles: [...],
  complementaryProducts: [...]
}
    ↓
/api/proposals/generate
    ↓
Create Line Items → Calculate Pricing → Generate Proposal Number
    ↓
Store in Database
    ↓
Return Proposal with Analysis
```

---

## 🔑 **Key Files**

### **Backend**
- `server/ai-service.ts` - Core analysis logic (keyword extraction, scoring, matching)
- `server/routes.ts` - API endpoints for proposals
- `server/load-products.ts` - CSV product loader
- `server/product-bundler.ts` - Bundle and complementary product logic
- `server/hubspot-service.ts` - HubSpot API integration
- `server/storage.ts` - Database operations

### **Frontend**
- `client/src/pages/hubspot-conversations.tsx` - HubSpot conversation UI
- `client/src/pages/instant-proposal.tsx` - Manual conversation input UI
- `client/src/pages/quick-proposal.tsx` - Quick proposal creation
- `client/src/pages/proposal-detail.tsx` - Proposal viewing/editing

---

## 📝 **Example: Full Flow**

### **Input Conversation**
```
Customer: Hi, I'm looking for a small backyard rental unit. Something around 20 feet would be perfect.

Sales: Great! We have several 20-ft ADU options. Are you looking for something off-grid or connected to utilities?

Customer: Off-grid would be ideal. I also want a rooftop deck.

Sales: Perfect! We have the Alpine Studio 20-ft with solar pre-wiring and rooftop deck option.
```

### **Processing**
1. **Keywords Extracted**: `['20ft', 'adu', 'backyard rental', 'offgrid', 'rooftop_deck', 'solar', 'studio']`
2. **Products Scored**:
   - "Alpine Studio 20-ft ADU" → Score: 64
   - "20-ft Container with Rooftop Deck" → Score: 48
   - "Off-Grid Solar Pre-Wiring Kit" → Score: 38
3. **Top Products Selected**:
   - Alpine Studio 20-ft ADU (quantity: 1)
   - Rooftop Deck Add-on (quantity: 1)
   - Solar Pre-Wiring Package (quantity: 1)
4. **Bundle Identified**: "Off-Grid Living Package" (if all components match)
5. **Proposal Created** with line items, pricing, and analysis

---

## 🎯 **Key Design Decisions**

### **Why Deterministic Instead of LLM?**
1. **Reproducibility**: Same conversation always produces same proposal
2. **Consistency**: No randomness in product matching
3. **Performance**: Faster (no API calls)
4. **Cost**: No LLM API costs
5. **Debugging**: Easier to trace why products were selected

### **Why Keyword-Based Matching?**
1. **Reliability**: Regex patterns are predictable
2. **Maintainability**: Easy to add new keywords
3. **Speed**: Instant matching vs. API latency
4. **Control**: Full control over matching logic

### **Why Caching?**
1. **Determinism**: Ensures identical inputs = identical outputs
2. **Performance**: Avoids recomputation
3. **Testing**: Easier to test with known inputs/outputs

---

## 🔧 **Configuration**

### **Environment Variables**
- `OPENAI_API_KEY` - OpenAI API key (not currently used)
- `AI_INTEGRATIONS_OPENAI_API_KEY` - Alternative OpenAI key
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - Custom OpenAI base URL
- `HUBSPOT_PRIVATE_APP_TOKEN` - HubSpot API token (for conversation import)

### **Product Catalog**
- CSV file must be in `attached_assets/` directory
- Format: `Product Name,Price` (header row is skipped)
- Prices can be in format: `$1,234.56` or `1234.56`
- Prices are converted to cents internally

---

## 🚀 **Future Enhancements (If LLM Were Re-enabled)**

If you wanted to use the LLM prompts that are defined:

1. **Uncomment LLM Call** in `analyzeConversation()`:
   ```typescript
   const response = await openai.chat.completions.create({
     model: "gpt-4o-mini", // or "gpt-4", "gpt-3.5-turbo"
     messages: [
       { role: "system", content: systemPrompt },
       { role: "user", content: userPrompt }
     ],
     response_format: { type: "json_object" },
     temperature: 0.1 // Low temperature for consistency
   });
   ```

2. **Parse JSON Response**:
   ```typescript
   const aiResult = JSON.parse(response.choices[0].message.content);
   ```

3. **Merge with Scoring System**:
   - Use scoring for initial product selection
   - Use LLM for quantity determination and context understanding
   - Combine both approaches for best results

---

## 📚 **Summary**

**Current System**:
- ✅ Rule-based keyword extraction (30+ patterns)
- ✅ Deterministic product scoring
- ✅ Top 5 product selection
- ✅ Bundle identification
- ✅ Complementary product suggestions
- ✅ Result caching for reproducibility
- ❌ No actual LLM calls (prompts defined but unused)

**Data Sources**:
- Product catalog from CSV file
- Conversations from HubSpot API or manual input
- Customer info from HubSpot contacts

**Proposal Output**:
- Line items with products, quantities, prices
- Subtotal, tax (8.25%), total
- AI analysis metadata
- Bundle suggestions
- Complementary product recommendations
