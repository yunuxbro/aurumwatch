import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDatabase } from "@/lib/mongodb";
import { createSession, httpError } from "@/lib/server-auth";

export const runtime = "nodejs";

const STATE_COOKIE = "aw_google_oauth";
const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GENERIC_FAILURE = "google_auth_failed";

function loginRedirect(request, error) {
  const url = new URL("/login", request.url);
  if (error) url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}

function sessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw httpError("Authentication is not configured.", 503);
  return new TextEncoder().encode(secret);
}

async function readGoogleProfile(request, cookieStore) {
  const url = new URL(request.url);
  const googleError = url.searchParams.get("error");
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const stateToken = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 0,
  });

  if (googleError === "access_denied") throw httpError("Google sign-in was cancelled.", 400);
  if (!code || !state || !stateToken) throw httpError("Google sign-in could not be verified.", 400);

  const { payload: flow } = await jwtVerify(stateToken, sessionSecret());
  if (typeof flow.state !== "string" || flow.state !== state || typeof flow.nonce !== "string") {
    throw httpError("Google sign-in could not be verified.", 400);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw httpError("Google sign-in is not configured yet.", 503);
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || new URL("/api/auth/google/callback", request.url).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) throw httpError("Google could not complete sign-in.", 401);
  const tokenBody = await tokenResponse.json();
  if (typeof tokenBody.id_token !== "string") throw httpError("Google did not return a valid identity.", 401);

  const { payload } = await jwtVerify(tokenBody.id_token, GOOGLE_KEYS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true ||
    payload.nonce !== flow.nonce
  ) {
    throw httpError("Google did not return a verified email for this sign-in.", 401);
  }

  return {
    googleSub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    displayName: typeof payload.name === "string" ? payload.name.trim().slice(0, 100) : "",
  };
}

function defaultProfile(displayName) {
  return {
    display_name: displayName,
    shop_name: "",
    phone: "",
    theme: "light",
    avatar_file_id: null,
  };
}

export async function GET(request) {
  const cookieStore = await cookies();
  try {
    const google = await readGoogleProfile(request, cookieStore);
    const users = (await getDatabase()).collection("users");
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ google_sub: 1 }, { unique: true, sparse: true });

    let user = await users.findOne({ google_sub: google.googleSub });
    if (!user) {
      user = await users.findOne({ email: google.email });
      if (user) {
        if (user.google_sub && user.google_sub !== google.googleSub) {
          throw httpError("This email is already linked to another Google account.", 409);
        }
        await users.updateOne(
          { _id: user._id, $or: [{ google_sub: { $exists: false } }, { google_sub: google.googleSub }] },
          { $set: { google_sub: google.googleSub, updated_at: new Date() } },
        );
        user = await users.findOne({ _id: user._id });
        if (user?.google_sub !== google.googleSub) {
          throw httpError("This email is already linked to another Google account.", 409);
        }
      } else {
        const now = new Date();
        const profile = defaultProfile(google.displayName);
        const result = await users.insertOne({
          email: google.email,
          google_sub: google.googleSub,
          passwordHash: null,
          profile,
          created_at: now,
          updated_at: now,
        });
        user = { _id: result.insertedId, email: google.email, profile };
      }
    }

    if (!user) throw httpError("Could not load the signed-in account.", 500);
    await createSession({ id: user._id.toString(), email: user.email });
    return loginRedirect(request);
  } catch (error) {
    console.error("Google sign-in failed.", error);
    const errorCode = error?.status === 503 && (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      ? "google_not_configured"
      : error?.status === 409
        ? "google_account_conflict"
        : error?.status === 400 && new URL(request.url).searchParams.get("error") === "access_denied"
          ? "google_cancelled"
          : GENERIC_FAILURE;
    return loginRedirect(request, errorCode);
  }
}
