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
        return NextResponse.redirect(`${baseUrl}?calendly_status=exchange_failed`);
      }

      const tokenData = await response.json();
      console.log("Calendly OAuth connected successfully for user:", tokenData.owner);

      return NextResponse.redirect(`${baseUrl}?calendly_status=connected`);
    } catch (err) {
      console.error("Error exchanging Calendly OAuth code:", err);
      return NextResponse.redirect(`${baseUrl}?calendly_status=error`);
    }
  }

  // If credentials are not yet set in environment, confirm code receipt and redirect back cleanly
  return NextResponse.redirect(`${baseUrl}?calendly_status=code_received`);
}
