import crypto from "node:crypto";
import { clerkClient, getAuth } from "@clerk/express";
import type { Request, RequestHandler, Response } from "express";

const STAFF_COOKIE = "pma_staff_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type StaffRole = "admin" | "usher";

type StaffSession = { role: StaffRole; expiresAt: number };

function secret() {
  return process.env.STAFF_SESSION_SECRET || process.env.CLERK_SECRET_KEY || "development-only-pma-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeSession(session: StaffSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSession(req: Request): StaffSession | null {
  const raw = req.headers.cookie?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${STAFF_COOKIE}=`))?.slice(STAFF_COOKIE.length + 1);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as StaffSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function setStaffSession(res: Response, role: StaffRole) {
  const value = encodeSession({ role, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
  res.setHeader("Set-Cookie", `${STAFF_COOKIE}=${value}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export function clearStaffSession(res: Response) {
  res.setHeader("Set-Cookie", `${STAFF_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

export function staffSession(req: Request) {
  return readSession(req);
}

export function staffRole(req: Request) {
  return readSession(req)?.role;
}

export function staffCodeRole(code: string): StaffRole | null {
  if (code === (process.env.STAFF_ADMIN_CODE || "2011")) return "admin";
  if (code === (process.env.STAFF_USHER_CODE || "30")) return "usher";
  return null;
}

export type AuthenticatedRequest = Parameters<RequestHandler>[0] & {
  userId: string;
};

export const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  const userId = auth.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  (req as AuthenticatedRequest).userId = userId;
  next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const session = readSession(req);
  if (session?.role === "admin") {
    (req as AuthenticatedRequest).userId = "staff:admin";
    next();
    return;
  }
  const auth = getAuth(req);
  const userId = auth.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const allowedEmails = new Set([
    "mofopes@outlook.com",
    ...(process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  ]);

  if (allowedEmails.size === 0) {
    res.status(403).json({ error: "Admin access is not configured" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const userEmails = user.emailAddresses.map((email) =>
      email.emailAddress.trim().toLowerCase(),
    );

    if (!userEmails.some((email) => allowedEmails.has(email))) {
      res.status(403).json({ error: "Admin access denied" });
      return;
    }

    (req as AuthenticatedRequest).userId = userId;
    next();
  } catch (error) {
    req.log?.error({ err: error }, "Could not verify admin identity");
    res.status(503).json({ error: "Could not verify admin access" });
  }
};

export const requireUsher: RequestHandler = async (req, res, next) => {
  const session = readSession(req);
  if (session?.role === "admin" || session?.role === "usher") {
    (req as AuthenticatedRequest).userId = `staff:${session.role}`;
    next();
    return;
  }
  const auth = getAuth(req);
  const userId = auth.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const allowedEmails = new Set(
    [
      process.env.ADMIN_EMAILS ?? "",
      process.env.USHER_EMAILS ?? "",
    ]
      .flatMap((value) => value.split(","))
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  if (allowedEmails.size === 0) {
    res.status(403).json({ error: "Usher access is not configured" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const userEmails = user.emailAddresses.map((email) =>
      email.emailAddress.trim().toLowerCase(),
    );

    if (!userEmails.some((email) => allowedEmails.has(email))) {
      res.status(403).json({ error: "Usher access denied" });
      return;
    }

    (req as AuthenticatedRequest).userId = userId;
    next();
  } catch (error) {
    req.log?.error({ err: error }, "Could not verify usher identity");
    res.status(503).json({ error: "Could not verify usher access" });
  }
};
