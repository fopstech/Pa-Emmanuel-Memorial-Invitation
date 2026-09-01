import crypto from "node:crypto";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import {
  db,
  auditLogsTable,
  checkInsTable,
  eventsTable,
  guestsTable,
  invitationsTable,
  programmeItemsTable,
} from "@workspace/db";
import {
  AdmitInvitationResponse,
  CreateProgrammeItemBody,
  CreateProgrammeItemResponse,
  CreateGuestBody,
  CreateGuestResponse,
  DeleteGuestParams,
  DeleteProgrammeItemParams,
  DisableInvitationParams,
  DisableInvitationResponse,
  EnableInvitationParams,
  EnableInvitationResponse,
  GetAdminDashboardResponse,
  GetEventResponse,
  GetGuestParams,
  GetGuestResponse,
  GetPublicInvitationParams,
  GetPublicInvitationResponse,
  ImportGuestsBody,
  ImportGuestsResponse,
  LookupInvitationBody,
  LookupInvitationResponse,
  ListAuditLogResponse,
  ListCheckInsQueryParams,
  ListCheckInsResponse,
  ListGuestsQueryParams,
  ListGuestsResponse,
  ListProgrammeResponse,
  RegenerateInvitationParams,
  RegenerateInvitationResponse,
  SubmitRsvpBody,
  SubmitRsvpParams,
  SubmitRsvpResponse,
  UpdateEventBody,
  UpdateEventResponse,
  UpdateGuestBody,
  UpdateGuestParams,
  UpdateGuestResponse,
  UpdateProgrammeItemBody,
  UpdateProgrammeItemParams,
  UpdateProgrammeItemResponse,
} from "@workspace/api-zod";
import { requireAdmin, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

const DEFAULT_EVENT = {
  deceasedName: "Pa Emmanuel Ayodele Abatan",
  eventTitle: "Celebration of Life / Burial",
  waykeepDate: "2026-10-15",
  burialDate: "2026-10-16",
  year: 2026,
  venue: "CGCC Citadel Global Community Church",
  dressCode: "Purple",
};

function actor(req: Request): string {
  return (req as AuthenticatedRequest).userId ?? getAuth(req).userId ?? "system";
}

async function ensureEvent() {
  const [existing] = await db.select().from(eventsTable).limit(1);
  if (existing) return existing;
  const [event] = await db.insert(eventsTable).values(DEFAULT_EVENT).returning();
  return event;
}

async function addAudit(req: Request, action: string, target?: string) {
  await db.insert(auditLogsTable).values({ action, target, actor: actor(req) });
}

function makeCode(name: string): string {
  const prefix =
    name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toUpperCase()
      .slice(0, 18) || "GUEST";
  return `${prefix}-${crypto.randomInt(1000, 10000)}`;
}

async function makeUniqueInvitation() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = makeCode("GUEST");
    const token = crypto.randomBytes(32).toString("base64url");
    const [match] = await db
      .select({ id: invitationsTable.id })
      .from(invitationsTable)
      .where(or(eq(invitationsTable.invitationCode, code), eq(invitationsTable.secureToken, token)))
      .limit(1);
    if (!match) return { code, token };
  }
  throw new Error("Unable to generate a unique invitation");
}

async function makeInvitationForName(name: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `${makeCode(name)}`;
    const token = crypto.randomBytes(32).toString("base64url");
    const [match] = await db
      .select({ id: invitationsTable.id })
      .from(invitationsTable)
      .where(or(eq(invitationsTable.invitationCode, code), eq(invitationsTable.secureToken, token)))
      .limit(1);
    if (!match) return { code, token };
  }
  throw new Error("Unable to generate a unique invitation");
}

async function getAdminGuest(id: number) {
  const [row] = await db
    .select({ guest: guestsTable, invitation: invitationsTable })
    .from(guestsTable)
    .innerJoin(invitationsTable, eq(invitationsTable.guestId, guestsTable.id))
    .where(eq(guestsTable.id, id));
  if (!row) return null;
  return {
    id: row.guest.id,
    invitationId: row.invitation.id,
    fullName: row.guest.fullName,
    phone: row.guest.phone,
    email: row.guest.email,
    notes: row.guest.notes,
    invitationCode: row.invitation.invitationCode,
    invitationToken: row.invitation.secureToken,
    admissionLimit: row.invitation.admissionLimit,
    status: row.invitation.status,
    rsvpStatus: row.invitation.rsvpStatus,
    createdAt: row.guest.createdAt,
    checkedInAt: row.invitation.checkedInAt,
    checkedInBy: row.invitation.checkedInBy,
  };
}

async function getAdminGuests(search?: string, status?: string, rsvp?: string) {
  const conditions = [];
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(ilike(guestsTable.fullName, term), ilike(invitationsTable.invitationCode, term)),
    );
  }
  if (status && status !== "all") conditions.push(eq(invitationsTable.status, status));
  if (rsvp && rsvp !== "all") conditions.push(eq(invitationsTable.rsvpStatus, rsvp));

  const rows = await db
    .select({ guest: guestsTable, invitation: invitationsTable })
    .from(guestsTable)
    .innerJoin(invitationsTable, eq(invitationsTable.guestId, guestsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(guestsTable.createdAt));

  return rows.map(({ guest, invitation }) => ({
    id: guest.id,
    invitationId: invitation.id,
    fullName: guest.fullName,
    phone: guest.phone,
    email: guest.email,
    notes: guest.notes,
    invitationCode: invitation.invitationCode,
    invitationToken: invitation.secureToken,
    admissionLimit: invitation.admissionLimit,
    status: invitation.status,
    rsvpStatus: invitation.rsvpStatus,
    createdAt: guest.createdAt,
    checkedInAt: invitation.checkedInAt,
    checkedInBy: invitation.checkedInBy,
  }));
}

router.get("/event", async (_req, res): Promise<void> => {
  const event = await ensureEvent();
  res.json(GetEventResponse.parse(event));
});

router.patch("/event", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid event settings" });
    return;
  }
  const event = await ensureEvent();
  const [updated] = await db
    .update(eventsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(eventsTable.id, event.id))
    .returning();
  res.json(UpdateEventResponse.parse(updated));
  await addAudit(req, "Event settings updated", String(event.id));
});

router.get("/programme", async (_req, res): Promise<void> => {
  const event = await ensureEvent();
  const rows = await db
    .select()
    .from(programmeItemsTable)
    .where(eq(programmeItemsTable.eventId, event.id))
    .orderBy(asc(programmeItemsTable.sortOrder), asc(programmeItemsTable.date));
  res.json(ListProgrammeResponse.parse(rows));
});

router.post("/programme", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProgrammeItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid programme item" });
    return;
  }
  const event = await ensureEvent();
  const [item] = await db
    .insert(programmeItemsTable)
    .values({ ...parsed.data, eventId: event.id })
    .returning();
  res.status(201).json(CreateProgrammeItemResponse.parse(item));
  await addAudit(req, "Programme item created", String(item.id));
});

router.patch("/programme/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateProgrammeItemParams.safeParse(req.params);
  const body = UpdateProgrammeItemBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid programme item" });
    return;
  }
  const [item] = await db
    .update(programmeItemsTable)
    .set(body.data)
    .where(eq(programmeItemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Programme item not found" });
    return;
  }
  res.json(UpdateProgrammeItemResponse.parse(item));
  await addAudit(req, "Programme item updated", String(item.id));
});

router.delete("/programme/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteProgrammeItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid programme item" });
    return;
  }
  const [item] = await db
    .delete(programmeItemsTable)
    .where(eq(programmeItemsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Programme item not found" });
    return;
  }
  res.sendStatus(204);
  await addAudit(req, "Programme item deleted", String(item.id));
});

router.get("/public/invitations/:token", async (req, res): Promise<void> => {
  const params = GetPublicInvitationParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }
  const [row] = await db
    .select({ invitation: invitationsTable, guest: guestsTable, event: eventsTable })
    .from(invitationsTable)
    .innerJoin(guestsTable, eq(guestsTable.id, invitationsTable.guestId))
    .innerJoin(eventsTable, eq(eventsTable.id, invitationsTable.eventId))
    .where(eq(invitationsTable.secureToken, params.data.token));
  if (!row) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }
  const programme = await db
    .select()
    .from(programmeItemsTable)
    .where(eq(programmeItemsTable.eventId, row.event.id))
    .orderBy(asc(programmeItemsTable.sortOrder), asc(programmeItemsTable.date));
  res.json(
    GetPublicInvitationResponse.parse({
      guestName: row.guest.fullName,
      invitationCode: row.invitation.invitationCode,
      admissionLimit: row.invitation.admissionLimit,
      status: row.invitation.status,
      rsvpStatus: row.invitation.rsvpStatus,
      event: row.event,
      programme,
      checkedInAt: row.invitation.checkedInAt,
    }),
  );
});

router.post("/public/invitations/:token/rsvp", async (req, res): Promise<void> => {
  const params = SubmitRsvpParams.safeParse(req.params);
  const body = SubmitRsvpBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid RSVP" });
    return;
  }
  const [current] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.secureToken, params.data.token));
  if (!current) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }
  if (current.status === "disabled") {
    res.status(409).json({ error: "This invitation is disabled" });
    return;
  }
  const [invitation] = await db
    .update(invitationsTable)
    .set({
      rsvpStatus: body.data.response,
      status:
        current.status === "checked_in"
          ? "checked_in"
          : body.data.response === "yes"
            ? "confirmed"
            : "pending",
      updatedAt: new Date(),
    })
    .where(eq(invitationsTable.secureToken, params.data.token))
    .returning();
  const [guest] = await db.select().from(guestsTable).where(eq(guestsTable.id, invitation.guestId));
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, invitation.eventId));
  const programme = await db
    .select()
    .from(programmeItemsTable)
    .where(eq(programmeItemsTable.eventId, invitation.eventId))
    .orderBy(asc(programmeItemsTable.sortOrder), asc(programmeItemsTable.date));
  res.json(
    SubmitRsvpResponse.parse({
      guestName: guest.fullName,
      invitationCode: invitation.invitationCode,
      admissionLimit: invitation.admissionLimit,
      status: invitation.status,
      rsvpStatus: invitation.rsvpStatus,
      event,
      programme,
      checkedInAt: invitation.checkedInAt,
    }),
  );
});

router.get("/admin/dashboard", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select({ status: invitationsTable.status, rsvp: invitationsTable.rsvpStatus }).from(invitationsTable);
  const totalInvited = rows.length;
  const checkedIn = rows.filter((r) => r.status === "checked_in").length;
  const disabled = rows.filter((r) => r.status === "disabled").length;
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const pending = rows.filter((r) => r.status === "pending").length;
  const [recentActivity] = await Promise.all([
    db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(8),
  ]);
  res.json(
    GetAdminDashboardResponse.parse({
      totalInvited,
      confirmed,
      pending,
      checkedIn,
      notCheckedIn: totalInvited - checkedIn - disabled,
      disabled,
      rsvpYes: rows.filter((r) => r.rsvp === "yes").length,
      rsvpNo: rows.filter((r) => r.rsvp === "no").length,
      recentActivity,
    }),
  );
});

router.get("/admin/guests", requireAdmin, async (req, res): Promise<void> => {
  const query = ListGuestsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid guest filters" });
    return;
  }
  res.json(ListGuestsResponse.parse(await getAdminGuests(query.data.search, query.data.status, query.data.rsvp)));
});

router.post("/admin/guests", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateGuestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid guest details" });
    return;
  }
  const event = await ensureEvent();
  const { code, token } = await makeInvitationForName(parsed.data.fullName);
  const [guest] = await db.insert(guestsTable).values({
    fullName: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  await db.insert(invitationsTable).values({
    guestId: guest.id,
    eventId: event.id,
    invitationCode: code,
    secureToken: token,
    admissionLimit: parsed.data.admissionLimit ?? 1,
  });
  const result = await getAdminGuest(guest.id);
  res.status(201).json(CreateGuestResponse.parse(result));
  await addAudit(req, "Guest created", String(guest.id));
});

router.post("/admin/guests/import", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ImportGuestsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid CSV" });
    return;
  }
  const event = await ensureEvent();
  const created = [];
  const errors: { row: number; message: string }[] = [];
  const lines = parsed.data.csv.split(/\r?\n/).filter((line: string) => line.trim());
  for (const [index, line] of lines.entries()) {
    const parts = line.split(",").map((part: string) => part.trim());
    const [fullName, phone, email, limit] = parts;
    if (index === 0 && fullName?.toLowerCase() === "name") continue;
    if (!fullName || fullName.length < 2) {
      errors.push({ row: index + 1, message: "Name is required" });
      continue;
    }
    const admissionLimit = Number(limit || 1);
    if (!Number.isInteger(admissionLimit) || admissionLimit < 1) {
      errors.push({ row: index + 1, message: "Admission limit must be a positive whole number" });
      continue;
    }
    try {
      const { code, token } = await makeInvitationForName(fullName);
      const [guest] = await db.insert(guestsTable).values({ fullName, phone: phone || null, email: email || null }).returning();
      await db.insert(invitationsTable).values({ guestId: guest.id, eventId: event.id, invitationCode: code, secureToken: token, admissionLimit });
      const item = await getAdminGuest(guest.id);
      if (item) created.push(item);
    } catch {
      errors.push({ row: index + 1, message: "Could not create this guest" });
    }
  }
  res.json(ImportGuestsResponse.parse({ created, errors }));
  await addAudit(req, "Guest list imported", `${created.length} created`);
});

router.get("/admin/guests/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetGuestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid guest" });
    return;
  }
  const result = await getAdminGuest(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Guest not found" });
    return;
  }
  res.json(GetGuestResponse.parse(result));
});

router.patch("/admin/guests/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateGuestParams.safeParse(req.params);
  const body = UpdateGuestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid guest details" });
    return;
  }
  const [guest] = await db.update(guestsTable).set({ ...body.data, updatedAt: new Date() }).where(eq(guestsTable.id, params.data.id)).returning();
  if (!guest) {
    res.status(404).json({ error: "Guest not found" });
    return;
  }
  if (body.data.admissionLimit) {
    await db.update(invitationsTable).set({ admissionLimit: body.data.admissionLimit, updatedAt: new Date() }).where(eq(invitationsTable.guestId, guest.id));
  }
  const result = await getAdminGuest(guest.id);
  res.json(UpdateGuestResponse.parse(result));
  await addAudit(req, "Guest edited", String(guest.id));
});

router.delete("/admin/guests/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteGuestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid guest" });
    return;
  }
  const [guest] = await db.delete(guestsTable).where(eq(guestsTable.id, params.data.id)).returning();
  if (!guest) {
    res.status(404).json({ error: "Guest not found" });
    return;
  }
  res.sendStatus(204);
  await addAudit(req, "Guest deleted", String(guest.id));
});

async function updateInvitationStatus(req: Request, res: any, status: "disabled" | "pending", paramsSchema: typeof DisableInvitationParams | typeof EnableInvitationParams, responseSchema: typeof DisableInvitationResponse | typeof EnableInvitationResponse) {
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid guest" });
    return;
  }
  const guestId = params.data.id;
  const [invitation] = await db.update(invitationsTable).set({ status, updatedAt: new Date() }).where(eq(invitationsTable.guestId, guestId)).returning();
  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }
  const result = await getAdminGuest(guestId);
  res.json(responseSchema.parse(result));
  await addAudit(req, status === "disabled" ? "Invitation disabled" : "Invitation enabled", String(guestId));
}

router.post("/admin/guests/:id/disable", requireAdmin, async (req, res): Promise<void> => {
  await updateInvitationStatus(req, res, "disabled", DisableInvitationParams, DisableInvitationResponse);
});

router.post("/admin/guests/:id/enable", requireAdmin, async (req, res): Promise<void> => {
  await updateInvitationStatus(req, res, "pending", EnableInvitationParams, EnableInvitationResponse);
});

router.post("/admin/guests/:id/regenerate", requireAdmin, async (req, res): Promise<void> => {
  const params = RegenerateInvitationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid guest" });
    return;
  }
  const guest = await getAdminGuest(params.data.id);
  if (!guest) {
    res.status(404).json({ error: "Guest not found" });
    return;
  }
  const { code, token } = await makeInvitationForName(guest.fullName);
  await db.update(invitationsTable).set({ invitationCode: code, secureToken: token, status: "pending", checkedInAt: null, checkedInBy: null, updatedAt: new Date() }).where(eq(invitationsTable.guestId, guest.id));
  const result = await getAdminGuest(guest.id);
  res.json(RegenerateInvitationResponse.parse(result));
  await addAudit(req, "Invitation code regenerated", String(guest.id));
});

router.post("/admin/invitations/lookup", requireAdmin, async (req, res): Promise<void> => {
  const parsed = LookupInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid invitation code" });
    return;
  }
  const [row] = await db
    .select({ guest: guestsTable, invitation: invitationsTable })
    .from(invitationsTable)
    .innerJoin(guestsTable, eq(guestsTable.id, invitationsTable.guestId))
    .where(eq(invitationsTable.invitationCode, parsed.data.code.trim().toUpperCase()));
  if (!row) {
    res.json(LookupInvitationResponse.parse({ result: "invalid", invitation: null }));
    return;
  }
  const result = row.invitation.status === "checked_in" ? "used" : row.invitation.status === "disabled" ? "disabled" : "valid";
  res.json(LookupInvitationResponse.parse({ result, invitation: await getAdminGuest(row.guest.id) }));
});

router.post("/admin/invitations/:id/admit", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid invitation" });
    return;
  }
  const checkedInAt = new Date();
  const checkedInBy = actor(req);
  const result = await db.transaction(async (tx) => {
    const [invitation] = await tx
      .update(invitationsTable)
      .set({ status: "checked_in", checkedInAt, checkedInBy, updatedAt: checkedInAt })
      .where(and(eq(invitationsTable.id, id), ne(invitationsTable.status, "checked_in"), ne(invitationsTable.status, "disabled")))
      .returning();
    if (!invitation) return { outcome: "used" as const };
    await tx.insert(checkInsTable).values({ invitationId: invitation.id, guestId: invitation.guestId, checkedInAt, checkedInBy });
    return { outcome: "admitted" as const, invitation };
  });
  if (result.outcome !== "admitted") {
    const [invitation] = await db.select().from(invitationsTable).where(eq(invitationsTable.id, id));
    const outcome = invitation?.status === "disabled" ? "disabled" : invitation ? "used" : "not_found";
    res.json(AdmitInvitationResponse.parse({ result: outcome, invitation: null, checkedInAt: invitation?.checkedInAt ?? null }));
    return;
  }
  const guest = await getAdminGuest(result.invitation.guestId);
  res.json(AdmitInvitationResponse.parse({ result: "admitted", invitation: guest, checkedInAt }));
  await addAudit(req, "Guest checked in", String(result.invitation.guestId));
});

router.get("/admin/check-ins", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListCheckInsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid check-in filters" });
    return;
  }
  const rows = await db
    .select({ checkIn: checkInsTable, guest: guestsTable, invitation: invitationsTable })
    .from(checkInsTable)
    .innerJoin(guestsTable, eq(guestsTable.id, checkInsTable.guestId))
    .innerJoin(invitationsTable, eq(invitationsTable.id, checkInsTable.invitationId))
    .where(parsed.data.search ? or(ilike(guestsTable.fullName, `%${parsed.data.search}%`), ilike(invitationsTable.invitationCode, `%${parsed.data.search}%`)) : undefined)
    .orderBy(desc(checkInsTable.checkedInAt));
  res.json(ListCheckInsResponse.parse(rows.map(({ checkIn, guest, invitation }) => ({
    id: checkIn.id,
    guestName: guest.fullName,
    invitationCode: invitation.invitationCode,
    checkedInAt: checkIn.checkedInAt,
    checkedInBy: checkIn.checkedInBy,
  }))));
});

router.get("/admin/audit", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(100);
  res.json(ListAuditLogResponse.parse(rows));
});

export default router;