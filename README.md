# AI Background Remover

This repo is now structured for a `Render`-hosted FastAPI backend and a separate static frontend.

## Architecture

- `backend/`: FastAPI + `rembg` inference service
- `frontend/`: Vite + React static frontend
- `render.yaml`: Render Blueprint for the backend web service
- `vercel.json`: static frontend deployment config for Vercel

## Backend on Render Free

1. Create a new Render Blueprint from this repository, or create a web service manually from `backend/`.
2. Render will use [render.yaml](render.yaml) for:
   - `pip install -r requirements.txt`
   - `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - free plan defaults tuned for lighter inference
3. Set `CORS_ALLOW_ORIGINS` to your frontend URL. For local dev, include `http://localhost:3000`.
4. After deploy, copy the public Render URL. You will use it in the frontend as `VITE_API_BASE_URL`.

Recommended backend defaults live in [backend/.env.example](backend/.env.example).

## Frontend Deployment

### Vercel

1. Import the repo in Vercel.
2. Add `VITE_API_BASE_URL=https://your-render-service.onrender.com`.
3. Optional: add `VITE_MAX_UPLOAD_SIZE_MB=10` if you change the backend limit.
4. Deploy from the repo root. [vercel.json](vercel.json) builds the static frontend and rewrites routes to `index.html`.

### Render Static Site

If you prefer to keep everything on Render:

1. Create a new Static Site from `frontend/`.
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. Add the same frontend env vars from [frontend/.env.example](frontend/.env.example)

## Local Development

Backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend keeps the local Vite proxy for `/remove-background`, so local development still works without setting `VITE_API_BASE_URL`.

## Free Tier Behavior

- Render Free will spin the backend down after inactivity.
- The frontend now preloads `/config` on page load to help wake the backend earlier.
- The first background-removal request after idle can still take around `30-60 seconds`.
