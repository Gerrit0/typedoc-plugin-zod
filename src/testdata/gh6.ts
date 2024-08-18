import { number, object, string, TypeOf, unknown } from "zod";

export const Foo = object({
    a: string(),
    b: number(),
    c: unknown(),
});

export type Foo = TypeOf<typeof Foo>;
