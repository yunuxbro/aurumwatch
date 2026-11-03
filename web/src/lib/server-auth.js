import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "aw_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

function sessionSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw Object.assign(
      new Error("Authentication is not configured. Add a random AUTH_SECRET of at least 32 characters to web/.env.local."),
      { status: 503 },
    );
  }
  return new TextEncoder().encode(secret);
}

export function assertAuthConfig() {
  sessionSecret();
}

export async function createSession(user) {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(sessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function apiError(error, fallback = "The request could not be completed.") {
  console.error(fallback, error);
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = status === 500
    ? fallback
    : error.message;
  return Response.json({ error: message }, { status });
}

export function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}
