import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cfm-events.vercel.app";

  if (error) {
    console.error("Calendly OAuth error:", error, errorDescription);
    return NextResponse.redirect(`${baseUrl}?calendly_error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    // If accessed directly without a code, confirm the endpoint is active
    return NextResponse.json({
      status: "ready",
      message: "Calendly OAuth redirect URI is active and listening for authorization callbacks.",
      redirectUri: `${baseUrl}/api/auth/callback/calendly`,
    });
  }

  const clientId = process.env.CALENDLY_CLIENT_ID;
  const clientSecret = process.env.CALENDLY_CLIENT_SECRET;

  if (clientId && clientSecret) {
    try {
      const response = await fetch("https://auth.calendly.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${baseUrl}/api/auth/callback/calendly`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Calendly token exchange failed:", errorText);
        return NextResponse.redirect(`${baseUrl}?calendly_status=exchange_failed&calendly_error=${encodeURIComponent(errorText)}`);
      }

      const tokenData = await response.json();
      console.log("Calendly OAuth connected successfully for user:", tokenData.owner);

      // Save tokens to integrations table
      const { db, client } = await import("@/db/client");
      const { integrations } = await import("@/db/schema");
      const { pullCalendlyMeetings } = await import("@/lib/calendly-sync");

      // Auto-heal: Ensure integrations table exists in the database
      try {
        await client.execute(`
          CREATE TABLE IF NOT EXISTS integrations (
            id text PRIMARY KEY NOT NULL,
            access_token text,
            refresh_token text,
            token_type text,
            expires_at integer,
            user_uri text,
            organization_uri text,
            owner_name text,
            owner_email text,
            last_synced_at integer,
            sync_status text,
            sync_error text,
            created_at integer NOT NULL,
            updated_at integer NOT NULL
          );
        `);
      } catch (tableErr) {
        console.warn("Could not ensure integrations table:", tableErr);
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 7200) * 1000);

      try {
        await db
          .insert(integrations)
          .values({
            id: "calendly",
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenType: tokenData.token_type,
            expiresAt,
            userUri: tokenData.owner,
            organizationUri: tokenData.organization,
            syncStatus: "syncing",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: integrations.id,
            set: {
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              tokenType: tokenData.token_type,
              expiresAt,
              userUri: tokenData.owner,
              organizationUri: tokenData.organization,
              syncStatus: "syncing",
              updatedAt: new Date(),
            },
          });
      } catch (insertErr) {
        console.error("Error writing tokens to integrations table:", insertErr);
      }

      // Automatically pull meetings immediately (with error isolation)
      let syncedCount = 0;
      try {
        const syncResult = await pullCalendlyMeetings(tokenData.access_token);
        syncedCount = syncResult.count || 0;
        console.log("Initial Calendly meetings sync result:", syncedCount, "meetings");
      } catch (syncErr) {
        console.warn("Initial meetings pull deferred:", syncErr);
      }

      return NextResponse.redirect(`${baseUrl}?calendly_status=connected&synced_count=${syncedCount}`);
    } catch (err: any) {
      console.error("Error exchanging Calendly OAuth code:", err);
      const errMsg = err?.message || String(err);
      return NextResponse.redirect(`${baseUrl}?calendly_status=error&calendly_error=${encodeURIComponent(errMsg)}`);
    }
  }

  // If credentials are not yet set in environment, confirm code receipt and redirect back cleanly
  return NextResponse.redirect(`${baseUrl}?calendly_status=code_received`);
}
