import { Cart, Logger, ProductService } from "@medusajs/medusa";
import axios, { AxiosInstance } from "axios";
import { FulfillmentService } from "medusa-interfaces";
import moment from "moment";
import { inspect } from "util";

class FreightcomFulfillmentService extends FulfillmentService {
	static identifier = "ltlco";
	private productService: ProductService;
	private client: AxiosInstance;
	private logger: Logger;

	constructor(container, _options) {
		super();
		this.productService = container.productService;
		this.client = axios.create({
			baseURL: "https://external-api.freightcom.com",
			headers: {
				Authorization: process.env.FREIGHTCOM_API_KEY,
			},
		});
		this.logger = container.logger;
	}

	async getFulfillmentOptions() {
		console.log("Getting fulfillment options");
		type Service = {
			id: string;
			carrier_name: string;
			service_name: string;
		};

		const availableServices = await this.client
			.get("/services")
			.then((res) => res.data as Service[])
			.then((res) => res.map((service) => ({ id: service.id })))
			.catch((e) => {
				this.logger.error(e.message);
				return [] as Service[];
			});

		console.log(`${availableServices.length} services are available`);
		return [...availableServices];
	}

	async validateOption(data) {
		return true;
	}

	async validateFulfillmentData(optionData, data, cart) {
		return {
			...data,
		};
	}

	async createFulfillment(methodData, fulfillmentItems, fromOrder, fulfillment) {
		// No data is being sent anywhere
		// No data to be stored in the fulfillment's data object
		return {};
	}

	canCalculate(data) {
		return true;
	}

	async calculatePrice(optionData, data, cart: Cart) {
		try {
			console.log(`Attempting to calculating fulfillment price for cart id: ${cart.id}`);

			const { shipping_address } = cart;

			const destinationPostalCode = shipping_address?.postal_code;

			if (!destinationPostalCode) {
				throw new Error("Missing destination postal code");
			}

			const SALES_CHANNEL_POSTAL_CODES = {
				sc_01GY1TR8XSSA865FXVJDQR9XCZ: "H2K 4P5", // "Value Products"
				sc_01H54KV0V84HGG6PZD06T3J8C4: "L0L 1P0", // "Value Barrie"
				sc_01H54KTSHXG7TYSRN9XND4HHQB: "J3E 0C4", // Value Sainte Julie
			};

			console.log(`Following postal codes are available: ${inspect(SALES_CHANNEL_POSTAL_CODES, false, null, true)}`);

			const originPostalCode = SALES_CHANNEL_POSTAL_CODES[cart.sales_channel_id] || Object.values(SALES_CHANNEL_POSTAL_CODES)[0];

			console.log(`For cart id: ${cart.id}, using ${originPostalCode} as origin postal code`);
			console.log(`For cart id: ${cart.id} using ${destinationPostalCode} as destination postal code`);

			const productService = this.productService;

			const items = [];

			for (let item of cart.items) {
				console.log(`Retrieving product ${item.variant.product_id} for line item ${item.id}`);
				const product = await productService.retrieve(item.variant.product_id);
				items.push({
					id: item.product_id,
					weight: product.weight,
					length: product.length,
					width: product.width,
					height: product.height,
					quantity: item.quantity,
				});
			}

			console.log(`For cart id: ${cart.id}, items are: ${inspect(items, false, null, true)}`);

			for (let item of items) {
				if (!item.weight) {
					throw new Error(`Missing weight for product ${item.id}`);
				}
				if (!item.length) {
					throw new Error(`Missing length for product ${item.id}`);
				}
				if (!item.width) {
					throw new Error(`Missing width for product ${item.id}`);
				}
				if (!item.height) {
					throw new Error(`Missing height for product ${item.id}`);
				}
				// Around 96 inches max height for LTL shipping - (minus) %10 percentage
				// if (item.height > 2000) {
				// 	throw new Error(`Height of product ${item.id} is too large`);
				// }
			}

			const deliveryDate = moment().add(7, "days");
			const [day, month, year] = deliveryDate.format("DD MM YYYY").split(" ");

			console.log(`For cart id: ${cart.id}, delivery date is ${deliveryDate.format("DD MM YYYY")}`);

			const rateData = {
				services: [optionData.id],
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
						pallets: items.flatMap((item) => {
							const items = [];
							for (let i = 0; i < item.quantity; i++) {
								items.push({
									measurements: {
										weight: {
											unit: "g",
											value: item.weight,
										},
										cuboid: {
											unit: "mm",
											l: item.length,
											w: item.width,
											h: item.height,
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

			console.log(`For cart id: ${cart.id}, rate data: ${inspect(rateData, false, null, true)}`);

			console.log(`For cart id: ${cart.id} Sending rate id api`);
			const rateId = await this.client.post("/rate", rateData).then((res) => res.data.request_id as string);
			console.log(`For cart id: ${cart.id} Received rate id: ${rateId}`);

			type RateResponse = {
				status: {
					done: boolean;
					total: number;
					complete: number;
				};
				rates: {
					service_id: string;
					valid_until: {
						year: number;
						month: number;
						day: number;
					};
					total: {
						value: string;
						currency: string;
					};
					base: {
						value: string;
						currency: string;
					};
					surcharger: {
						type: string;
						amount: {
							value: string;
							currency: string;
						};
					}[];
					taxes: {
						type: string;
						amount: {
							value: string;
							currency: string;
						};
					}[];
					transit_time_days: number;
					carrier_name: string;
					service_name: string;
				}[];
			};

			console.log(`For cart id: ${cart.id} Waiting for rates to be available`);
			// const startTime = Date.now();
			const rates: RateResponse["rates"] = await new Promise((resolve) => {
				const timer = setInterval(async () => {
					const response = await this.client.get("/rate/" + rateId).then((res) => res.data);
					console.log(`For cart id: ${cart.id} waiting for rates to be available ${inspect(response.status, false, null, true)}`);
					// if it exceed 5 seconds return empty array
					// if (Date.now() - startTime > 5000) {
					// 	clearInterval(timer);
					// 	resolve([]);
					// }
					if (response.status.done) {
						clearInterval(timer);
						resolve(response.rates);
					}
				}, 1000);
			});

			console.log(`For cart id: ${cart.id} Received rates: ${inspect(rates, false, null, true)}`);

			if (rates.length === 0) {
				throw new Error("No rates found");
			}

			console.log(`For cart id: ${cart.id} Finding lowest rate`);

			const rate = rates[0];

			if (!rate) {
				throw new Error("No rate found");
			}

			console.log(`For cart id: ${cart.id} Rate is ${inspect(rate, false, null, true)}`);

			return Math.floor(Number(rate.total.value) * 1.15);
		} catch (e) {
			console.error(e);
			throw e;
		}
	}

	async createReturn(returnOrder) {
		return {};
	}

	async cancelFulfillment(fulfillment) {
		return {};
	}
}

export default FreightcomFulfillmentService;
