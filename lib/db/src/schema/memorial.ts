import {
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  deceasedName: text("deceased_name").notNull(),
  eventTitle: text("event_title").notNull(),
  waykeepDate: date("waykeep_date", { mode: "string" }).notNull(),
  burialDate: date("burial_date", { mode: "string" }).notNull(),
  year: integer("year"),
  venue: text("venue").notNull(),
  waykeepVenue: text("waykeep_venue")
    .notNull()
    .default("Citadel Global Community Church (CGCC)"),
  burialVenue: text("burial_venue")
    .notNull()
    .default("Ronnie D’Events"),
  dressCode: text("dress_code").notNull(),
  biography: text("biography"),
  tribute: text("tribute"),
  importantInformation: text("important_information"),
  directions: text("directions"),
  contactInformation: text("contact_information"),
  mapUrl: text("map_url"),
  photoUrl: text("photo_url"),
  backgroundImageUrl: text("background_image_url"),
  asoEbiInformation: text("aso_ebi_information"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const guestsTable = pgTable("guests", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const invitationsTable = pgTable(
  "invitations",
  {
    id: serial("id").primaryKey(),
    guestId: integer("guest_id")
      .notNull()
      .references(() => guestsTable.id, { onDelete: "cascade" }),
    eventId: integer("event_id")
      .notNull()
      .references(() => eventsTable.id, { onDelete: "cascade" }),
    invitationCode: text("invitation_code").notNull(),
    secureToken: text("secure_token").notNull(),
    admissionLimit: integer("admission_limit").notNull().default(1),
    admittedCount: integer("admitted_count").notNull().default(0),
    status: text("status").notNull().default("pending"),
    rsvpStatus: text("rsvp_status").notNull().default("pending"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: text("checked_in_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    codeIdx: uniqueIndex("invitations_code_idx").on(table.invitationCode),
    tokenIdx: uniqueIndex("invitations_token_idx").on(table.secureToken),
  }),
);

export const programmeItemsTable = pgTable("programme_items", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => eventsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  time: text("time"),
  location: text("location"),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const checkInsTable = pgTable("check_ins", {
  id: serial("id").primaryKey(),
  invitationId: integer("invitation_id")
    .notNull()
    .references(() => invitationsTable.id, { onDelete: "cascade" }),
  guestId: integer("guest_id")
    .notNull()
    .references(() => guestsTable.id, { onDelete: "cascade" }),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
  checkedInBy: text("checked_in_by").notNull(),
  numberAdmitted: integer("number_admitted").notNull().default(1),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  target: text("target"),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type Guest = typeof guestsTable.$inferSelect;
export type Invitation = typeof invitationsTable.$inferSelect;
export type ProgrammeItem = typeof programmeItemsTable.$inferSelect;
export type CheckIn = typeof checkInsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;