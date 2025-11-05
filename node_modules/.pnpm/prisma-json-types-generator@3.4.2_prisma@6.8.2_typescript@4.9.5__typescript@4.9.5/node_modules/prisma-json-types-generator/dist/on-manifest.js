"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onManifest = onManifest;
const { version } = require('../package.json');
/** Generates simple metadata for this generator. */
function onManifest() {
    return {
        version,
        // TODO: We should change this to the real output of the generator in some way. But we cannot get its real output here
        // because we need to await the prisma client to be generated first.
        defaultOutput: './',
        prettyName: 'Prisma Json Types Generator'
    };
}
//# sourceMappingURL=on-manifest.js.map