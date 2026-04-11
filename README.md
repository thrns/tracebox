# tracebox

tracebox is a Next.js control plane for running batches of browser-based
voice-agent tests. A workspace stores a target URL, instructions, model
provider, bot count, and session limit in Supabase.

## Local development

Install dependencies with:

    npm ci
    npx playwright install chromium

Create a local .env with the Supabase URL and keys plus the provider keys
used by the agent. Apply the SQL files in supabase/migrations/ in order.

Run the application and worker together with:

    npm run dev:all

The authenticated dashboard creates workspaces. Starting a run creates queued
bot rows and the worker opens an isolated Stagehand/Chromium session for each
bot. The agent setup phase follows the supplied browser instructions, then
captures remote WebRTC audio, sends it to Deepgram, asks OpenAI or Gemini for
the next action, and speaks through the active page with ElevenLabs.

## Project shape

- src/app contains the App Router pages and authenticated route handlers.
- src/lib/langgraph contains the graph state and execution nodes.
- src/lib/stagehand contains Chromium and WebRTC integration.
- src/lib/recording contains audio, screencast, and FFmpeg helpers.
- worker contains the local HTTP worker used by the run route.
- supabase/migrations contains the database, Storage, and RLS changes.

The browser and worker use the service-role Supabase client only on the
server. The browser UI uses the anonymous client and authenticated cookies.
The current local verification command is npm run build; it requires access
to the Google Fonts requested by the root layout.
