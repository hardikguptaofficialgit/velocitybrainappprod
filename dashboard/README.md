# Velocity Brain Dashboard

Standalone frontend for Velocity Brain.

## Local development

1. Copy `.env.example` to `.env`
2. Install dependencies
3. Start the app

```bash
npm install
npm start
```

The local dev server uses `REACT_APP_API_URL` when it is set (default local stack: `http://localhost:5004`, matching `backend/.env` `PORT`). The `package.json` `proxy` should use the same port for relative `/api` calls.

## Vercel deployment

Set these project environment variables in Vercel:

- `REACT_APP_API_URL`
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID`

Recommended production API URL for the current setup:

```text
https://velocity.linkitapp.in
```

Recommended Vercel settings:

- Framework preset: `Create React App`
- Build command: `npm run build`
- Output directory: `build`

## Notes

- Do not commit `.env`
- `build/` and `node_modules/` are intentionally ignored
- Firebase frontend config is public client config; backend admin credentials do not belong in this repo
