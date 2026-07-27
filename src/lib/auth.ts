import { SignJWT, jwtVerify, JWTVerifyResult } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "session";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment");
}

const encoder = new TextEncoder();
const secret = encoder.encode(JWT_SECRET);

export async function signSession(payload: { userId: string; email: string }) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  return token;
}

export async function verifySession(token: string | undefined | null) {
  if (!token) return null;
  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload as Record<string, any>;
  } catch (err) {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value ?? null;
  if (!cookie) return null;
  return verifySession(cookie);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return session;
}

export { COOKIE_NAME };
