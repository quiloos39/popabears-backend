import { AbstractNotificationService, OrderService, PricingService, TotalsService } from "@medusajs/medusa";
import { EntityManager } from "typeorm";
import { parsedEnv } from "../../medusa-config";
import * as SendGrid from "@sendgrid/mail";
import fs from "fs";
import path = require("path");
import HandleBars from "handlebars";
import moment from "moment";

type ReturnedData = {
	to: string;
	status: string;
	data: Record<string, unknown>;
};

type CustomerPasswordReset = (
	event: "customer.password_reset",
	data: {
		id: string;
		email: string;
		first_name: string;
		last_name: string;
		token: string;
	},
	attachmentGenerator: unknown,
) => Promise<ReturnedData>;

type OrderPlaced = (
	event: "order.placed",
	data: {
		id: string;
		no_notification: boolean;
	},
	attachmentGenerator: unknown,
) => Promise<ReturnedData>;

type SendNotification = CustomerPasswordReset | OrderPlaced;

class SendGridService extends AbstractNotificationService {
	static identifier = "sendgrid";
	private client: typeof SendGrid;
	private orderService_: OrderService;
	private totalsService_: TotalsService;

	constructor(container, options) {
		super(container, options);
		const sgMail = require("@sendgrid/mail");
		sgMail.setApiKey(parsedEnv.SENDGRID_API_KEY);
		this.client = sgMail;
		this.orderService_ = container.orderService;
		this.totalsService_ = container.totalsService;
	}

	sendNotification: SendNotification = async (event, data, attachmentGenerator) => {
		if (event === "customer.password_reset") {
			const template = this._templateLoader(event);
			const html = template(data);
			const r = await this.client.send({
				to: data.email,
				from: parsedEnv.SENDGRID_FROM,
				subject: "Password Reset",
				html,
			});
			console.log(r);
			return {
				data,
				status: "success",
				to: data.email,
			};
		} else if (event === "order.placed") {
			const order = await this.orderService_.retrieve(data.id, {
				select: ["shipping_total", "discount_total", "tax_total", "refunded_total", "gift_card_total", "subtotal", "total"],
				relations: [
					"customer",
					"billing_address",
					"shipping_address",
					"discounts",
					"discounts.rule",
					"shipping_methods",
					"shipping_methods.shipping_option",
					"payments",
					"fulfillments",
					"returns",
					"gift_cards",
					"gift_card_transactions",
				],
			});

			console.log(order);

			const templateData = {
				id: order.id,
				first_name: order.shipping_address?.first_name,
				last_name: order.shipping_address?.last_name,
				date: moment(order.created_at).format("MMMM Do YYYY"),
				items: order.items.map((item) => ({
					title: item.title,
					quantity: item.quantity,
					thumbnail: item.thumbnail,
					unit_price: `${(item.unit_price / 100).toFixed(2)} ${order.currency_code.toUpperCase()}`,
				})),
				subtotal: `${(order.subtotal / 100).toFixed(2)} ${order.currency_code.toUpperCase()}`,
				shipping_total: `${(order.shipping_total / 100).toFixed(2)} ${order.currency_code.toUpperCase()}`,
				tax_total: `${(order.tax_total / 100).toFixed(2)} ${order.currency_code.toUpperCase()}`,
				total: `${(order.total / 100).toFixed(2)} ${order.currency_code.toUpperCase()}`,
				address:
					order.shipping_address?.address_1 +
					" " +
					order.shipping_address?.address_2 +
					" " +
					order.shipping_address?.city +
					" " +
					order.shipping_address?.postal_code,
			};

			const template = this._templateLoader(event);
			const html = template(templateData);
			await this.client.send({
				to: order.email,
				from: parsedEnv.SENDGRID_FROM,
				subject: "Order Placed",
				html,
			});

			return {
				data: {
					...order,
				},
				status: "success",
				to: order.email,
			};
		}
		throw new Error(`Event ${event} not implemented`);
	};

	_templateLoader = (event: Parameters<SendNotification>["0"]) => {
		const html = fs.readFileSync(path.join(__dirname, "../../../mail/build_production", `${event}.hbs`), "utf8");
		return HandleBars.compile(html);
	};

	resendNotification: AbstractNotificationService["resendNotification"] = async (notification, config, attachmentGenerator) => {
		throw new Error("Method not implemented.");
	};
}

export default SendGridService;
