// Server-only helpers for Google Calendar per-user OAuth + API calls.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export function getRedirectUri(origin: string) {
  return `${origin}/api/public/google-calendar/callback`;
}

export function buildAuthUrl(origin: string, state: string) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CALENDAR_CLIENT_ID não configurado");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(origin),
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, origin: string) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange falhou: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Refresh falhou: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number; scope: string }>;
}

export async function getValidAccessToken(userId: string): Promise<{ token: string; row: any } | null> {
  const { data, error } = await supabaseAdmin
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  // Refresh if expiring within 60s
  if (expiresAt - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(data.refresh_token);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabaseAdmin
      .from("google_calendar_tokens")
      .update({ access_token: refreshed.access_token, expires_at: newExpiry })
      .eq("user_id", userId);
    return { token: refreshed.access_token, row: { ...data, access_token: refreshed.access_token, expires_at: newExpiry } };
  }
  return { token: data.access_token, row: data };
}

// ---------- Calendar API ----------
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

async function calFetch(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${CAL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Calendar API ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function recurrenceRule(cycle: "monthly" | "yearly") {
  return cycle === "yearly" ? "RRULE:FREQ=YEARLY" : "RRULE:FREQ=MONTHLY";
}

export interface SubLite {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  next_billing_date: string;
  status: string;
}

export async function upsertRenewalEvent(token: string, calendarId: string, sub: SubLite) {
  const start = sub.next_billing_date;
  const endDate = new Date(start);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return calFetch(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: `${sub.name} — ${sub.amount.toFixed(2)} ${sub.currency}`,
      description: `Renovação automática da subscrição ${sub.name} (Trackify).`,
      start: { date: start },
      end: { date: isoDate(endDate) },
      recurrence: [recurrenceRule(sub.billing_cycle)],
      reminders: { useDefault: true },
    }),
  });
}

export async function upsertReminderEvent(
  token: string,
  calendarId: string,
  sub: SubLite,
  daysBefore: number,
) {
  const date = new Date(sub.next_billing_date);
  date.setUTCDate(date.getUTCDate() - daysBefore);
  const start = isoDate(date);
  const endDate = new Date(date);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return calFetch(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: `🔔 ${sub.name} renova em ${daysBefore}d (${sub.amount.toFixed(2)} ${sub.currency})`,
      description: `Lembrete: a subscrição ${sub.name} renova daqui a ${daysBefore} dia(s).`,
      start: { date: start },
      end: { date: isoDate(endDate) },
      recurrence: [recurrenceRule(sub.billing_cycle)],
    }),
  });
}

export async function upsertMonthlySummaryEvent(
  token: string,
  calendarId: string,
  monthlyTotal: number,
  currency: string,
) {
  const now = new Date();
  const firstNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 9, 0, 0));
  const end = new Date(firstNextMonth.getTime() + 30 * 60_000);
  return calFetch(token, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: `📊 Resumo mensal Trackify — ${monthlyTotal.toFixed(2)} ${currency}`,
      description: `Total estimado de subscrições ativas: ${monthlyTotal.toFixed(2)} ${currency}.`,
      start: { dateTime: firstNextMonth.toISOString() },
      end: { dateTime: end.toISOString() },
      recurrence: ["RRULE:FREQ=MONTHLY;BYMONTHDAY=1"],
    }),
  });
}

export async function deleteEvent(token: string, calendarId: string, eventId: string) {
  try {
    await calFetch(token, `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: "DELETE",
    });
  } catch (e) {
    // Ignore 404/410 — event already gone
  }
}
