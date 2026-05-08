import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  buildAuthUrl,
  getValidAccessToken,
  upsertRenewalEvent,
  upsertReminderEvent,
  upsertMonthlySummaryEvent,
  deleteEvent,
  type SubLite,
} from "./google-calendar.server";

function getOrigin(): string {
  const fromEnv = process.env.PUBLIC_APP_ORIGIN;
  if (fromEnv) return fromEnv;
  const proto = getRequestHeader("x-forwarded-proto") || "https";
  const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
  if (!host) throw new Error("Origin desconhecida");
  return `${proto}://${host}`;
}

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("calendar_id, reminder_days_before, sync_renewals, sync_reminders, sync_monthly_summary, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    return { connected: !!data, settings: data ?? null };
  });

export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Sign a short-lived state with userId
    const state = Buffer.from(
      JSON.stringify({ uid: userId, ts: Date.now() }),
    ).toString("base64url");
    const url = buildAuthUrl(getOrigin(), state);
    return { url };
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Best-effort: delete tracked events
    const tokenInfo = await getValidAccessToken(userId);
    if (tokenInfo) {
      const { data: events } = await supabaseAdmin
        .from("google_calendar_events")
        .select("google_event_id, calendar_id")
        .eq("user_id", userId);
      for (const ev of events ?? []) {
        await deleteEvent(tokenInfo.token, ev.calendar_id, ev.google_event_id);
      }
    }
    await supabaseAdmin.from("google_calendar_events").delete().eq("user_id", userId);
    await supabaseAdmin.from("google_calendar_tokens").delete().eq("user_id", userId);
    return { ok: true };
  });

export const updateGoogleCalendarSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      reminder_days_before: z.number().int().min(0).max(14),
      sync_renewals: z.boolean(),
      sync_reminders: z.boolean(),
      sync_monthly_summary: z.boolean(),
    }).parse,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("google_calendar_tokens")
      .update(data)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const tokenInfo = await getValidAccessToken(userId);
    if (!tokenInfo) throw new Error("Google Calendar não está ligado");
    const { token, row } = tokenInfo;
    const calendarId = row.calendar_id || "primary";

    // 1. Wipe previously created events
    const { data: existing } = await supabaseAdmin
      .from("google_calendar_events")
      .select("google_event_id, calendar_id")
      .eq("user_id", userId);
    for (const ev of existing ?? []) {
      await deleteEvent(token, ev.calendar_id, ev.google_event_id);
    }
    await supabaseAdmin.from("google_calendar_events").delete().eq("user_id", userId);

    // 2. Fetch active subscriptions
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("id, name, amount, currency, billing_cycle, next_billing_date, status")
      .eq("user_id", userId)
      .eq("status", "active");

    let created = 0;
    const inserts: Array<{
      user_id: string;
      subscription_id: string | null;
      event_kind: string;
      google_event_id: string;
      calendar_id: string;
    }> = [];

    for (const sub of (subs ?? []) as SubLite[]) {
      if (row.sync_renewals) {
        const ev = await upsertRenewalEvent(token, calendarId, sub);
        inserts.push({ user_id: userId, subscription_id: sub.id, event_kind: "renewal", google_event_id: ev.id, calendar_id: calendarId });
        created++;
      }
      if (row.sync_reminders && row.reminder_days_before > 0) {
        const ev = await upsertReminderEvent(token, calendarId, sub, row.reminder_days_before);
        inserts.push({ user_id: userId, subscription_id: sub.id, event_kind: "reminder", google_event_id: ev.id, calendar_id: calendarId });
        created++;
      }
    }

    if (row.sync_monthly_summary && (subs ?? []).length > 0) {
      const monthlyTotal = (subs ?? []).reduce((acc, s: any) => {
        return acc + (s.billing_cycle === "yearly" ? s.amount / 12 : s.amount);
      }, 0);
      const currency = (subs ?? [])[0]?.currency ?? "EUR";
      const ev = await upsertMonthlySummaryEvent(token, calendarId, monthlyTotal, currency);
      inserts.push({ user_id: userId, subscription_id: null, event_kind: "monthly_summary", google_event_id: ev.id, calendar_id: calendarId });
      created++;
    }

    if (inserts.length > 0) {
      await supabaseAdmin.from("google_calendar_events").insert(inserts);
    }

    return { ok: true, created };
  });
