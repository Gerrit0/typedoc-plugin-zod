import { object, string, TypeOf } from "zod";

/** Foo docs */
export const Foo = object({
    a: string(),
});

export type Foo = TypeOf<typeof Foo>;

/** Bar docs */
export const Bar = object({
    b: string(),
});

/** Bar type docs */
export type Bar = TypeOf<typeof Bar>;
