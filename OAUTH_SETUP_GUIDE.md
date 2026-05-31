# OAuth Configuration Guide for VelocityBrain

VelocityBrain uses **Firebase Authentication** for Google and GitHub sign-in. You must configure both **Firebase Console** and **Google Cloud Console** (for Google).

Project: `velocitybrainapp`

## Step 1: Firebase Authentication

### 1.1 Enable providers

1. Open [Firebase Console](https://console.firebase.google.com) → project **velocitybrainapp**
2. Go to **Build** → **Authentication** → **Sign-in method**
3. Enable **Google** and **GitHub**
4. For GitHub, enter the OAuth App Client ID and Secret (see Step 3)

### 1.2 Authorized domains

Go to **Authentication** → **Settings** → **Authorized domains** and ensure every frontend URL is listed:

| Domain | Required for |
|--------|----------------|
| `localhost` | Local dev |
| `velocitybrainapp.firebaseapp.com` | Firebase default |
| `velocitybrainapp.web.app` | Firebase default |
| `velocitybrain.vercel.app` | Vercel production |
| `velocity.linkitapp.in` | Custom production domain |

> Adding a domain here alone is **not enough** for Google sign-in. You also need Step 2.

## Step 2: Google Cloud Console (required for Google sign-in)

Firebase creates a **Web client (auto created by Google Service)** OAuth client. You must add your app URLs there.

1. Open [Google Cloud Console](https://console.cloud.google.com) → project **velocitybrainapp**
2. Go to **APIs & Services** → **Credentials**
3. Open **Web client (auto created by Google Service)**
4. Under **Authorised JavaScript origins**, add:
   - `http://localhost`
   - `http://localhost:3000`
   - `https://velocitybrain.vercel.app`
   - `https://velocity.linkitapp.in`
   - `https://velocitybrainapp.firebaseapp.com`
5. Under **Authorised redirect URIs**, ensure this exists:
   - `https://velocitybrainapp.firebaseapp.com/__/auth/handler`
6. Save

If `https://velocitybrain.vercel.app` is missing from **JavaScript origins**, Google sign-in can return to the login page without creating a Firebase session.

## Step 3: GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. Configure:
   - **Homepage URL**: `https://velocitybrain.vercel.app`
   - **Authorization callback URL**: copy from Firebase Console → Authentication → Sign-in method → GitHub → **Authorization callback URL**
3. Copy Client ID and Secret into Firebase → GitHub provider settings

## Step 4: Vercel environment variables

Firebase config is baked in at **build time**. In the Vercel project for the dashboard, set:

- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN` = `velocitybrainapp.firebaseapp.com`
- `REACT_APP_FIREBASE_PROJECT_ID` = `velocitybrainapp`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID`
- `REACT_APP_API_URL` = your backend URL (e.g. `https://velocity.linkitapp.in`)

Redeploy after changing these values.

## Step 5: Backend Firebase Admin

The Node backend verifies Firebase ID tokens at `/api/auth/firebase-session`. Ensure production has a valid service account:

- `FIREBASE_SERVICE_ACCOUNT_PATH` or inline `FIREBASE_*` credentials in backend env

## Troubleshooting

### "OAuth sign-in returned … but no Firebase session was created"

**Symptom**: After choosing a Google account, you land back on `/login` with this error.

**Most common cause**: `https://velocitybrain.vercel.app` is in Firebase **Authorized domains** but **not** in Google Cloud **Authorised JavaScript origins** (Step 2).

**Also check**:
1. Google provider is **Enabled** in Firebase Authentication
2. Vercel has correct `REACT_APP_FIREBASE_*` vars and the app was redeployed
3. On mobile, try again after the latest deploy (popup flow is preferred over redirect)

### Backend sync errors after Google sign-in succeeds

If Firebase sign-in works but you stay on login with a server error:

1. Confirm `REACT_APP_API_URL` points to a reachable backend
2. Confirm backend Firebase Admin credentials are configured
3. Check backend logs for `/api/auth/firebase-session`

## Current implementation

```javascript
// AuthContext.js — popup first, redirect fallback
const result = await signInWithPopup(auth, googleProvider);
await axios.post('/api/auth/firebase-session', { idToken });
```

After successful OAuth:
1. Firebase creates the user session
2. Frontend sends the Firebase ID token to `/api/auth/firebase-session`
3. Backend creates/updates the user and returns a JWT
4. User is redirected to onboarding or dashboard
