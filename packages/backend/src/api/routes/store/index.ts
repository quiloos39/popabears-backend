import { CartService, ProductVariantService, SalesChannelService, ShippingOptionService } from "@medusajs/medusa";
import { Router } from "express";

import moment from "moment";
import { parsedEnv } from "../../../../medusa-config";
import axios from "axios";
import TiltCoFulfillmentService from "../../../services/tiltco";

const client = axios.create({
	baseURL: "https://external-api.freightcom.com",
	headers: {
		Authorization: process.env.FREIGHTCOM_API_KEY,
	},
});

const cache = {};

export function attachStoreRoutes(router: Router) {
	router.get("/sales-channels", async (req, res, next) => {
		const salesChannelService = req.scope.resolve<SalesChannelService>("salesChannelService");
		const [channels] = await salesChannelService.listAndCount({});
		res.json({
			sales_channels: channels,
		});
	});

	router.get("/shipping-options/v2/:cart_id", async (req, res, next) => {
		try {
			const cartId = req.params.cart_id;
			const cartService = req.scope.resolve<CartService>("cartService");
			const cart = await cartService.retrieve(cartId, {
				relations: ["items", "shipping_address"],
			});

			const { shipping_address } = cart;

			const destinationPostalCode = shipping_address?.postal_code;
			console.log(`For cart ${cartId}, destination postal code is ${destinationPostalCode}`);

			if (!destinationPostalCode) {
				throw new Error("Missing destination postal code");
			}

			const SALES_CHANNEL_POSTAL_CODES = {
				sc_01GY1TR8XSSA865FXVJDQR9XCZ: "H2K 4P5", // "Value Products"
				sc_01H54KV0V84HGG6PZD06T3J8C4: "L0L 1P0", // "Value Barrie"
				sc_01H54KTSHXG7TYSRN9XND4HHQB: "J3E 0C4", // Value Sainte Julie
			};

			const originPostalCode = SALES_CHANNEL_POSTAL_CODES[cart.sales_channel_id] || Object.values(SALES_CHANNEL_POSTAL_CODES)[0];

			console.log(`For cart ${cartId}, origin postal code is ${originPostalCode}`);

			const productVariantService = req.scope.resolve<ProductVariantService>("productVariantService");

			const products = [];
			for (const item of cart.items) {
				const variant = await productVariantService.retrieve(item.variant_id, {
					relations: ["product"],
				});
				products.push({
					item_id: variant.product_id,
					weight: variant.product.weight,
					length: variant.product.length,
					width: variant.product.width,
					height: variant.product.height,
					quantity: item.quantity,
				});
			}

			console.log(`For cart ${cartId}, products are ${JSON.stringify(products)}`);

			const deliveryDate = moment().add(7, "days");
			const [day, month, year] = deliveryDate.format("DD MM YYYY").split(" ");

			const shippingOptionService = req.scope.resolve<ShippingOptionService>("shippingOptionService");

			const shippingOptions = await shippingOptionService.list({
				region_id: cart.region_id,
			});

			const ltlcoShippingOptions = shippingOptions.filter((option) => option.provider_id === "ltlco");

			const rateData = {
				services: ltlcoShippingOptions.map((option) => option.data.id),
				details: {
					origin: {
						address: {
							country: "CA",
							postal_code: originPostalCode,
						},
					},
					destination: {
						address: {
							country: "CA",
							postal_code: destinationPostalCode,
						},
						ready_at: {
							hour: 15,
							minute: 6,
						},
						ready_until: {
							hour: 15,
							minute: 6,
						},
						signature_requirement: "not-required",
					},
					expected_ship_date: {
						year: Number(year),
						month: Number(month),
						day: Number(day),
					},
					packaging_type: "pallet",
					packaging_properties: {
						pallet_type: "ltl",
						pallets: products.flatMap((product) => {
							const items = [];
							for (let i = 0; i < product.quantity; i++) {
								items.push({
									measurements: {
										weight: {
											unit: "g",
											value: product.weight,
										},
										cuboid: {
											unit: "mm",
											l: product.length,
											w: product.width,
											h: product.height,
										},
									},
									description: "string",
									freight_class: "string",
								});
							}
							return items;
						}),
					},
				},
			};

			console.log(`For cart ${cartId}, rate data is ${JSON.stringify(rateData)}`);

			const rate_id = await client.post("/rate", rateData).then((res) => res.data.request_id as string);

			const tiltcoService = req.scope.resolve<TiltCoFulfillmentService>("tiltcoService");
			const price = await tiltcoService.calculatePrice(null, null, cart).catch(() => null);
			const titlcoShippingOption = shippingOptions.find((option) => option.provider_id === "tiltco");

			if (!!titlcoShippingOption && !!price) {
				cache[cart.id] = {
					id: titlcoShippingOption.id,
					name: titlcoShippingOption.name,
					price: price,
				};
			}

			res.send({ rate_id });
		} catch (e) {
			res.status(500).send(e.message);
		}
	});

	router.get("/shipping-options/v2/:cart_id/rates/:rate_id", async (req, res, next) => {
		try {
			const cart_id = req.params.cart_id;
			const cartService = req.scope.resolve<CartService>("cartService");
			const cart = await cartService.retrieve(cart_id, {
				relations: ["shipping_address", "items"],
			});

			const shippingOptionService = req.scope.resolve<ShippingOptionService>("shippingOptionService");
			const shippingOptions = await shippingOptionService.list({
				region_id: cart.region_id,
			});

			const rate_id = req.params.rate_id;
			const { status, rates } = await client.get("/rate/" + rate_id).then((res) => res.data);

			console.log(`For cart ${cart_id}, rate data is ${JSON.stringify(rates)}`);
			console.log(`For cart ${cart_id}, rate status is ${JSON.stringify(status)}`);

			const shippingRates = [];

			for (const rate of rates) {
				const shippingOption = shippingOptions.find((option) => option.data.id === rate.service_id);
				if (shippingOption) {
					shippingRates.push({
						id: shippingOption.id,
						name: shippingOption.name,
						price: Number(rate.total.value),
					});
				}
			}

			let shippingStatus = {
				...status,
			};

			if (!!cache[cart.id]) {
				shippingRates.push(cache[cart.id]);
				shippingStatus = {
					...shippingStatus,
					total: shippingStatus.total + 1,
					complete: shippingStatus.complete + 1,
				};
			}

			res.send({ shippingStatus, shippingRates });
		} catch (e) {
			res.status(500).send(e.message);
		}
	});

	router.post("/contact", async (req, res) => {
		try {
			const { name, email, message, subject } = req.body;

			const sgMail = require("@sendgrid/mail");
			sgMail.setApiKey(parsedEnv.SENDGRID_API_KEY);

			await sgMail.send({
				to: "keviny4n@hotmail.com",
				from: process.env.sendgrid_from,
				subject: subject,
				text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
			});

			res.json({ message: "Contact form submitted successfully" });
		} catch (error) {
			console.error("Error sending email:", error);
			res.status(500).json({ error: "An error occurred while sending the email" });
		}
	});
}
