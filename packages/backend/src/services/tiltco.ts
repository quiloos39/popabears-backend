import { Cart, Logger } from "@medusajs/medusa";
import axios from "axios";
import { FulfillmentService } from "medusa-interfaces";
import qs from "qs";
import { inspect } from "util";

class TiltCoFulfillmentService extends FulfillmentService {
	static identifier = "tiltco";
	private logger: Logger;
	constructor(container, _options) {
		super();
		this.logger = container.logger;
	}

	async getFulfillmentOptions() {
		return [
			{
				id: "standard",
			},
		];
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

			const SALES_CHANNEL_POSTAL_CODES = {
				sc_01H54KV0V84HGG6PZD06T3J8C4: "2090 Flos Rd 10 EElmvale, ON L0L 1P0, Canada", // "Value Barrie"
				sc_01H54KTSHXG7TYSRN9XND4HHQB: "1341 Rue PrincipaleSainte-Julie, QC J3E 0C4, Canada", // Value Sainte Julie
			};

			console.log(`Following postal codes are available: ${inspect(SALES_CHANNEL_POSTAL_CODES, false, null, true)}`);

			const originAddress = SALES_CHANNEL_POSTAL_CODES[cart.sales_channel_id] || Object.values(SALES_CHANNEL_POSTAL_CODES)[0];

			console.log(`For cart id: ${cart.id}, using ${originAddress} as origin postal code`);

			if (!shipping_address) {
				throw new Error("Missing shipping address");
			}

			type DistanceMatrix = {
				destination_addresses: string[];
				origin_addresses: string[];
				rows: {
					elements: {
						distance: {
							text: string;
							value: number;
						};
						duration: {
							text: string;
							value: number;
						};
						duration_in_traffic: {
							text: string;
							value: number;
						};
					}[];
				}[];
			};

			const queryData = {
				departure_time: "now",
				origins: originAddress,
				destinations: `${shipping_address.postal_code} Canada`,
				key: process.env.GOOGLE_API_KEY,
			};

			console.log(`Querying Google Maps API with ${inspect(queryData, false, null, true)}`);

			const distanceMatrix = await axios
				.get(`https://maps.googleapis.com/maps/api/distancematrix/json?${qs.stringify(queryData)}`)
				.then((res) => res.data as DistanceMatrix);

			console.log(`Google Maps API returned ${inspect(distanceMatrix, false, null, true)}`);

			if (distanceMatrix.rows.length === 0) {
				throw new Error("No distance matrix rows returned");
			}

			const { elements } = distanceMatrix.rows[0];
			const element = elements[0];

			if (!element) {
				throw new Error("No elements returned");
			}

			const { duration_in_traffic } = element;

			const seconds = duration_in_traffic.value;
			const minutes = seconds / 60;
			const hours = Math.ceil(minutes / 60);

			const quantity = cart.items.reduce((acc, item) => acc + item.quantity, 0);
			const amountTrucks = Math.ceil(quantity / 2);
			console.log(`Calculated ${amountTrucks} trucks for cart id: ${cart.id}`);

			const price = hours * 350 * amountTrucks;

			console.log(`Calculated ${hours} hours for cart id: ${cart.id}`);
			console.log(`Calculated ${price} CA$ price for cart id: ${cart.id}`);

			if (price <= 250) {
				return 250 * 100;
			}

			return price * 100;
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

export default TiltCoFulfillmentService;
