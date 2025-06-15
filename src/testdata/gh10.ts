import { z } from "zod/v4";

export const abc = z.object({
    inner: z.object({
        arr: z.array(z.number()),
    }),
});

export type InferAbc = z.infer<typeof abc>;
export type TypeOfAbc = z.TypeOf<typeof abc>;
