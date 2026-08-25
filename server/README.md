# Server README

This server is a minimal Node/Express example showing how to accept push subscriptions and send pushes using web-push.

Setup

1. Generate VAPID keys (recommended):

```
npx web-push generate-vapid-keys --json
```

This prints a JSON with public/private keys.

2. Create `server/.env` with:

VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

3. Install dependencies and run:

cd server
npm install
npm start

Endpoints

- POST /subscribe
  - body: { subscription }
  - stores subscription in memory (for demo)

- POST /send
  - body: { endpoint?, payload? }
  - if endpoint provided, sends to that subscription, otherwise broadcasts to all

- GET /vapidPublicKey
  - returns { publicKey }

Notes

- This server stores subscriptions in memory; for production persist them in a DB.
- You must set VAPID keys and use HTTPS in production. Localhost (http://localhost) can be used for testing in many browsers.
