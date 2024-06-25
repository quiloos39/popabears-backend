import axios from "axios";
import { parsedEnv } from "../../medusa-config";

export const strapiClient = axios.create({
	baseURL: parsedEnv.STRAPI_API_URL,
	headers: {
		Authorization: `Bearer ${parsedEnv.STRAPI_API_TOKEN}`,
	},
});
