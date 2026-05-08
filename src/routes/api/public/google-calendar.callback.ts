import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exchangeCodeForTokens } from "@/lib/google-calendar.server";

export const Route = createFileRoute("/api/public/google-calendar/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const origin = `${url.protocol}//${url.host}`;

        if (error) {
          return Response.redirect(`${origin}/settings?gcal=error&reason=${encodeURIComponent(error)}`, 302);
        }
        if (!code || !state) {
          return Response.redirect(`${origin}/settings?gcal=error&reason=missing_params`, 302);
        }

        let userId: string;
        try {
          const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
          if (!decoded.uid || typeof decoded.uid !== "string") throw new Error("bad state");
          if (Date.now() - decoded.ts > 10 * 60_000) throw new Error("state expired");
          userId = decoded.uid;
        } catch {
          return Response.redirect(`${origin}/settings?gcal=error&reason=invalid_state`, 302);
        }

        try {
          const tokens = await exchangeCodeForTokens(code, origin);
          if (!tokens.refresh_token) {
            return Response.redirect(
              `${origin}/settings?gcal=error&reason=no_refresh_token`,
              302,
            );
          }
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          await supabaseAdmin.from("google_calendar_tokens").upsert(
            {
              user_id: userId,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: expiresAt,
              scope: tokens.scope,
            },
            { onConflict: "user_id" },
          );
          return Response.redirect(`${origin}/settings?gcal=connected`, 302);
        } catch (e: any) {
          return Response.redirect(
            `${origin}/settings?gcal=error&reason=${encodeURIComponent(e.message ?? "exchange_failed")}`,
            302,
          );
        }
      },
    },
  },
});
