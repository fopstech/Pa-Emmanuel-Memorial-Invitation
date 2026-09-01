import { clerkClient, getAuth } from "@clerk/express";
import type { RequestHandler } from "express";

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
  const auth = getAuth(req);
  const userId = auth.userId;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const allowedEmails = new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

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