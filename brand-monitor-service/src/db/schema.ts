import { pgTable, text, timestamp, uuid, boolean, jsonb, integer, unique, serial, varchar, numeric } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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

export const brandAnalyses = pgTable('brand_analyses', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    brandId: uuid('brand_id'),
    url: text('url').notNull(),
    companyName: text('company_name'),
    industry: text('industry'),
    analysisData: jsonb('analysis_data'),
    draftPrompts: jsonb('draft_prompts').notNull().default(sql`'[]'::jsonb`),
    competitors: jsonb('competitors'),
    prompts: jsonb('prompts'),
    creditsUsed: numeric('credits_used', { precision: 12, scale: 2 }).default('10'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

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

export const plans = pgTable('plans', {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    monthlyCredits: numeric('monthly_credits', { precision: 12, scale: 2 }).notNull().default('0'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const planFeatures = pgTable('plan_features', {
    id: uuid('id').primaryKey().defaultRandom(),
    planCode: text('plan_code').notNull().references(() => plans.code, { onDelete: 'cascade' }),
    featureCode: text('feature_code').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    limitValue: numeric('limit_value', { precision: 12, scale: 2 }),
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.planCode, t.featureCode),
}));

export const userSubscriptions = pgTable('user_subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    planCode: text('plan_code').notNull().references(() => plans.code),
    status: text('status').notNull().default('active'),
    startsAt: timestamp('starts_at').defaultNow(),
    endsAt: timestamp('ends_at'),
    autoRenew: boolean('auto_renew').notNull().default(true),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const brandPlanOverrides = pgTable('brand_plan_overrides', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    brandId: uuid('brand_id').notNull().references(() => brandprofile.id, { onDelete: 'cascade' }),
    planCode: text('plan_code').notNull().references(() => plans.code),
    status: text('status').notNull().default('active'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
    unq: unique().on(t.userId, t.brandId),
}));

export const creditWallets = pgTable('credit_wallets', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().unique(),
    balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
    reservedBalance: numeric('reserved_balance', { precision: 12, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const creditLedger = pgTable('credit_ledger', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    delta: numeric('delta', { precision: 12, scale: 2 }).notNull(),
    reason: text('reason').notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
});

export const creditReservations = pgTable('credit_reservations', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    amountTotal: numeric('amount_total', { precision: 12, scale: 2 }).notNull(),
    amountRemaining: numeric('amount_remaining', { precision: 12, scale: 2 }).notNull(),
    status: text('status').notNull().default('reserved'),
    reason: text('reason').notNull().default('usage_reserve'),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const brandAnalysesRelations = relations(brandAnalyses, ({ }) => ({}));
export const brandprofileRelations = relations(brandprofile, ({ }) => ({}));
export const audienceProfilesRelations = relations(audienceProfiles, ({ }) => ({}));
export const brandBacklinkSnapshotsRelations = relations(brandBacklinkSnapshots, ({ }) => ({}));
export const plansRelations = relations(plans, ({ }) => ({}));
export const planFeaturesRelations = relations(planFeatures, ({ }) => ({}));
export const userSubscriptionsRelations = relations(userSubscriptions, ({ }) => ({}));
export const brandPlanOverridesRelations = relations(brandPlanOverrides, ({ }) => ({}));
export const creditWalletsRelations = relations(creditWallets, ({ }) => ({}));
export const creditLedgerRelations = relations(creditLedger, ({ }) => ({}));
export const creditReservationsRelations = relations(creditReservations, ({ }) => ({}));

export type BrandProfile = typeof brandprofile.$inferSelect;
export type NewBrandProfile = typeof brandprofile.$inferInsert;
export type BrandAnalysisRow = typeof brandAnalyses.$inferSelect;
export type NewBrandAnalysisRow = typeof brandAnalyses.$inferInsert;
export type AudienceProfileRow = typeof audienceProfiles.$inferSelect;
export type NewAudienceProfileRow = typeof audienceProfiles.$inferInsert;
export type BrandBacklinkSnapshotRow = typeof brandBacklinkSnapshots.$inferSelect;
export type NewBrandBacklinkSnapshotRow = typeof brandBacklinkSnapshots.$inferInsert;
export type PlanRow = typeof plans.$inferSelect;
export type NewPlanRow = typeof plans.$inferInsert;
export type PlanFeatureRow = typeof planFeatures.$inferSelect;
export type NewPlanFeatureRow = typeof planFeatures.$inferInsert;
export type UserSubscriptionRow = typeof userSubscriptions.$inferSelect;
export type NewUserSubscriptionRow = typeof userSubscriptions.$inferInsert;
export type BrandPlanOverrideRow = typeof brandPlanOverrides.$inferSelect;
export type NewBrandPlanOverrideRow = typeof brandPlanOverrides.$inferInsert;
export type CreditWalletRow = typeof creditWallets.$inferSelect;
export type NewCreditWalletRow = typeof creditWallets.$inferInsert;
export type CreditLedgerRow = typeof creditLedger.$inferSelect;
export type NewCreditLedgerRow = typeof creditLedger.$inferInsert;
export type CreditReservationRow = typeof creditReservations.$inferSelect;
export type NewCreditReservationRow = typeof creditReservations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
