# OAuth Configuration Guide for VelocityBrain

VelocityBrain uses **Appwrite Authentication** for Google and GitHub sign-in. You must configure the Appwrite Console.

## Step 1: Appwrite OAuth Providers

### 1.1 Enable providers

1. Open [Appwrite Console](https://cloud.appwrite.io) → project **VelocityBrain**
2. Go to **Auth** → **Providers**
3. Enable **Google** and **GitHub** providers
4. For each provider, add the required credentials (Client ID/Secret)

### 1.2 Configure Web Platform

Go to **Auth** → **Websites** and add your frontend URLs:

| Origin URL | Required for |
|------------||----------------|
| `http://localhost:3000` | Local dev |
| `https://velocitybrain.vercel.app` | Vercel production |
| `https://velocity.linkitapp.in` | Custom production domain |

## Step 2: Google OAuth Configuration

1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Go to **APIs & Services** → **Credentials**
3. Create OAuth 2.0 Client ID (Web application)
4. Under **Authorised JavaScript origins**, add:
   - `http://localhost:3000`
   - `https://velocitybrain.vercel.app`
   - `https://velocity.linkitapp.in`
5. Under **Authorised redirect URIs**, add:
   - `https://fra.cloud.appwrite.io/v1/account/oauth2/callback/google`

## Step 3: GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. Configure:
   - **Homepage URL**: Your dashboard URL
   - **Authorization callback URL**: `https://fra.cloud.appwrite.io/v1/account/oauth2/callback/github`
3. Copy Client ID and Secret into Appwrite → Google provider settings

## Step 4: Vercel Environment Variables

In the Vercel project for the dashboard, set:

- `REACT_APP_API_URL` = your backend URL (e.g. `https://velocity.linkitapp.in`)
- `REACT_APP_APPWRITE_ENDPOINT` = `https://fra.cloud.appwrite.io/v1`
- `REACT_APP_APPWRITE_PROJECT_ID` = your Appwrite project ID

## Step 5: Backend Appwrite Configuration

The Node backend uses the Appwrite API key to verify sessions. Ensure production has:

- `APPWRITE_ENDPOINT` = `https://fra.cloud.appwrite.io/v1`
- `APPWRITE_PROJECT_ID` = your Appwrite project ID
- `APPWRITE_API_KEY` = backend server API key
- `APPWRITE_DATABASE_ID` = your database ID

## Troubleshooting

### "OAuth sign-in could not be completed" error

**Symptom**: After OAuth redirect, you land on `/login` with an error.

**Most common cause**: The domain is **not** listed as a Web platform in Appwrite Console.

**Check**:
1. Appwrite project has OAuth providers enabled
2. Your domain is in Appwrite **Websites** configuration
3. The `REACT_APP_APPWRITE_*` environment variables are correct
4. Backend `APPWRITE_API_KEY` is valid and has database permissions

### OAuth sign-in succeeds but session is not established

**Symptom**: OAuth returns but you're redirected back to login.

**Check backend logs** for `/api/auth/me` errors and verify:
1. `CORS_ORIGINS` includes your frontend URL
2. `APPWRITE_API_KEY` has proper permissions (users.read, databases.read)
3. Database collections exist (users, workspaces, user_settings)