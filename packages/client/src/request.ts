import { parseReviver, ServerError, serverErrorName, stringifyReplacer } from "@mongalayer/core";
import { ClientOptions } from "./client";
import { MongalayerAPIError } from "./error";

export const request = async (url: URL, body: any, clientOptions: ClientOptions, context?: any): Promise<any> => {    
    if (context !== void 0) {
        url.searchParams.append("context", btoa(JSON.stringify(context, stringifyReplacer)));
    }

    const requestInit: RequestInit = {
        method: "POST",
        body: JSON.stringify(body, stringifyReplacer)
    }

    if (clientOptions.headers !== void 0) requestInit.headers = clientOptions.headers instanceof Function ? await clientOptions.headers() : clientOptions.headers;
    if (clientOptions.credentials !== void 0) requestInit.credentials = clientOptions.credentials;

    if (window.MONGALAYER_DRY_RUN === true) {
        console.log("MONGALAYER_DRY_RUN is enabled. The following request would have been sent:", JSON.stringify({ url: url.toString(), body, options: clientOptions, context }));
    }

    const request = window.MONGALAYER_DRY_RUN === true ? { ok: true, status: 200, text: async () => "{}" } : fetch(url, requestInit);

    try {
        const response = await request;
        const responseText = await response.text();

        if (response.ok) {
            return JSON.parse(responseText, parseReviver);
        } else {
            const mongalayerErrorRegex = new RegExp(`"name":"${serverErrorName}"`);
            if (mongalayerErrorRegex.test(responseText)) {
                throw ServerError.fromJSON(responseText);
            } else {
                throw new MongalayerAPIError(response.status, responseText);
            }
        }
    } catch (e) {
        if (e instanceof MongalayerAPIError || e instanceof ServerError) {
            throw e;
        }

        throw new Error("Failed to fetch", { cause: e });
    }
}