# Evidence Vault - Render Deployment Guide

## Prerequisites
- GitHub account with your repo
- Render account (https://render.com)
- Gemini API key

## Step-by-Step Deployment

### 1. Prepare Your Repository
```bash
# Make sure all changes are committed
git status
git add .
git commit -m "Deploy configuration for Render"
git push origin main
```

### 2. Create Render Account & Connect GitHub
1. Go to https://render.com and sign up
2. Click "New" → "Web Service"
3. Select "Build and deploy from a Git repository"
4. Connect your GitHub account and authorize Render

### 3. Deploy from render.yaml
1. After authorizing GitHub, click "Create Web Service"
2. Select repository: `AbdurRobMridha/Evidence-Vault`
3. Leave the default settings (it will auto-detect render.yaml)
4. Click "Create Web Service"

### 4. Configure Environment Variables
In the Render dashboard for your service:

1. Go to **Environment** tab
2. Add the following variables:
   - `GEMINI_API_KEY`: Your API key from https://ai.google.dev
   - `APP_URL`: Your Render app URL (will be something like `https://evidence-vault-xxxx.onrender.com`)

### 5. Build and Deploy
- Render will automatically start building
- Monitor the deployment in the "Logs" tab
- Once successful (green light), your app is live!

## Accessing Your App
Your app will be available at: `https://evidence-vault-xxxx.onrender.com`

## Database
- SQLite database persists on the disk storage
- All uploaded files go to the `uploads/` directory
- Data is retained between deployments

## First-Time Issues

### Build fails with "npm: not found"
- Render auto-detects Node.js from package.json
- Make sure your repo is at the root level

### Port already in use
- Render assigns ports automatically
- PORT env var is set to 3000 in render.yaml

### App crashes on startup
- Check logs: `Logs` tab in Render dashboard
- Verify GEMINI_API_KEY is set
- Verify APP_URL matches your Render URL

## Rebuilding & Redeploying
To redeploy after code changes:
```bash
git commit -m "Fix: update feature"
git push origin main
```
Render will auto-redeploy on push to main branch.

## Troubleshooting

### Clear database and restart
```bash
# SSH into the service (via Render dashboard)
rm -rf data/vault.db
```

### View real-time logs
- Open Render dashboard → Logs tab
- Shows live server output

### Manual redeploy
- Dashboard → "Manual Deploy" → "Latest" → Deploy

## Next Steps
- Set up custom domain: Settings → Custom Domain
- Enable HTTPS (automatic with Render)
- Monitor usage in Render dashboard

---
Need help? Check Render docs: https://render.com/docs
