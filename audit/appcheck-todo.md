# App Check — TODO

Status: not working in current configuration

## What's done

- `initializeAppCheck()` is present in `src/lib/firebase.js` with guard on `siteKey`.
- `_appCheckHeader()` in `src/firestore-rest.js` adds `X-Firebase-AppCheck` header to all 7 fetch calls.
- Graceful degradation: if `getToken()` fails, header is not added but request still goes through.
- reCAPTCHA v3 site key configured: `VITE_RECAPTCHA_SITE_KEY`.
- reCAPTCHA secret key configured in Firebase Console → App Check → reCAPTCHA v3 provider.

## Symptoms when blocked

- `siteKey` is correctly loaded into the code (verified via `console.log`).
- `initializeAppCheck()` is called (no errors thrown).
- But no request to `content-firebaseappcheck.googleapis.com` is ever made.
- Therefore `X-Firebase-AppCheck` header never appears in Firestore requests.

## Hypothesis

- Possible conflict with custom REST wrapper (`firestore-rest.js`) instead of standard Firebase Firestore SDK.
- `initializeAppCheck` may be silently failing inside its internal try/catch.
- Throttle from previous failed attempts may still be active.

## Next steps when revisiting

- Either migrate `firestore-rest.js` → standard Firebase SDK (large task, ~2 days).
- Or contact Firebase Support with reproduction steps.
- Or wait several days/week for any throttle to fully reset and try again.

## Priority

Low. App Check is optional protection. All other security layers (Auth, Rules, `api/` Bearer tokens, Zoom signature, CORS) are operational.
