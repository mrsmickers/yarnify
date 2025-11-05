import { requestURL, requestHeaders, requestBody, responseCatch } from '@xsai/shared';

const generateSpeech = async (options) => (options.fetch ?? globalThis.fetch)(requestURL("audio/speech", options.baseURL), {
  body: requestBody(options),
  headers: requestHeaders({
    "Content-Type": "application/json",
    ...options.headers
  }, options.apiKey),
  method: "POST",
  signal: options.abortSignal
}).then(responseCatch).then(async (res) => res.arrayBuffer());

export { generateSpeech };
