class NotificationSubscriber {
	constructor({ notificationService }) {
		notificationService.subscribe("order.placed", "sendgrid");
		notificationService.subscribe("customer.password_reset", "sendgrid");
	}
}

export default NotificationSubscriber;
