// ─────────────────────────────────────────────────────────────
// src/db/schema.ts
// Source: WebApp/lib/db/schema.ts — brand-monitor tables ONLY.
// The main app's user/conversation/message/aeo tables are intentionally
// excluded; they live in the Next.js app and share the same DB.
// ─────────────────────────────────────────────────────────────

import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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

// ── Relations (self-contained — no user table reference needed) ─
export const brandAnalysesRelations = relations(brandAnalyses, ({ }) => ({}));
export const brandprofileRelations = relations(brandprofile, ({ }) => ({}));

// ── Type exports ──────────────────────────────────────────────
export type BrandProfile = typeof brandprofile.$inferSelect;
export type NewBrandProfile = typeof brandprofile.$inferInsert;
export type BrandAnalysisRow = typeof brandAnalyses.$inferSelect;
export type NewBrandAnalysisRow = typeof brandAnalyses.$inferInsert;
