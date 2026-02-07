declare class XSAIError extends Error {
    response?: Response;
    constructor(message: string, response?: Response, cause?: unknown);
}

type Fetch = (input: URL, init: RequestInit) => Promise<Response>;

interface CommonRequestOptions {
    abortSignal?: AbortSignal;
    apiKey?: string;
    /** @example `https://api.openai.com/v1/` */
    baseURL: string | URL;
    fetch?: Fetch | typeof globalThis.fetch;
    /** @default `undefined` */
    headers?: Headers | Record<string, string>;
    /** @example `gpt-4o` */
    model: string;
}

type WithUnknown<T> = T & {
    [key: string]: unknown;
};

declare const strCamelToSnake: (str: string) => string;
declare const objCamelToSnake: (obj: Record<string, unknown>) => {
    [k: string]: unknown;
};

/**
 * Clean all undefined values.
 * @param obj object
 * @returns cleaned object
 *
 * @example
 * ```ts
 * import { clean } from '@xsai/shared'
 *
 * // { a: 'a' }
 * const obj = clean({
 *   a: 'a',
 *   b: undefined
 * })
 * ```
 */
declare const clean: <T extends Record<string, undefined | unknown>>(obj: T) => Record<keyof T, Exclude<T[keyof T], unknown>>;

declare class DelayedPromise<T> {
    get promise(): Promise<T>;
    private _promise;
    private _reject;
    private _resolve;
    private status;
    reject(error: unknown): void;
    resolve(value: T): void;
}

declare const requestBody: (body: Record<string, unknown>) => string;

declare const requestHeaders: (headers?: CommonRequestOptions["headers"], apiKey?: CommonRequestOptions["apiKey"]) => Record<"Authorization", never>;

declare const requestURL: (path: string, baseURL: string | URL) => URL;

declare const responseCatch: (res: Response) => Promise<Response>;

declare const responseJSON: <T>(res: Response) => Promise<T>;

type TrampolineFn<T> = (() => Promise<TrampolineFn<T>> | TrampolineFn<T>) | Promise<T> | T;
declare const trampoline: <T>(fn: () => Promise<TrampolineFn<T>> | TrampolineFn<T>) => Promise<T>;

export { DelayedPromise, XSAIError, clean, objCamelToSnake, requestBody, requestHeaders, requestURL, responseCatch, responseJSON, strCamelToSnake, trampoline };
export type { CommonRequestOptions, Fetch, TrampolineFn, WithUnknown };
