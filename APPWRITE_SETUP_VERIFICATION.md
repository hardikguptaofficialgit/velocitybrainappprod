# Appwrite Setup Verification Checklist

## Your Appwrite Project Details
- **Project Name:** VelocityBrain
- **Project ID:** `69e7d0a0002573ec6840`
- **Endpoint:** `https://fra.cloud.appwrite.io/v1`

## Setup Status

### Backend Configuration
| Component | Status | Details |
|-----------|--------|---------|
| Endpoint configured | **YES** | `https://fra.cloud.appwrite.io/v1` |
| Project ID configured | **YES** | `69e7d0a0002573ec6840` |
| API Key | **NEEDS ACTION** | Must create in Appwrite Console |
| Database ID | **YES** | `velocitybrain` |

### Dashboard Configuration
| Component | Status | Details |
|-----------|--------|---------|
| Appwrite web SDK installed | **YES** | `appwrite` package installed |
| Client configured | **YES** | Endpoint + Project ID set |
| Ping component | **YES** | Auto-verifies connection on load |
| Ping integrated | **YES** | Shows on Dashboard page |

---

## What You MUST Do Now

### 1. Create Appwrite API Key (CRITICAL)

The backend needs an API key to manage databases and documents. Here's how to create it:

1. Go to **Appwrite Console** > Your Project (VelocityBrain)
2. Click **Overview** in the left sidebar
3. Scroll to **API Keys** section
4. Click **Create API Key**
5. Name it: `VelocityBrain Backend`
6. Set expiration: **Never** (or your preference)
7. Enable these **Scopes** (check all of these):
   - `databases.read`
   - `databases.write`
   - `collections.read`
   - `collections.write`
   - `documents.read`
   - `documents.write`
   - `users.read`
   - `users.write`
8. Click **Create**
9. Copy the API key (it looks like: `standard_xxxxxxxxxx...`)
10. Paste it into `backend/.env`:
    ```
    APPWRITE_API_KEY=standard_your_actual_key_here
    ```

### 2. Start the Backend Server

```bash
cd backend
npm install  # if not done
npm start
```

Server will run on **http://localhost:3001**

### 3. Start the Dashboard

```bash
cd dashboard
npm install  # already done
npm start
```

Dashboard will run on **http://localhost:3000**

### 4. Verify Appwrite Connection

When you open the Dashboard at http://localhost:3000, you will see:
- An **Appwrite Connection** card at the top
- It will automatically ping Appwrite
- Green checkmark = Connection successful
- Red X = Check troubleshooting below

---

## Files That Were Updated

1. **`backend/config/appwrite.js`**
   - Updated endpoint to `https://fra.cloud.appwrite.io/v1`
   - Updated project ID to `69e7d0a0002573ec6840`
   - Added hardcoded fallbacks for safety

2. **`backend/.env`**
   - Added your endpoint and project ID
   - Added instructions for API key creation

3. **`dashboard/src/lib/appwrite.js`** (NEW)
   - Appwrite web SDK client configuration
   - `pingAppwrite()` function for verification
   - Exports: `client`, `account`, `databases`

4. **`dashboard/src/components/AppwritePing.js`** (NEW)
   - Visual ping status component
   - Shows connection state with icons
   - Auto-pings on mount + manual retry button
   - Troubleshooting tips if connection fails

5. **`dashboard/src/pages/Dashboard.js`**
   - Imported `AppwritePing` component
   - Added `<AppwritePing />` to page layout
   - Displays at top of dashboard automatically

---

## Troubleshooting

### "Appwrite ping failed"

1. **Check endpoint URL**
   - Your endpoint: `https://fra.cloud.appwrite.io/v1`
   - Make sure this matches what's in Appwrite Console

2. **Check Project ID**
   - Your project ID: `69e7d0a0002573ec6840`
   - Verify in Appwrite Console > Settings

3. **Network issues**
   - Can you access `https://fra.cloud.appwrite.io/v1` in browser?
   - Check firewall/VPN settings

4. **Backend API Key issues**
   - If backend fails but dashboard ping works, your API key is wrong/missing
   - Make sure API key has correct scopes (see step 1 above)
   - API key format: `standard_xxxxxxxxxxxxxxxx`

### "Database initialization failed"

1. Check that `APPWRITE_API_KEY` is set in `backend/.env`
2. Verify the API key has `databases.write` scope
3. Restart backend after updating .env

### Dashboard won't start

```bash
cd dashboard
rm -rf node_modules package-lock.json
npm install
npm start
```

---

## Quick Verification Commands

Test backend health:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"healthy","timestamp":"2024-..."}
```

Test Appwrite from backend:
```bash
curl http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

---

## Architecture Overview

```
Dashboard (React + Appwrite Web SDK)
    |
    |---> Appwrite Cloud (fra.cloud.appwrite.io)
    |       - Users database
    |       - API keys collection
    |       - Usage logs
    |
    |---> Backend API (Node.js + node-appwrite)
            |
            |---> Appwrite Cloud (same database)
            |---> Core API (Python/FastAPI)
```

**Note:** Both Dashboard and Backend connect to the same Appwrite project.

- Dashboard uses **Appwrite Web SDK** (frontend, no API key needed)
- Backend uses **node-appwrite** (server-side, requires API key)

---

## Next Steps After Verification

1. Register first user via Dashboard
2. Create API key in Dashboard
3. Test with Python SDK using the API key
4. Publish open-source SDK to PyPI
5. Deploy to production

## Support

If ping fails after following all steps:
1. Check browser console (F12) for errors
2. Check backend terminal for error messages
3. Verify Appwrite Console shows no service issues
4. Check that your project is in the Frankfurt (fra) region
