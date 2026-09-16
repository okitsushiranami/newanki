CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`due` integer NOT NULL,
	`interval` real DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`reviews` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cards_deck_due` ON `cards` (`deck_id`,`due`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_decks_owner` ON `decks` (`owner`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`card_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`rating` text NOT NULL,
	`reviewed_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`old_interval` real NOT NULL,
	`new_interval` real NOT NULL,
	`next_due` integer NOT NULL,
	`scheduler` text DEFAULT 'newanki-v1' NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_owner_time` ON `reviews` (`owner`,`reviewed_at`);