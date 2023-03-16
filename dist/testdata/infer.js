"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.abc = void 0;
const zod_1 = __importDefault(require("zod"));
/**
 * An example zod object for demonstration. This is declared as:
 *
 * ```ts
 * export const abc = zod.object({
 *     prop: zod.string(),
 *     other: zod.object({
 *         arr: zod.array(zod.number()),
 *     }),
 *     opt: z.string().optional(),
 * });
 * ```
 */
exports.abc = zod_1.default.object({
    prop: zod_1.default.string(),
    other: zod_1.default.object({
        arr: zod_1.default.array(zod_1.default.number()),
    }),
    opt: zod_1.default.string().optional(),
});
