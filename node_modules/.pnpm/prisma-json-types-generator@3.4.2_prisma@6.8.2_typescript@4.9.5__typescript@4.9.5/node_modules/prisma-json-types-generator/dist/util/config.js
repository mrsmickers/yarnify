"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseConfig = parseConfig;
function parseConfig(config) {
    return {
        namespace: config.namespace ? String(config.namespace) : 'PrismaJson',
        // This gets overwritten in the generator
        clientOutput: config.clientOutput ? String(config.clientOutput) : undefined,
        useType: config.useType ? String(config.useType) : undefined,
        allowAny: config.allowAny ? String(config.allowAny).toLowerCase().trim() === 'true' : false
    };
}
//# sourceMappingURL=config.js.map