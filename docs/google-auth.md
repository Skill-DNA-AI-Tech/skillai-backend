# Google sign-in setup

Google sign-in uses Google Identity Services in the frontend and official `google-auth` ID-token verification in FastAPI. The browser sends only the short-lived Google ID token; the backend verifies its signature, issuer, expiry, audience, and `email_verified` claim before creating or retrieving a student account.

Set `GOOGLE_CLIENT_ID` in the backend environment and `VITE_GOOGLE_CLIENT_ID` in the frontend environment to the same Google **Web application** client ID. Do not put a client secret in the frontend. Configure the Google Cloud OAuth client with the deployed frontend origin under **Authorized JavaScript origins**. The GIS popup/callback is handled by the Google Identity Services script, so no OAuth client secret or browser-trusted email is required.

The backend endpoint is `POST /api/auth/google` with `{ "id_token": "<google-id-token>" }`. It returns the same access and refresh token response used by password login. Existing password accounts are linked by verified email and new Google users are created as verified students. Administrator records and elevated roles are rejected with `403`; Google sign-in never grants Admin access.

If either client ID is absent, the UI shows an explicit configuration error and the backend returns `503 Google sign-in is not configured on this server.` Invalid, expired, cancelled, or provider-error flows fail without creating a session.
