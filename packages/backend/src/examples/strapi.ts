import { ProductCategoryRepository } from "@medusajs/medusa/dist/repositories/product-category";
import { AwilixContainer } from "awilix";
import axios from "axios";
export default async (container: AwilixContainer, config: Record<string, unknown>): Promise<void> => {
	const productCategoryRepository = container.resolve<typeof ProductCategoryRepository>("productCategoryRepository");
	const productCategories = await productCategoryRepository.find({}).then((res) =>
		res.map((category) => ({
			name: category.name,
			id: category.id,
		})),
	);
	await axios.post("http://localhost:1337/api/product-categories/bulk", productCategories);
};
