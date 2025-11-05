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

export { createZodDto, isZodDto };
