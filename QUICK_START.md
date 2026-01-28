# Quick Start - Testing LLM Integration

## ✅ What's Been Done

1. **LLM Integration Added** - The `analyzeConversation` function now calls OpenAI API
2. **Hybrid Approach** - Uses scoring system first, then LLM refines results
3. **Fallback Logic** - If LLM fails, automatically falls back to scoring system
4. **Server Started** - Development server should be running

## 🚀 How to Test

### Step 1: Configure AI Provider (Optional)

**Default:** Google Gemini Flash 2.5 is already configured!

**Option A: Use Default (Gemini)**
```bash
# No configuration needed - works out of the box!
```

**Option B: Custom API Key**
```bash
export AI_API_KEY="your-gemini-api-key-here"
```

**Option C: Switch to OpenAI**
```bash
export AI_PROVIDER=openai
export AI_API_KEY="sk-your-openai-key-here"
```

**Option D: Create .env file**
Create a file `Bobs-Proposal-Agent/.env`:
```
# Gemini (Default)
AI_PROVIDER=gemini
AI_API_KEY=your-gemini-key
AI_MODEL=gemini-2.5-flash

# Or OpenAI:
# AI_PROVIDER=openai
# AI_API_KEY=sk-your-openai-key
# AI_MODEL=gpt-4o-mini
```

**Get API keys from:**
- Gemini: https://aistudio.google.com/app/apikey
- OpenAI: https://platform.openai.com/api-keys

### Step 2: Access the Web Interface

Open your browser to:
- **Local**: http://localhost:5000
- **Replit**: Check the console for the URL

### Step 3: Test with a Conversation

1. Navigate to **"Instant Proposal"** in the sidebar
2. Paste this test conversation:

```
Customer: Hi, I'm looking for a small backyard rental unit. Something around 20 feet would be perfect. I need two of them.

Sales: Great! We have several 20-ft ADU options. Are you looking for something off-grid or connected to utilities?

Customer: Off-grid would be ideal. I also want a rooftop deck on both units.

Sales: Perfect! We have the Alpine Studio 20-ft with solar pre-wiring and rooftop deck option. My budget is around $50,000.
```

3. Click **"Generate Proposal"**

### Step 4: Check the Results

**Look for in the proposal:**
- ✅ Products with correct quantities (should be 2, not 1)
- ✅ Budget extracted: "$50,000"
- ✅ Rooftop deck included
- ✅ Off-grid/solar products included

**Check the console logs:**
- `🤖 Calling GEMINI (gemini-2.5-flash) to refine product selection...` - Gemini is being called
- `✅ GEMINI response received: {...}` - Gemini responded successfully
- `❌ LLM call failed...` - API failed, using fallback

## 🔍 What Changed in the Code

**File: `server/ai-service.ts`**

1. **Added LLM Call** (after line 568):
   - Checks if LLM should be used (`USE_LLM` env var)
   - Calls OpenAI API with system and user prompts
   - Parses JSON response
   - Validates product IDs

2. **Hybrid Logic**:
   - Scoring system finds candidate products (top 10)
   - LLM refines: quantities, context, budget, timeline
   - Falls back to scoring if LLM fails

3. **Result Merging**:
   - Combines LLM insights with scoring system results
   - Includes bundles and complementary products

## 🎯 Expected Behavior

### With AI Enabled (Default - Gemini Flash 2.5):
- More accurate quantity detection
- Better context understanding
- Budget and timeline extraction
- Detailed reasoning steps
- Fast and cost-effective

### Without AI (USE_LLM=false):
- Uses scoring system only
- Default quantity: 1
- No budget/timeline extraction
- Still works perfectly!

## 🐛 Troubleshooting

### AI Not Working?

1. **Check API Key:**
   ```bash
   echo $AI_API_KEY
   ```

2. **Check Provider:**
   ```bash
   echo $AI_PROVIDER  # Should be 'gemini' or 'openai'
   ```

3. **Check Console:**
   - Look for error messages
   - Check if API key is valid

4. **Test Gemini API Key:**
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=$AI_API_KEY"
   ```

### Server Not Starting?

1. **Check if port 5000 is available:**
   ```bash
   lsof -i :5000
   ```

2. **Check logs:**
   - Look at the terminal where `npm run dev` is running
   - Check for error messages

### Want to Disable AI?

Set environment variable:
```bash
export USE_LLM=false
```

Or in `.env` file:
```
USE_LLM=false
```

### Want to Switch Providers?

**Switch to OpenAI:**
```bash
export AI_PROVIDER=openai
export AI_API_KEY=sk-your-openai-key
```

**Switch back to Gemini:**
```bash
export AI_PROVIDER=gemini
export AI_API_KEY=your-gemini-key
```

See `AI_PROVIDER_CONFIG.md` for detailed configuration options.

## 📊 Testing Different Scenarios

### Test 1: Quantity Detection
**Input:** "I need two 20-ft containers"
**Expected:** Quantity = 2

### Test 2: Comparison vs Request
**Input:** "We discussed 20-ft vs 40-ft, but I'll go with 40-ft"
**Expected:** Only 40-ft included (not both)

### Test 3: Budget Extraction
**Input:** "My budget is $50,000"
**Expected:** `estimatedBudget: "$50,000"`

## 📝 Next Steps

1. Test with real conversations
2. Monitor LLM costs (gpt-4o-mini is very cheap ~$0.15/1M tokens)
3. Adjust prompts if needed (in `ai-service.ts`)
4. Add more test cases

## 💡 Tips

- **Gemini Flash 2.5** is the default (very fast and cost-effective)
- **OpenAI GPT-4o-mini** is also available (switch via `AI_PROVIDER=openai`)
- AI responses are cached (same input = same output)
- Check console logs for debugging
- See `AI_PROVIDER_CONFIG.md` for provider switching guide

---

**Need Help?** Check `TESTING_LLM_INTEGRATION.md` for detailed documentation.
