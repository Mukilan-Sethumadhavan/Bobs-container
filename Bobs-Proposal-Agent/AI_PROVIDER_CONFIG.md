# AI Provider Configuration

The system supports multiple AI providers and can be easily switched via environment variables.

## Current Configuration

**Default Provider:** Google Gemini Flash 2.5  
**Default API Key:** Pre-configured (can be overridden)

## Supported Providers

### 1. Google Gemini (Default)
- **Model:** `gemini-2.5-flash`
- **Base URL:** `https://generativelanguage.googleapis.com/v1beta/openai/`
- **Uses:** OpenAI compatibility layer

### 2. OpenAI
- **Model:** `gpt-4o-mini` (default) or any OpenAI model
- **Base URL:** `https://api.openai.com/v1` (default)

## Environment Variables

### Basic Configuration

```bash
# AI Provider Selection
AI_PROVIDER=gemini          # 'gemini' or 'openai'

# API Key (provider-agnostic)
AI_API_KEY=your-api-key-here

# Model Name
AI_MODEL=gemini-2.5-flash   # For Gemini
# AI_MODEL=gpt-4o-mini      # For OpenAI

# Base URL (usually auto-detected based on provider)
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
```

### Provider-Specific Keys (Alternative)

```bash
# Gemini-specific
GEMINI_API_KEY=your-gemini-key

# OpenAI-specific
OPENAI_API_KEY=your-openai-key
```

### Disable LLM

```bash
USE_LLM=false
```

## Quick Setup Examples

### Using Gemini (Default - Already Configured)

```bash
# No configuration needed - uses default Gemini Flash 2.5
# Or explicitly set:
export AI_PROVIDER=gemini
export AI_API_KEY=AIzaSyBv8FoWfT7DTVm9T9_GusoovxVOSFBLbu0
```

### Switching to OpenAI

```bash
export AI_PROVIDER=openai
export AI_API_KEY=sk-your-openai-key-here
export AI_MODEL=gpt-4o-mini
```

### Using .env File

Create `Bobs-Proposal-Agent/.env`:

```env
# Gemini Configuration (Default)
AI_PROVIDER=gemini
AI_API_KEY=AIzaSyBv8FoWfT7DTVm9T9_GusoovxVOSFBLbu0
AI_MODEL=gemini-2.5-flash

# Or switch to OpenAI:
# AI_PROVIDER=openai
# AI_API_KEY=sk-your-openai-key
# AI_MODEL=gpt-4o-mini
```

## How It Works

The system uses the **OpenAI SDK** with provider-specific base URLs:

1. **Gemini**: Uses OpenAI compatibility layer at `generativelanguage.googleapis.com`
2. **OpenAI**: Uses standard OpenAI API at `api.openai.com`

This means:
- ✅ Same code works for both providers
- ✅ Easy to switch via environment variables
- ✅ No code changes needed to swap providers

## Model Options

### Gemini Models
- `gemini-2.5-flash` (default) - Fast, cost-effective
- `gemini-2.0-flash-exp` - Experimental
- `gemini-1.5-pro` - More capable, slower

### OpenAI Models
- `gpt-4o-mini` - Fast, cost-effective
- `gpt-4o` - More capable
- `gpt-4-turbo` - Latest GPT-4
- `gpt-3.5-turbo` - Legacy

## Testing Provider Switch

1. **Test with Gemini:**
   ```bash
   export AI_PROVIDER=gemini
   export AI_API_KEY=AIzaSyBv8FoWfT7DTVm9T9_GusoovxVOSFBLbu0
   npm run dev
   ```

2. **Test with OpenAI:**
   ```bash
   export AI_PROVIDER=openai
   export AI_API_KEY=sk-your-openai-key
   npm run dev
   ```

3. **Check console logs:**
   - Gemini: `🤖 Calling GEMINI (gemini-2.5-flash) to refine product selection...`
   - OpenAI: `🤖 Calling OPENAI (gpt-4o-mini) to refine product selection...`

## Cost Comparison

### Gemini Flash 2.5
- **Input:** ~$0.075 per 1M tokens
- **Output:** ~$0.30 per 1M tokens
- **Very cost-effective** for high-volume usage

### OpenAI GPT-4o-mini
- **Input:** ~$0.15 per 1M tokens
- **Output:** ~$0.60 per 1M tokens
- **Good balance** of cost and quality

## Troubleshooting

### Provider Not Working?

1. **Check API Key:**
   ```bash
   echo $AI_API_KEY
   ```

2. **Check Provider:**
   ```bash
   echo $AI_PROVIDER
   ```

3. **Check Console Logs:**
   - Look for provider name in logs
   - Check for API errors

### Switching Providers

The system automatically detects the provider from `AI_PROVIDER` env var:
- `gemini` → Uses Gemini compatibility endpoint
- `openai` → Uses OpenAI endpoint
- Default → `gemini`

### API Key Priority

The system checks API keys in this order:
1. `AI_API_KEY` (provider-agnostic)
2. `GEMINI_API_KEY` (Gemini-specific)
3. `OPENAI_API_KEY` (OpenAI-specific)
4. Default Gemini key (hardcoded fallback)

## Making It Replaceable

The code is designed to be easily replaceable:

1. **Single Configuration Point:** All provider settings in one place (top of `ai-service.ts`)
2. **Environment Variables:** No code changes needed to switch
3. **Abstraction:** Uses OpenAI SDK for both (via compatibility layer)
4. **Fallback Logic:** Gracefully falls back to scoring system if API fails

## Future Providers

To add a new provider:

1. Add provider detection in `ai-service.ts`
2. Set appropriate base URL
3. Update environment variable documentation
4. Test with the new provider

The architecture supports easy extension!
