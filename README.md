# FitApp - Backend

Express 5 + Mongoose + Gemini (@google/genai). Ver endpoints en el código de `routes/`.

## Codespaces
1. Code → Codespaces → Create (instala dependencias solo).
2. `cp .env.example .env` y completá MONGODB_URI, JWT_SECRET, GEMINI_API_KEY.
   `CORS_ORIGIN` = URL del front (puerto 5173 del codespace del front), sin barra final.
3. `npm run dev`
4. Pestaña Ports → puerto 3000 → clic derecho → Port Visibility → **Public**.

## Vercel
Root del repo. Variables: MONGODB_URI, JWT_SECRET, GEMINI_API_KEY, GEMINI_MODEL, CORS_ORIGIN (URL del front en Vercel), REDIS_URL (opcional).
