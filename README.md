# Passkey MVP Backend (Local + ngrok)

This backend supports:
- Username/password signup/login
- Passkey registration (create passkey)
- Passkey authentication (login with passkey)

## 1) Prerequisites

- Node.js 20+
- ngrok account (free plan is enough)
- A stable HTTPS public domain for RP ID (fixed ngrok domain recommended)

## 2) Setup

```bash
cd server
npm install
cp .env.example .env
```

Update `.env`:

- `RP_ID`: your public domain only (no protocol), for example `demo-passkey.ngrok-free.app`
- `ORIGIN`: full HTTPS origin, for example `https://demo-passkey.ngrok-free.app`
- `JWT_SECRET`: random long string

## 3) Run server

```bash
npm run dev
```

Server starts on `http://localhost:4000`.

## 4) Expose with ngrok

```bash
ngrok http 4000
```

If the ngrok hostname changes, existing passkeys may stop working. Prefer a reserved/stable ngrok domain for consistent testing.

## 5) API summary

### Auth

- `POST /auth/signup`
  - body: `{ "username": "john", "password": "secret123" }`
- `POST /auth/login`
  - body: `{ "username": "john", "password": "secret123" }`
- `GET /auth/me`
  - header: `Authorization: Bearer <token>`

### Passkeys (registration)

- `POST /passkeys/register/options`
  - header: `Authorization: Bearer <token>`
  - response: `{ challengeId, options }`
- `POST /passkeys/register/verify`
  - header: `Authorization: Bearer <token>`
  - body: `{ challengeId, response }`

### Passkeys (authentication)

- `POST /passkeys/auth/options`
  - body: `{ "username": "john" }` (optional for discoverable credential flow)
  - response: `{ challengeId, options }`
- `POST /passkeys/auth/verify`
  - body: `{ challengeId, response }`

## 6) Android + RP ID requirements

For Android passkeys to work from your app (debug mode is fine):

1. Host `https://<RP_ID>/.well-known/assetlinks.json`
2. Include your Android package name + SHA256 fingerprint (debug cert fingerprint during development)
3. Ensure backend `RP_ID` and app domain association use exactly the same domain

No Play Store deployment is required for this MVP.
