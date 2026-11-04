import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { apiError, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

const STATE_COOKIE = "aw_google_oauth";
const STATE_SECONDS = 10 * 60;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw httpError("Authentication is not configured.", 503);
  }
  return new TextEncoder().encode(secret);
}

export async function GET(request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
    if (!clientId || !clientSecret) {
      throw httpError("Google sign-in is not configured yet.", 503);
    }

    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const signedState = await new SignJWT({ state, nonce })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${STATE_SECONDS}s`)
      .sign(getSecret());
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL("/api/auth/google/callback", request.url).toString();
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, signedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth/google",
      maxAge: STATE_SECONDS,
    });

    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      prompt: "select_account",
    }).toString();
    return Response.redirect(googleUrl, 302);
  } catch (error) {
    if (error?.status === 503) {
      const loginUrl = new URL("/login?error=google_not_configured", request.url);
      return Response.redirect(loginUrl, 303);
    }
    return apiError(error, "Could not start Google sign-in.");
  }
}
