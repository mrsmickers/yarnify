"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleModelPayload = handleModelPayload;
const tslib_1 = require("tslib");
const typescript_1 = tslib_1.__importDefault(require("typescript"));
const error_1 = require("../util/error");
const replace_object_1 = require("./replace-object");
/** Replacer responsible for the main <Model>Payload type. */
function handleModelPayload(typeAlias, writer, model, config) {
    const type = typeAlias.type;
    if (type.kind !== typescript_1.default.SyntaxKind.TypeLiteral) {
        throw new error_1.PrismaJsonTypesGeneratorError('Provided model payload is not a type literal', {
            type: type.getText()
        });
    }
    const scalarsField = type.members.find((m) => m.name?.getText() === 'scalars');
    // Currently, there are 4 possible fields in the <model>Payload type:
    // - `scalars` field, which is what we mainly change
    // - `objects` are just references to other fields in which we change separately
    // - `name` and `composites` we do not have to change
    if (!scalarsField) {
        return;
    }
    // Gets the inner object type we should change.
    // scalars format is: $Extensions.GetResult<OBJECT, ExtArgs["result"]["user"]>
    // this is the OBJECT part
    const object = (model.type === 'model' ? scalarsField?.type?.typeArguments?.[0] : scalarsField?.type);
    if (!object) {
        throw new error_1.PrismaJsonTypesGeneratorError('Payload scalars could not be resolved', {
            type: type.getText()
        });
    }
    // Replaces this object
    return (0, replace_object_1.replaceObject)(object, writer, model, config);
}
//# sourceMappingURL=model-payload.js.map