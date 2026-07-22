import { sql } from "drizzle-orm";
import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const userProfiles = sqliteTable(
  "user_profiles",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    emailIdx: uniqueIndex("user_profiles_email_idx").on(table.email),
  }),
);

export const dailyStates = sqliteTable(
  "daily_states",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    dateKey: text("date_key").notNull(),
    stateJson: text("state_json").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userDateIdx: uniqueIndex("daily_states_user_date_idx").on(
      table.userId,
      table.dateKey,
    ),
    dateIdx: index("daily_states_date_idx").on(table.dateKey),
  }),
);

export const planningMemories = sqliteTable("planning_memories", {
  userId: text("user_id")
    .primaryKey()
    .references(() => userProfiles.id, { onDelete: "cascade" }),
  memoryJson: text("memory_json").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
