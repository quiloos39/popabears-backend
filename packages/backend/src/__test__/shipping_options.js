const axios = require("axios");

(async () => {
	const cart = await axios
		.post("http://localhost:9000/store/carts", {
			region_id: "reg_01HEAQVPYE5P6HG5QQ522X40CD",
		})
		.then((res) => res.data.cart);

	await axios.post(`http://localhost:9000/store/carts/${cart.id}`, {
		shipping_address: {
			postal_code: "H2K 4P5",
		},
	});

	await axios.post(`http://localhost:9000/store/carts/${cart.id}/line-items`, {
		variant_id: "variant_01HEAQVQ27Q6E7G0EB6N1ZCV1Y",
		quantity: 1,
	});

	const shippingOptions = await axios
		.get(`http://localhost:9000/store/shipping-options/${cart.id}`)
		.then((res) => res.data.shipping_options);
	console.log(shippingOptions);
})();
