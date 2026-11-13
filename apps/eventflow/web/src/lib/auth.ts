import { cookies } from "next/headers";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";

export type UserRole = "owner" | "admin" | "producer" | "warehouse";

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionToken) return null;

    const session = await verifySessionToken(sessionToken);
    if (!session) return null;

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });
    if (dbUser) {
      return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role as UserRole,
        avatarUrl: dbUser.avatarUrl || null,
      };
    }

    return {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role as UserRole,
      avatarUrl: session.avatarUrl || null,
    };
  } catch {
    return null;
  }
}

export async function loginUser(email: string, password: string): Promise<{
  success: boolean;
  error?: string;
  user?: { id: string; name: string; email: string; role: UserRole; avatarUrl?: string | null };
}> {
  const cleanEmail = email.toLowerCase().trim();
  const user = await db.query.users.findFirst({
    where: eq(users.email, cleanEmail),
  });

  if (!user) {
    return { success: false, error: "Credenciais inválidas. Verifica o email e a palavra-passe." };
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return { success: false, error: "Credenciais inválidas. Verifica o email e a palavra-passe." };
  }

  // Session valid for 14 days
  const expiresAt = Date.now() + 14 * 24 * 60 * 60 * 1000;
  const token = await signSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl || null,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl || null,
    },
  };
}

export async function logoutUser() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

import { generateId } from "./id";

export async function createTeamUser(data: { name: string; email: string; password: string; role: UserRole; customId?: string }) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const id = data.customId?.trim() ? data.customId.trim() : generateId("usr");
  await db.insert(users).values({
    id,
    name: data.name,
    email: data.email.toLowerCase().trim(),
    passwordHash,
    role: data.role,
    createdAt: new Date(),
  });
  return { success: true, id };
}
