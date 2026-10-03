CREATE TABLE `memory_locks` (
	`key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `private_files` (
	`key` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL
);
