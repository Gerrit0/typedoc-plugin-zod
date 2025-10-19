import z from "zod";

/**
 * Schema with describe() call
 */
export const userSchema = z.object({
    name: z.string().describe("The user's full name"),
    email: z.string().email().describe("The user's email address"),
    age: z.number().optional().describe("The user's age in years"),
}).describe("User information schema");

/**
 * Type inferred from schema with descriptions
 */
export type User = z.infer<typeof userSchema>;

// Test chained describe
export const configSchema = z.object({
    host: z.string(),
    port: z.number(),
}).describe("Server configuration settings");

export type Config = z.infer<typeof configSchema>;

// Test describe on different positions
export const productSchema = z.object({
    id: z.string(),
    name: z.string(),
    price: z.number().positive(),
}).optional().describe("Product information");

export type Product = z.infer<typeof productSchema>;
