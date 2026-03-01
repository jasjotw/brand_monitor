// ─────────────────────────────────────────────────────────────
// src/db/schema.ts
// Source: WebApp/lib/db/schema.ts — brand-monitor tables ONLY.
// The main app's user/conversation/message/aeo tables are intentionally
// excluded; they live in the Next.js app and share the same DB.
// ─────────────────────────────────────────────────────────────

import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, unique, serial, varchar } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ── users ────────────────────────────────────────────────────────────────
// Auth service user table (shared DB).
export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    pwd: text('pwd').notNull(),
    phone: varchar('phone', { length: 20 }),
    config: jsonb('config')
        .notNull()
        .default(sql`'{"branding_mode":"self","byob":"no","notification":true}'::jsonb`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
        .notNull()
        .defaultNow()
        .$onUpdate(() => sql`now()`),
});

// ── brand_profile ─────────────────────────────────────────────
// Cached scraped data for a brand URL, scoped to a user.
export const brandprofile = pgTable('brand_profile', {
    id: uuid('id').primaryKey().notNull().unique(),
    userId: text('user_id').notNull(),
    name: text('brand_name').notNull(),
    url: text('brandurl').notNull(),
    industry: text('industry').notNull(),
    location: text('location').default('Global'),
    email: text('email'),
    logo: text('logo'),
    favicon: text('favicon'),
    description: text('description'),
    competitors: jsonb('competitors'),
    usp: jsonb('usp').default(sql`'[]'::jsonb`),
    audience: text('audience'),
    marketPositioning: text('market_positioning'),
    scrapedData: jsonb('scraped_data'),
    isScraped: boolean('is_scraped').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.userId, t.url),
}));

// ── brand_analyses ────────────────────────────────────────────
// Persisted results of a completed brand analysis run.
export const brandAnalyses = pgTable('brand_analyses', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    brandId: uuid('brand_id'),
    url: text('url').notNull(),
    companyName: text('company_name'),
    industry: text('industry'),
    analysisData: jsonb('analysis_data'),
    competitors: jsonb('competitors'),
    prompts: jsonb('prompts'),
    creditsUsed: integer('credits_used').default(10),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// Dedicated storage for Personas + ICP per user + brand.
export const audienceProfiles = pgTable('audience_profiles', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    brandId: uuid('brand_id').notNull(),
    personas: jsonb('personas').default(sql`'[]'::jsonb`),
    icp: jsonb('icp'),
    additionalInputs: jsonb('additional_inputs').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.userId, t.brandId),
}));

// Backlink analytics snapshot for each user + brand pair.
export const brandBacklinkSnapshots = pgTable('brand_backlink_snapshots', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    brandId: uuid('brand_id').notNull(),
    snapshot: jsonb('snapshot').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.userId, t.brandId),
}));

// ── Relations (self-contained — no user table reference needed) ─
export const brandAnalysesRelations = relations(brandAnalyses, ({ }) => ({}));
export const brandprofileRelations = relations(brandprofile, ({ }) => ({}));
export const audienceProfilesRelations = relations(audienceProfiles, ({ }) => ({}));
export const brandBacklinkSnapshotsRelations = relations(brandBacklinkSnapshots, ({ }) => ({}));

// ── Type exports ──────────────────────────────────────────────
export type BrandProfile = typeof brandprofile.$inferSelect;
export type NewBrandProfile = typeof brandprofile.$inferInsert;
export type BrandAnalysisRow = typeof brandAnalyses.$inferSelect;
export type NewBrandAnalysisRow = typeof brandAnalyses.$inferInsert;
export type AudienceProfileRow = typeof audienceProfiles.$inferSelect;
export type NewAudienceProfileRow = typeof audienceProfiles.$inferInsert;
export type BrandBacklinkSnapshotRow = typeof brandBacklinkSnapshots.$inferSelect;
export type NewBrandBacklinkSnapshotRow = typeof brandBacklinkSnapshots.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
