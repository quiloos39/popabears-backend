import * as dotenv from "dotenv";
dotenv.config();

import type { ConfigModule } from "@medusajs/medusa";
import { PluginOptions as AdminPluginOptions } from "@medusajs/admin";
import { z } from "zod";

const envSchema = z.object({
	JWT_SECRET: z.string().default("supersecret"),
	COOKIE_SECRET: z.string().default("supersecret"),
	DATABASE_URL: z.string().optional(),
	DATABASE_ENABLE_LOG: z.boolean().default(false),
	REDIS_URL: z.string().optional(),
	ADMIN_CORS: z.string().default("http://localhost:9000,http://localhost:9001,http://localhost:7001"),
	STORE_CORS: z.string().default("http://localhost:3000"),
	STRIPE_WEBHOOK_SECRET: z.string().optional(),
	STRIPE_SECRET_KEY: z.string().optional(),
	STRAPI_API_URL: z.string().optional(),
	STRAPI_API_TOKEN: z.string().optional(),
	S3_URL: z.string().optional(),
	S3_BUCKET: z.string().optional(),
	S3_REGION: z.string().optional(),
	S3_ACCESS_KEY: z.string().optional(),
	S3_SECRET_KEY: z.string().optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	LINKEDIN_CLIENT_ID: z.string().optional(),
	LINKEDIN_CLIENT_SECRET: z.string().optional(),
	ADMIN_URL: z.string().default("http://localhost:9000"),
	STORE_URL: z.string().default("http://localhost:3000"),
	BACKEND_URL: z.string().default("http://localhost:9000"),
	ADMIN_SERVE: z
		.string()
		.optional()
		.transform((serve) => (serve === "true" ? true : false))
		.pipe(z.boolean()),
	SENDGRID_API_KEY: z.string().optional(),
	SENDGRID_FROM: z.string().optional(),
});

declare global {
	namespace NodeJS {
		interface ProcessEnv extends z.infer<typeof envSchema> {}
	}
}

export const parsedEnv = envSchema.parse(process.env);

const plugins: ConfigModule["plugins"] = [
	//
	"medusa-fulfillment-manual",
	"medusa-payment-manual",
	{
		resolve: "@medusajs/admin",
		/** @type {import('@medusajs/admin').PluginOptions} */
		options: {
			serve: parsedEnv.ADMIN_SERVE,
			develop: {
				open: false,
			},
			path: "/",
			backend: parsedEnv.BACKEND_URL,
			autoRebuild: true,
		} as AdminPluginOptions,
	},
	{
		resolve: "medusa-plugin-variant-images",
		options: {
			enableUI: true,
		},
	},
];

let modules: ConfigModule["modules"] = {
	eventBus: {
		resolve: "@medusajs/event-bus-local",
	},
	cacheService: {
		resolve: "@medusajs/cache-inmemory",
		options: {
			ttl: 30,
		},
	},
	inventoryService: "@medusajs/inventory",
	stockLocationService: "@medusajs/stock-location",
};

if (parsedEnv.REDIS_URL) {
	modules = {
		eventBus: {
			resolve: "@medusajs/event-bus-redis",
			options: {
				redisUrl: parsedEnv.REDIS_URL,
			},
		},
		cacheService: {
			resolve: "@medusajs/cache-redis",
			options: {
				redisUrl: parsedEnv.REDIS_URL,
			},
		},
	};
	console.info(`Found "REDIS_URL" merging "event-bus-redis" and "redis-cache" into configuration`);
} else {
	console.info(`Couldn't found "REDIS_URL" merging "event-bus-local" and "cache-inmemory" into configuration`);
}

const enableStripe = !!(parsedEnv.STRIPE_SECRET_KEY && parsedEnv.STRIPE_WEBHOOK_SECRET);

if (enableStripe) {
	plugins.push({
		resolve: "medusa-payment-stripe",
		options: {
			api_key: parsedEnv.STRIPE_SECRET_KEY,
			webhook_secret: parsedEnv.STRIPE_WEBHOOK_SECRET,
			automatic_payment_methods: true,
		},
	});
	console.info(`Found Stripe related environment variables merging into configuration`);
} else {
	console.info("Couldn't found Stripe related environment variables skipping");
}

const enableS3 = !!(parsedEnv.S3_ACCESS_KEY && parsedEnv.S3_BUCKET && parsedEnv.S3_REGION && parsedEnv.S3_SECRET_KEY && parsedEnv.S3_URL);

if (enableS3) {
	plugins.push({
		resolve: "medusa-file-s3",
		options: {
			s3_url: parsedEnv.S3_URL,
			bucket: parsedEnv.S3_BUCKET,
			region: parsedEnv.S3_REGION,
			access_key_id: parsedEnv.S3_ACCESS_KEY,
			secret_access_key: parsedEnv.S3_SECRET_KEY,
		},
	});
	console.info("Found AWS S3 related environment variables merging into configuration");
} else {
	plugins.push({
		resolve: `@medusajs/file-local`,
		options: {},
	});
	console.log("Couldn't found AWS S3 related environment variables, using local file storage instead");
}

const enableGoogle = !!(
	parsedEnv.GOOGLE_CLIENT_ID &&
	parsedEnv.GOOGLE_CLIENT_SECRET &&
	parsedEnv.BACKEND_URL &&
	parsedEnv.ADMIN_URL &&
	parsedEnv.STORE_URL
);

const enableLinkedIn = !!(
	parsedEnv.LINKEDIN_CLIENT_ID &&
	parsedEnv.LINKEDIN_CLIENT_SECRET &&
	parsedEnv.BACKEND_URL &&
	parsedEnv.ADMIN_URL &&
	parsedEnv.STORE_URL
);

const enablePluginAuth = false || enableGoogle || enableLinkedIn;

if (enablePluginAuth) {
	plugins.push({
		resolve: "medusa-plugin-auth",
		options: [
			{
				type: "google",
				strict: "none",
				identifier: "google",
				clientID: parsedEnv.GOOGLE_CLIENT_ID,
				clientSecret: parsedEnv.GOOGLE_CLIENT_SECRET,
				admin: {
					callbackUrl: `${parsedEnv.BACKEND_URL}/admin/auth/google/cb`,
					failureRedirect: `${parsedEnv.ADMIN_URL}/app/login`,
					successRedirect: `${parsedEnv.ADMIN_URL}/`,
				},
				store: {
					callbackUrl: `${parsedEnv.BACKEND_URL}/store/auth/google/cb`,
					failureRedirect: `${parsedEnv.STORE_URL}/`,
					successRedirect: `${parsedEnv.STORE_URL}/`,
				},
			},
			// ...(enableLinkedIn && {
			// 	linkedin: {
			// 		clientID: parsedEnv.LINKEDIN_CLIENT_ID,
			// 		clientSecret: parsedEnv.LINKEDIN_CLIENT_SECRET,
			// 		admin: {
			// 			callbackUrl: `${parsedEnv.BACKEND_URL}/admin/auth/linkedin/cb`,
			// 			failureRedirect: `${parsedEnv.ADMIN_URL}/login`,

			// 			// The success redirect can be overriden from the client by adding a query param `?redirectTo=your_url` to the auth url
			// 			// This query param will have the priority over this configuration
			// 			successRedirect: `${parsedEnv.ADMIN_URL}/`,

			// 			// authPath: '/admin/auth/linkedin',
			// 			// authCallbackPath: '/admin/auth/linkedin/cb',
			// 			// expiresIn: 24 * 60 * 60 * 1000,
			// 			// verifyCallback: (container, req, accessToken, refreshToken, profile) => {
			// 			//    // implement your custom verify callback here if you need it
			// 			// }
			// 		},
			// 		store: {
			// 			callbackUrl: `${parsedEnv.BACKEND_URL}/store/auth/linkedin/cb`,
			// 			failureRedirect: `${parsedEnv.STORE_URL}/login`,

			// 			// The success redirect can be overriden from the client by adding a query param `?redirectTo=your_url` to the auth url
			// 			// This query param will have the priority over this configuration
			// 			successRedirect: `${parsedEnv.STORE_URL}/`,

			// 			// authPath: '/store/auth/linkedin',
			// 			// authCallbackPath: '/store/auth/linkedin/cb',
			// 			// expiresIn: 24 * 60 * 60 * 1000,
			// 			// verifyCallback: (container, req, accessToken, refreshToken, profile) => {
			// 			//    // implement your custom verify callback here if you need it
			// 			// }
			// 		},
			// 	},
			// }),
		],
	});
	console.info("Found Google and/or LinkedIn related environment variables merging into configuration");
} else {
	console.info("Couldn't found Google and/or LinkedIn related environment variables skipping");
}

const settings: ConfigModule = {
	projectConfig: {
		...(parsedEnv.REDIS_URL && { redis_url: parsedEnv.REDIS_URL }),
		database_url: parsedEnv.DATABASE_URL,
		store_cors: parsedEnv.STORE_CORS,
		admin_cors: parsedEnv.ADMIN_CORS,
		database_logging: parsedEnv.DATABASE_ENABLE_LOG,
		jwt_secret: parsedEnv.JWT_SECRET,
		cookie_secret: parsedEnv.COOKIE_SECRET,
		database_extra: {
			ssl: {
				rejectUnauthorized: false,
			},
		},
	},
	featureFlags: {
		product_categories: true,
		tax_inclusive_pricing: true,
	},
	modules,
	plugins,
};

console.log("Following configuration is loaded into memory:", JSON.stringify(settings));

export default settings;
