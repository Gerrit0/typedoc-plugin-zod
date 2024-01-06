import z from "zod";

/**
 * An example zod object for demonstration. This is declared as:
 *
 * ```ts
 * export const abc = zod.object({
 *     prop: z.string(),
 *     other: zod.object({
 *         arr: zod.array(zod.number()),
 *     }),
 *     opt: z.string().optional(),
 *     def: z.string().default('abc')
 * });
 * ```
 */
export const abc = z.object({
    prop: z.string(),
    other: z.object({
        arr: z.array(z.number()),
    }),
    opt: z.string().optional(),
    def: z.string().default("abc"),
});

/**
 * Exported type alias which infers its input type using the {@link abc} schema.
 *
 * This is declared as:
 * ```ts
 * export type Abc = zod.input<typeof abc>;
 * ```
 */
export type Abc = z.input<typeof abc>;
