import { Response } from "express";

export function decorateResponse<T>(res: Response, fn: (data: T) => Promise<any>) {
	const json = res.json;
	res.json = (async (response) => {
		res.json = json;
		const decoratedResponse = await fn(response);
		res.json(decoratedResponse);
	}) as any;
}
