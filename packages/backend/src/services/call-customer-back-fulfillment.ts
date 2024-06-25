import { Cart } from "@medusajs/medusa";
import axios from "axios";
import { FulfillmentService } from "medusa-interfaces";

class CallCustomerBackFulfillment extends FulfillmentService {
	static identifier = "callback";

	constructor(container, options) {
		super();
	}

	async getFulfillmentOptions() {
		return [
			{
				id: "callback",
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
		return 0;
	}

	async createReturn(returnOrder) {
		return {};
	}

	async cancelFulfillment(fulfillment) {
		return {};
	}
}

export default CallCustomerBackFulfillment;
