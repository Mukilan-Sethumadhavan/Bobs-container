# Render Dashboard Settings - Exact Configuration

## Option 1: With Root Directory (Recommended)

### Settings:
1. **Root Directory:** `Bobs-Proposal-Agent`
2. **Build Command:** `npm install && npm run build` (just this, no prefix!)
3. **Start Command:** `npm start` (just this, no prefix!)

**Note:** Even though Render shows `Bobs-Proposal-Agent/ $` as a prefix in the UI, you should still be able to edit the command. The prefix is just visual - make sure your actual command is `npm install && npm run build` without any directory path.

---

## Option 2: Without Root Directory (Alternative)

If you can't edit the commands with Root Directory set, try this:

### Settings:
1. **Root Directory:** (leave EMPTY/blank)
2. **Build Command:** `cd Bobs-Proposal-Agent && npm install && npm run build`
3. **Start Command:** `cd Bobs-Proposal-Agent && npm start`

---

## How to Edit Commands in Render:

1. Go to Settings → Build & Deploy
2. Click the **"Edit"** button (pencil icon) next to Build Command
3. In the popup/modal, you should see a text field
4. Type: `npm install && npm run build` (without any prefix)
5. Click Save
6. Repeat for Start Command: `npm start`

---

## Environment Variables (Required):

Go to **Environment** section and add:

```
AI_API_KEY = your-gemini-api-key-here
AI_PROVIDER = gemini
AI_MODEL = gemini-2.5-flash
NODE_ENV = production
```

---

## If Commands Are Still Not Editable:

1. Try clearing the Root Directory first
2. Set the commands with explicit `cd` paths
3. Save
4. Then try setting Root Directory again
