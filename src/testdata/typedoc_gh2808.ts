// See https://github.com/TypeStrong/typedoc/issues/2808

import { z } from "zod";

export const foo = {
    /** foo a property */
    a: "",
    /** foo b property */
    b: "",
};
export type FooType = typeof foo;
/** @useDeclaredType */
export type FooTypeDT = typeof foo;
export type FooExplicit = {
    /** FooExplicit a property */
    a: string;
    /** FooExplicit b property */
    b: string;
};
export const zfoo = z.object({
    /** ZodFoo a property */
    a: z.string(),
    /** ZodFoo b property */
    b: z.string(),
});
export type ZodFoo = z.infer<typeof zfoo>;
/** @useDeclaredType */
export type ZodFooDT = z.infer<typeof zfoo>;

/**
 * Link Tests
 *
 * {@link foo} | {@link foo.a}
 *
 * {@link FooType} | {@link FooType.a}
 *
 * {@link FooTypeDT} | {@link FooTypeDT.a}
 *
 * {@link FooExplicit} | {@link FooExplicit.a}
 *
 * {@link ZodFoo} | {@link ZodFoo#a}
 *
 * {@link ZodFooDT} | {@link ZodFooDT#a}
 */
export const doSomething = () => {};

const CollectionConfigSchema = z.object({
    /**
     * base property
     *
     * Link to Options.collections property - {@link Options#collections collections}
     *
     * Link to Options.collectionBase - {@link Options#collectionBase collectionBase}
     *
     * Link to CollectionConfig.base - {@link CollectionConfig#base base}
     *
     * Link to CollectionConfig.name - {@link CollectionConfig#name name}
     */
    base: z.string().optional(),
    name: z.string().optional(),
});

const OptionsSchema = z.object({
    /**
     * collectionBase property
     *
     * Link to Options.collections property - {@link Options#collections collections}
     *
     * Link to Options.collectionBase - {@link Options#collectionBase collectionBase}
     *
     * Link to CollectionConfig.base - {@link CollectionConfig#base base}
     *
     * Link to CollectionConfig.name - {@link CollectionConfig#name name}
     */
    collectionBase: z.string().optional(),
    // Problem happens with this line
    collections: z.record(CollectionConfigSchema).default({}),
    // But does not happen with this line
    // collections: z.record(z.object({ base: z.string().optional(), name: z.string().optional()})).default({}),
    base: z.string().optional(),
});

export interface Options extends z.input<typeof OptionsSchema> {}
export interface CollectionConfig extends z.input<typeof CollectionConfigSchema> {}
