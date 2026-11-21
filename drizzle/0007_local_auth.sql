-- Local username/password authentication. ChatGPT identity headers are not used by the app.
CREATE TABLE `auth_credentials` (
  `user_id` text PRIMARY KEY NOT NULL,
  `username` text NOT NULL,
  `password_hash` text NOT NULL,
  `password_salt` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_credentials_username` ON `auth_credentials` (`username`);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `last_seen_at` integer NOT NULL,
  `expires_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user` ON `auth_sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry` ON `auth_sessions` (`expires_at`);
