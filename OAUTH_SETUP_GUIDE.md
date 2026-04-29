# OAuth Configuration Guide for VelocityBrain

This guide explains how to configure OAuth providers (Google and GitHub) for VelocityBrain authentication.

## Prerequisites

- Appwrite Console access (https://cloud.appwrite.io/console)
- Project ID: `69e7d0a0002573ec6840`
- Appwrite Endpoint: `https://fra.cloud.appwrite.io/v1`

## Step 1: Configure Google OAuth

### 1.1 Create Google OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Select **Web application** as the application type
6. Configure:
   - **Name**: `VelocityBrain`
   - **Authorised JavaScript origins**:
     - `http://localhost:3000` (for local development)
     - `https://velocitybrain.vercel.app` (for production)
   - **Authorised redirect URIs**:
     - `https://fra.cloud.appwrite.io/v1/account/sessions/oauth2/callback/google/69e7d0a0002573ec6840`
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**

### 1.2 Configure in Appwrite Console

1. Go to [Appwrite Console](https://cloud.appwrite.io/console)
2. Select the **VelocityBrain** project
3. Navigate to **Auth** > **Providers** > **Google**
4. Toggle **Enabled** to ON
5. Enter the **App ID** (Client ID from Google Cloud Console)
6. Enter the **App Secret** (Client Secret from Google Cloud Console)
7. Click **Update**

## Step 2: Configure GitHub OAuth

### 2.1 Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** > **New OAuth App**
3. Configure:
   - **Application name**: `VelocityBrain`
   - **Homepage URL**: `http://localhost:3000` (local) or `https://velocitybrain.vercel.app` (production)
   - **Application description**: `VelocityBrain Dashboard`
   - **Authorization callback URL**: `https://fra.cloud.appwrite.io/v1/account/sessions/oauth2/callback/github/69e7d0a0002573ec6840`
4. Click **Register application**
5. Copy the **Client ID** and generate a **Client Secret**

### 2.2 Configure in Appwrite Console

1. Go to [Appwrite Console](https://cloud.appwrite.io/console)
2. Select the **VelocityBrain** project
3. Navigate to **Auth** > **Providers** > **GitHub**
4. Toggle **Enabled** to ON
5. Enter the **Client ID** from GitHub OAuth App
6. Enter the **Client Secret** from GitHub OAuth App
7. Click **Update**

## Step 3: Test OAuth Flow

1. Start the dashboard: `cd dashboard && npm start`
2. Navigate to `http://localhost:3000/login`
3. Click **"Continue with Google"** or **"Continue with GitHub"**
4. Complete the OAuth flow in the provider's popup
5. You should be redirected to `/dashboard` after successful authentication

## Troubleshooting

### OAuth Session Not Created (401 Error)

**Symptom**: After OAuth redirect, you see "User (role: guests) missing scopes" error.

**Causes**:
1. Callback URL mismatch between provider and Appwrite
2. OAuth provider not enabled in Appwrite Console
3. Incorrect Client ID/Secret
4. Missing authorized origins/redirect URIs in provider settings

**Solutions**:
1. Verify the callback URL in Appwrite Console matches exactly what's configured in the OAuth provider
2. Ensure the OAuth provider is enabled in Appwrite Console
3. Double-check Client ID and Secret are correct
4. Add `http://localhost:3000` to authorized origins in both Google Cloud Console and GitHub OAuth App

### Local Development Issues

**Issue**: OAuth works in production but not locally.

**Solution**: Make sure to add `http://localhost:3000` to:
- Google Cloud Console: Authorised JavaScript origins
- GitHub OAuth App: Homepage URL
- Both providers: Authorised redirect URIs (if needed)

## Current Implementation

The frontend uses Appwrite's native OAuth flow:

```javascript
// AuthContext.js
account.createOAuth2Session({
  provider: OAuthProvider.Google,
  success: `${window.location.origin}/dashboard`,
  failure: `${window.location.origin}/login?error=google_failed`
});
```

After successful OAuth:
1. Appwrite creates the session
2. Appwrite redirects to `/dashboard`
3. AuthContext detects the session
4. AuthContext syncs with backend via `/api/auth/appwrite-session`
5. Backend generates JWT token for API calls

## Email/Password Authentication

Email/password authentication uses Appwrite's native methods:

```javascript
// Login
await account.createEmailPasswordSession(email, password);

// Register
await account.create(ID.unique(), email, password, name);
```

This doesn't require any additional OAuth configuration.
