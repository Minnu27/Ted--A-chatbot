# Ted — Advanced AI Wingman (Vercel-ready)

Ted is now a modern **Next.js** web app with a richer, interactive frontend and server-side AI integration.

## What's New

- ⚡ **Vercel-ready architecture** (Next.js App Router + API routes)
- 🎭 **Dynamic personas** (Bestie, Guardian, Cheerleader, Sage, Realist, Coder)
- 💬 **Interactive chat UI** with animated message cards
- 🧠 **Mood-aware UX** (basic sentiment signal badge from user text)
- 🧩 **Quick prompt chips** for faster starts
- 🔐 **Secure server-side Gemini API calls** through `/api/chat`
- 📱 **Responsive, modern UI** with glassmorphism styling

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Gemini API (via REST)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Add environment variables:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
# Optional alias supported too:
# GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_API_VERSION=v1
```

API keys are server-side only. Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in `.env.local`, then restart your Next.js server.

3. Start development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel, click **Add New Project** and import the repo.
3. Framework preset should auto-detect as **Next.js**.
4. Add environment variable in Vercel Project Settings:
   - `GEMINI_API_KEY`
5. Deploy.

## If Vercel build fails

- Confirm project uses **Node.js 18+** (this repo sets `engines.node` to `>=18.18.0`).
- Confirm `GEMINI_API_KEY` exists in Vercel **Environment Variables**.
- Optionally set `GEMINI_MODEL` if you want to switch model versions without code changes.
- If a previous failed build cached older config, redeploy using **Clear build cache and redeploy**.

## Project Structure

- `app/page.tsx` → app entry point
- `components/chat.tsx` → interactive chat client UI
- `components/chat.module.css` → advanced styling + responsiveness
- `app/api/chat/route.ts` → server route for Gemini requests
- `lib/personas.ts` → persona definitions

## Notes

- The old Streamlit prototype (`chatbot.py`) is still in the repo for reference.
- For production hardening, add rate limiting and telemetry.
- Dependency versions were updated to use a patched Next.js 14.2.x release for safer Vercel builds.
