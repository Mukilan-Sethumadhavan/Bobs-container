# Testing LLM Integration Guide

## Quick Start

### 1. Set Up Environment Variables (Optional)

**Default:** Google Gemini Flash 2.5 is already configured!

Create a `.env` file in the `Bobs-Proposal-Agent` directory (or set environment variables):

```bash
# Gemini (Default - Already Configured)
AI_PROVIDER=gemini
AI_API_KEY=your-gemini-api-key-here
AI_MODEL=gemini-2.5-flash

# Or switch to OpenAI:
# AI_PROVIDER=openai
# AI_API_KEY=sk-your-openai-key-here
# AI_MODEL=gpt-4o-mini

# Optional: Disable AI and use only scoring system
# USE_LLM=false
```

### 2. Install Dependencies

```bash
cd Bobs-Proposal-Agent
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

The server will start on port 5000 (or the PORT environment variable).

### 4. Access the Web Interface

Open your browser to:
- **Local**: http://localhost:5000
- **Replit**: The URL shown in the console

### 5. Test the LLM Integration

#### Option A: Instant Proposal Page
1. Navigate to **"Instant Proposal"** in the sidebar
2. Paste a conversation like:
   ```
   Customer: Hi, I'm looking for a small backyard rental unit. Something around 20 feet would be perfect. I need two of them.
   
   Sales: Great! We have several 20-ft ADU options. Are you looking for something off-grid or connected to utilities?
   
   Customer: Off-grid would be ideal. I also want a rooftop deck on both units.
   
   Sales: Perfect! We have the Alpine Studio 20-ft with solar pre-wiring and rooftop deck option.
   ```
3. Click **"Generate Proposal"**
4. Check the console logs to see:
   - `🤖 Calling GEMINI (gemini-2.5-flash) to refine product selection...`
   - `✅ GEMINI response received: {...}`
   - Or `❌ LLM call failed, falling back to scoring system` if there's an error

#### Option B: HubSpot Conversations (if configured)
1. Navigate to **"HubSpot Conversations"**
2. Select a conversation
3. Click **"Generate Proposal"**

### 6. What to Look For

#### Success Indicators:
- ✅ Console shows: `🤖 Calling GEMINI (gemini-2.5-flash) to refine product selection...`
- ✅ Console shows: `✅ GEMINI response received: {...}`
- ✅ Proposal shows products with quantities determined by AI
- ✅ Proposal shows `additionalNotes: "Selected using GEMINI-enhanced analysis"`
- ✅ Reasoning steps show AI's logic

#### Fallback Indicators:
- ⚠️ Console shows: `❌ LLM call failed, falling back to scoring system`
- ⚠️ Proposal shows `additionalNotes: "Selected using deterministic scoring system"`
- This means AI wasn't used (API key missing, error, or disabled)

### 7. Compare Results

**With LLM Enabled:**
- More accurate quantity detection ("two" → quantity: 2)
- Better context understanding (comparisons vs. actual requests)
- Extracts budget and timeline information
- More detailed reasoning steps

**With LLM Disabled (USE_LLM=false):**
- Uses only keyword-based scoring
- Default quantity: 1 for all products
- No budget/timeline extraction
- Simpler reasoning

## Testing Different Scenarios

### Test 1: Quantity Detection
**Input:**
```
Customer: I need two 20-ft containers for storage.
```

**Expected with LLM:**
- Quantity: 2 for the 20-ft container product

**Expected without LLM:**
- Quantity: 1 (default)

### Test 2: Context Understanding
**Input:**
```
Customer: We were discussing 20-ft versus 40-ft containers, but I think the 40-ft would work better for our needs.
```

**Expected with LLM:**
- Only includes 40-ft container (understands "discussing" is comparison, not request)

**Expected without LLM:**
- Might include both (keyword matching)

### Test 3: Budget Extraction
**Input:**
```
Customer: My budget is around $50,000 for this project.
```

**Expected with LLM:**
- `estimatedBudget: "$50,000"` in the analysis

**Expected without LLM:**
- No budget extraction

## Troubleshooting

### AI Not Being Called

1. **Check API Key:**
   ```bash
   echo $AI_API_KEY
   # Should show your API key (Gemini key by default)
   ```

2. **Check Provider:**
   ```bash
   echo $AI_PROVIDER
   # Should show 'gemini' or 'openai'
   ```

3. **Check Console Logs:**
   - Look for `🤖 Calling GEMINI...` or `🤖 Calling OPENAI...` message
   - If missing, AI is disabled or API key not found

4. **Check Environment:**
   - Make sure `.env` file is in `Bobs-Proposal-Agent/` directory
   - Or set environment variables before running `npm run dev`

### AI Call Failing

1. **Check API Key Validity (Gemini):**
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=$AI_API_KEY"
   ```

2. **Check API Key Validity (OpenAI):**
   ```bash
   curl https://api.openai.com/v1/models -H "Authorization: Bearer $AI_API_KEY"
   ```

3. **Check Rate Limits:**
   - Gemini and OpenAI have rate limits based on your plan
   - Check console for rate limit errors

4. **Check Network:**
   - Ensure server can reach the API endpoint
   - Check firewall/proxy settings

### Results Not as Expected

1. **Check LLM Response:**
   - Look in console for `✅ LLM response received: {...}`
   - Verify the JSON structure matches expected format

2. **Check Product IDs:**
   - LLM might suggest invalid product IDs
   - Console will show: `⚠️ LLM suggested invalid product ID: ...`
   - These are automatically filtered out

3. **Check Model:**
   - For Gemini: `gemini-2.5-flash` (default), `gemini-2.0-flash-exp`, `gemini-1.5-pro`
   - For OpenAI: `gpt-4o-mini`, `gpt-4o`, `gpt-4-turbo`
   - Set via `AI_MODEL` environment variable

## Code Changes Made

The AI integration was added to `server/ai-service.ts`:

1. **Provider Configuration** (top of file):
   - Supports Gemini (default) and OpenAI
   - Configurable via environment variables
   - Easy to switch providers

2. **AI Call** (after scoring system):
   - Uses pre-selected products from scoring
   - Sends system and user prompts to AI provider
   - Parses JSON response
   - Validates product IDs

3. **Fallback Logic**:
   - If AI fails or is disabled, uses scoring system
   - Ensures system always works

4. **Hybrid Approach**:
   - Scoring system finds candidate products
   - AI refines quantities and context
   - Best of both worlds

## Next Steps

1. Test with various conversation styles
2. Monitor AI costs (Gemini Flash 2.5 is very cost-effective)
3. Adjust prompts if needed (in `ai-service.ts`)
4. Try switching providers to compare results
5. Add more sophisticated error handling

## 💡 Tips

- **Gemini Flash 2.5** is the default (very fast and cost-effective)
- **OpenAI GPT-4o-mini** is also available (switch via `AI_PROVIDER=openai`)
- AI responses are cached (same input = same output)
- Check console logs for debugging
- See `AI_PROVIDER_CONFIG.md` for detailed provider configuration
