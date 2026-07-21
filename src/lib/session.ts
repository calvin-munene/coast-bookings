import "server-only";

import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId: string | undefined;
  email: string | undefined;
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "fallback-dev-secret-replace-in-prod",
  cookieName: "cb_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getSessionUser(): Promise<{ userId: string; email: string } | null> {
  const session = await getSession();
  if (!session.userId || !session.email) return null;
  return { userId: session.userId, email: session.email };
}
