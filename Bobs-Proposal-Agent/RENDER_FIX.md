# Render Deployment Fix

## ⚠️ Common Mistake

When setting Build Command and Start Command in Render dashboard, **DO NOT** include the directory prefix!

### ❌ WRONG:
```
Bobs-Proposal-Agent/ $ npm install && npm run build
```

### ✅ CORRECT:
```
npm install && npm run build
```

## Why?

When you set **Root Directory** to `Bobs-Proposal-Agent` in Render settings, Render automatically runs all commands from that directory. The `Bobs-Proposal-Agent/ $` prefix you see in the UI is just a visual indicator - it should NOT be included in the actual command.

## Correct Settings

### Root Directory:
```
Bobs-Proposal-Agent
```

### Build Command:
```
npm install && npm run build
```

### Start Command:
```
npm start
```

## Environment Variables

Make sure these are set in the Environment section:

```
AI_API_KEY = your-gemini-api-key-here
AI_PROVIDER = gemini
AI_MODEL = gemini-2.5-flash
NODE_ENV = production
```

## After Fixing

1. Save the settings
2. Click "Manual Deploy" → "Deploy latest commit"
3. The build should now succeed!
