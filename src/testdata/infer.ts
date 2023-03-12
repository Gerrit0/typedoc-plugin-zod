import z from "zod";

/**
 * An example zod object for demonstration. This is declared as:
 *
 * ```ts
 * export const abc = zod.object({
 *     prop: zod.string(),
 *     other: zod.object({
 *         arr: zod.array(zod.number()),
 *     }),
 * });
 * ```
 *
 * The typedoc-plugin-zod replaced
 */
export const abc = z.object({
    prop: z.string(),
    other: z.object({
        arr: z.array(z.number()),
    }),
});

/**
 * Exported type alias which infers its type using the {@link abc} schema.
 *
 * This is declared as:
 * ```ts
 * export type Abc = zod.infer<typeof abc>;
 * ```
 */
export type Abc = z.infer<typeof abc>;
