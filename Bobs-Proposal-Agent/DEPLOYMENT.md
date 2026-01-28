# Deployment Guide for Render

This guide will help you deploy Bob's Proposal Agent to Render and get a cloud-accessible endpoint.

## Prerequisites

1. A GitHub account (or GitLab/Bitbucket)
2. A Render account (sign up at https://render.com)
3. Your Gemini API key (from `.env` file)

## Step 1: Push Code to GitHub

### 1.1 Initialize Git Repository (if not already done)
```bash
cd Bobs-Proposal-Agent
git init
git add .
git commit -m "Initial commit - Ready for Render deployment"
```

### 1.2 Create GitHub Repository
1. Go to https://github.com/new
2. Create a new repository (e.g., `bobs-proposal-agent`)
3. **DO NOT** initialize with README, .gitignore, or license

### 1.3 Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/bobs-proposal-agent.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Render

### 2.1 Create New Web Service
1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select your repository: `bobs-proposal-agent`

### 2.2 Configure Build Settings
Render will auto-detect these settings from `render.yaml`:
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment:** `Node`

### 2.3 Set Environment Variables
In the Render dashboard, go to **Environment** section and add:

**Required:**
- `AI_API_KEY` = `your-gemini-api-key-here` (your Gemini API key)
- `AI_PROVIDER` = `gemini`
- `AI_MODEL` = `gemini-2.5-flash`
- `NODE_ENV` = `production`
- `PORT` = `10000` (Render sets this automatically, but good to have)

**Optional (if using database):**
- `DATABASE_URL` = Your PostgreSQL connection string (if you add a PostgreSQL database)

### 2.4 Deploy
1. Click **"Create Web Service"**
2. Render will build and deploy your application
3. Wait for deployment to complete (usually 2-5 minutes)

## Step 3: Get Your Cloud Endpoint

Once deployed, Render will provide you with a URL like:
```
https://bobs-proposal-agent.onrender.com
```

Your API endpoint will be:
```
https://bobs-proposal-agent.onrender.com/api/proposals/generate
```

## Step 4: Test Your Deployment

Test the endpoint with curl:

```bash
curl -X POST https://bobs-proposal-agent.onrender.com/api/proposals/generate \
  -H "Content-Type: application/json" \
  -d '{
    "sequence_number": 1001,
    "conversationNotes": "Hi, my name is John Doe. I need a 20ft shipping container with windows and AC installed."
  }'
```

Or use any HTTP client (Postman, Insomnia, etc.)

## Important Notes

1. **Free Tier Limitations:**
   - Render free tier spins down after 15 minutes of inactivity
   - First request after spin-down may take 30-60 seconds
   - Consider upgrading to paid plan for always-on service

2. **Environment Variables:**
   - Never commit `.env` file to git (it's in `.gitignore`)
   - Always set sensitive keys in Render dashboard

3. **Database:**
   - If you need a database, add a PostgreSQL service in Render
   - Use the connection string as `DATABASE_URL`

4. **Monitoring:**
   - Check Render logs for any issues
   - Monitor API usage and costs

## Troubleshooting

### Build Fails
- Check Render build logs
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### API Returns Errors
- Check environment variables are set correctly
- Verify Gemini API key is valid
- Check Render service logs

### Slow Response Times
- First request after spin-down is slow (free tier)
- Consider upgrading to paid plan for better performance

## Next Steps

After deployment:
1. Test all endpoints
2. Set up monitoring/alerts
3. Configure custom domain (optional)
4. Set up CI/CD for automatic deployments
