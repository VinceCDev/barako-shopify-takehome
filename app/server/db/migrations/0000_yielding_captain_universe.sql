CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`module` enum('inventory','loyalty','fulfillment','system') NOT NULL,
	`entity_type` enum('product','customer','order','shop') NOT NULL,
	`entity_id` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`shopify_customer_id` bigint NOT NULL,
	`first_name` varchar(255),
	`last_name` varchar(255),
	`email` varchar(255),
	`order_count` int NOT NULL DEFAULT 0,
	`total_spent` decimal(12,2) NOT NULL DEFAULT '0.00',
	`last_order_at` timestamp,
	`loyalty_score` decimal(8,2) NOT NULL DEFAULT '0.00',
	`loyalty_tier` enum('new','regular','vip','at_risk') NOT NULL DEFAULT 'new',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_shop_customer_unique` UNIQUE(`shop_id`,`shopify_customer_id`)
);
--> statement-breakpoint
CREATE TABLE `order_line_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int,
	`quantity` int NOT NULL DEFAULT 1,
	`price` decimal(12,2) NOT NULL DEFAULT '0.00',
	CONSTRAINT `order_line_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`customer_id` int,
	`shopify_order_id` bigint NOT NULL,
	`order_number` varchar(50),
	`total_price` decimal(12,2) NOT NULL DEFAULT '0.00',
	`fulfillment_status` enum('unfulfilled','in_progress','fulfilled') NOT NULL DEFAULT 'unfulfilled',
	`priority_score` decimal(8,2) NOT NULL DEFAULT '0.00',
	`shopify_created_at` timestamp NOT NULL,
	`fulfilled_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_shop_order_unique` UNIQUE(`shop_id`,`shopify_order_id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_id` int NOT NULL,
	`shopify_product_id` bigint NOT NULL,
	`shopify_variant_id` bigint,
	`title` varchar(255) NOT NULL,
	`sku` varchar(100),
	`current_stock` int NOT NULL DEFAULT 0,
	`reorder_threshold` int NOT NULL DEFAULT 10,
	`lead_time_days` int NOT NULL DEFAULT 14,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_shop_variant_unique` UNIQUE(`shop_id`,`shopify_variant_id`)
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shop_domain` varchar(255) NOT NULL,
	`access_token` varchar(255) NOT NULL,
	`scope` varchar(512),
	`installed_at` timestamp NOT NULL DEFAULT (now()),
	`uninstalled_at` timestamp,
	CONSTRAINT `shops_id` PRIMARY KEY(`id`),
	CONSTRAINT `shops_shop_domain_unique` UNIQUE(`shop_domain`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line_items` ADD CONSTRAINT `order_line_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_line_items` ADD CONSTRAINT `order_line_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_shop_id_shops_id_fk` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_logs_shop_idx` ON `activity_logs` (`shop_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_entity_idx` ON `activity_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `customers_shop_idx` ON `customers` (`shop_id`);--> statement-breakpoint
CREATE INDEX `order_line_items_order_idx` ON `order_line_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_line_items_product_idx` ON `order_line_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `orders_shop_idx` ON `orders` (`shop_id`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `products_shop_idx` ON `products` (`shop_id`);