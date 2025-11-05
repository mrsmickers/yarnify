'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function createZodDto(schema) {
  class AugmentedZodDto {
    static create(input) {
      return this.schema.parse(input);
    }
  }
  AugmentedZodDto.isZodDto = true;
  AugmentedZodDto.schema = schema;
  return AugmentedZodDto;
}
function isZodDto(metatype) {
  return metatype == null ? void 0 : metatype.isZodDto;
}

exports.createZodDto = createZodDto;
exports.isZodDto = isZodDto;
