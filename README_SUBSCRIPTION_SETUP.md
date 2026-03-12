# Subscription Setup (Netlify + Supabase + Razorpay)

## 1. Install dependencies

```bash
npm install
```

## 2. Create Supabase project

1. Open Supabase SQL Editor.
2. Run `database/supabase_schema.sql`.
3. In Authentication settings, disable email confirmation for quick testing (optional).

## 3. Add environment variables in Netlify

Set these in Netlify Site settings > Environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SUBSCRIPTION_AMOUNT_INR` (example: `1499`)
- `FREE_MODULE_COUNT` (example: `2`)

Your current Supabase project URL is:

- `https://zukqkdttjsfcnrrmwpoy.supabase.co`

Use the same values from your local `.env` when adding Netlify env vars.

## 4. Run locally

```bash
netlify dev
```

Open the local URL shown by Netlify CLI.

### Local test without Netlify (direct Supabase mode)

You can run frontend + Supabase auth/progress without Netlify functions:

```bash
python -m http.server 5500
```

Open:

`http://localhost:5500/sql_mastery_pro%20(1).html`

Notes for direct mode:
- Login/Register works with Supabase Auth.
- Progress save/load works with `user_progress` table.
- Admin user management requires backend server mode (`netlify dev`).
- Razorpay order/verification requires backend server mode (`netlify dev`).

## 5. Deploy

1. Push this project to GitHub.
2. Import repository in Netlify.
3. Set build command: none (or `npm run build`), publish directory: `.`.
4. Add the same environment variables in Netlify.

## 5B. Deploy on Vercel (alternative)

This project now includes `api/*.js` Vercel handlers that reuse existing backend logic.

1. Push this project to GitHub.
2. Import repository in Vercel.
3. Framework preset: `Other`.
4. Build command: leave empty (or `npm run build`).
5. Output directory: leave empty (root static files).
6. Add the same environment variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `SUBSCRIPTION_AMOUNT_INR`
   - `FREE_MODULE_COUNT`
7. Redeploy after env vars are saved.

## 6. Razorpay payment methods

Razorpay Checkout automatically supports UPI, cards, netbanking, and wallets when enabled in your Razorpay account.

## 7. Important production note

Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `RAZORPAY_KEY_SECRET` in frontend files.
If a secret key was shared in chat/screenshots, rotate it in Supabase immediately and update env vars.
