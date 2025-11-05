"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaJsonTypesGeneratorError = void 0;
/**
 * Simple error to throw when something goes wrong. Simply wraps the message to help
 * identify whether the error is from this package or not.
 */
class PrismaJsonTypesGeneratorError extends Error {
    constructor(message, data) {
        super(message);
        Object.assign(this, data);
    }
    // TODO: Better handler? investigate how to handle errors in the best way.
    static handler(error) {
        console.error(error);
    }
}
exports.PrismaJsonTypesGeneratorError = PrismaJsonTypesGeneratorError;
//# sourceMappingURL=error.js.map