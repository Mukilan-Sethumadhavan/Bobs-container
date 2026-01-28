# Quick Deploy to Render - Step by Step

## ✅ What's Ready

- ✅ `.gitignore` updated (`.env` excluded)
- ✅ `.env.example` created (template for environment variables)
- ✅ `render.yaml` created (Render configuration)
- ✅ Build process verified
- ✅ Server configured for production

## 🚀 Deployment Steps

### 1. Push to GitHub

```bash
cd /home/mukilan/Downloads/Bobs-Proposal-Agent-Final/Bobs-Proposal-Agent

# Add all files
git add .

# Commit changes
git commit -m "Ready for Render deployment - Added dotenv support and Render config"

# If you haven't created a GitHub repo yet:
# 1. Go to https://github.com/new
# 2. Create repo: bobs-proposal-agent
# 3. Then run:
git remote add origin https://github.com/YOUR_USERNAME/bobs-proposal-agent.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Render

1. **Go to Render Dashboard:** https://dashboard.render.com
2. **Click "New +" → "Web Service"**
3. **Connect GitHub** (if not already connected)
4. **Select Repository:** `bobs-proposal-agent`
5. **Render will auto-detect settings from `render.yaml`**

### 3. Set Environment Variables

In Render Dashboard → Your Service → Environment:

**Add these variables:**
```
AI_API_KEY = your-gemini-api-key-here
AI_PROVIDER = gemini
AI_MODEL = gemini-2.5-flash
NODE_ENV = production
```

### 4. Deploy!

Click **"Create Web Service"** and wait 2-5 minutes.

## 📍 Your Cloud Endpoint

After deployment, you'll get a URL like:
```
https://bobs-proposal-agent.onrender.com
```

**API Endpoint:**
```
POST https://bobs-proposal-agent.onrender.com/api/proposals/generate
```

## 🧪 Test It

```bash
curl -X POST https://bobs-proposal-agent.onrender.com/api/proposals/generate \
  -H "Content-Type: application/json" \
  -d '{
    "sequence_number": 1001,
    "conversationNotes": "Hi, my name is John Doe. I need a 20ft shipping container with windows and AC."
  }'
```

## 📝 Payload Format

```json
{
  "sequence_number": 1001,
  "conversationNotes": "Your conversation text here..."
}
```

## ⚠️ Important Notes

- **Free tier spins down after 15 min inactivity** - first request may be slow
- **Never commit `.env`** - it's already in `.gitignore`
- **Set API keys in Render dashboard**, not in code

## 🆘 Need Help?

See `DEPLOYMENT.md` for detailed instructions and troubleshooting.
