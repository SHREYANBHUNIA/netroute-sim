CREATE TABLE `saved_experiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topologyId` int,
	`name` varchar(120) NOT NULL,
	`algorithm` varchar(48) NOT NULL,
	`resultsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_experiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_topologies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`nodesJson` text NOT NULL,
	`linksJson` text NOT NULL,
	`eventsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_topologies_id` PRIMARY KEY(`id`)
);
