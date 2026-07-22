CREATE TABLE `daily_states` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date_key` text NOT NULL,
	`state_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_states_user_date_idx` ON `daily_states` (`user_id`,`date_key`);--> statement-breakpoint
CREATE INDEX `daily_states_date_idx` ON `daily_states` (`date_key`);--> statement-breakpoint
CREATE TABLE `planning_memories` (
	`user_id` text PRIMARY KEY NOT NULL,
	`memory_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_email_idx` ON `user_profiles` (`email`);