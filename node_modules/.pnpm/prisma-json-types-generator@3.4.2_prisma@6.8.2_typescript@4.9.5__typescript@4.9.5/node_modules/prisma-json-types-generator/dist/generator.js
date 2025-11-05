"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generator_helper_1 = require("@prisma/generator-helper");
const on_generate_1 = require("./on-generate");
const on_manifest_1 = require("./on-manifest");
// Defines the entry point of the generator.
(0, generator_helper_1.generatorHandler)({
    onManifest: on_manifest_1.onManifest,
    onGenerate: on_generate_1.onGenerate
});
//# sourceMappingURL=generator.js.map