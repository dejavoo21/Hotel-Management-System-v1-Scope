# In-App Voice Calling (Twilio)

This project supports browser-based support calls from the **Messages** page.

## Required Twilio setup

1. Buy/verify a Twilio voice-capable phone number.
2. Create a Twilio API Key (`SK...`) for Voice SDK.
3. Create a TwiML App (`AP...`):
   - Voice Request URL: `https://<your-api-domain>/api/messages/support/voice/twiml`
   - Method: `POST`
4. Set environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_VOICE_API_KEY_SID`
   - `TWILIO_VOICE_API_KEY_SECRET`
   - `TWILIO_VOICE_TWIML_APP_SID`
   - `TWILIO_VOICE_FROM_PHONE`

## Runtime behavior

- In `Messages -> Call Console`:
  - `Call in app` starts a WebRTC call through Twilio Voice SDK.
  - `Call` is fallback and opens native dialer.
  - `Start` and `Complete` manage call queue status and notes.

## Notes

- Twilio billing applies for voice minutes.
- Browser permission for microphone is required.
- Use HTTPS in production for WebRTC.
