import z from "zod";

const SCHEMA_METADATA_KEY = "custom:schema";

export function Schema(schema: z.ZodType): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(SCHEMA_METADATA_KEY, schema, target);
  };
}

export function getSchema(target: any): z.ZodType | undefined {
  return Reflect.getMetadata(SCHEMA_METADATA_KEY, target.constructor);
}
