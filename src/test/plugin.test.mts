import { outdent } from "outdent";
import {
    Application,
    Comment,
    DeclarationReflection,
    normalizePath,
    ProjectReflection,
    ReflectionType,
    TSConfigReader,
    TypeScript as ts,
} from "typedoc";
import { beforeAll, expect, test } from "vitest";
import { load } from "../plugin.js";

let app: Application;
let program: ts.Program;

function convert(entry: string) {
    const sourceFile = program.getSourceFile(
        `${process.cwd()}/src/testdata/${entry}`.replace(/\\/g, "/"),
    )!;

    return app.converter.convert([
        {
            displayName: entry,
            program,
            sourceFile,
        },
    ]);
}

beforeAll(async () => {
    app = await Application.bootstrap(
        {
            entryPoints: ["src/testdata/infer.ts"],
        },
        [new TSConfigReader()],
    );
    load(app);

    const entryPoints = app.getEntryPoints();
    expect(entryPoints).toBeDefined();
    program = entryPoints![0].program;
});

test("infer.ts", () => {
    const project = convert("infer.ts");
    const typeDeclaration = project.getChildByName(
        "Abc",
    ) as DeclarationReflection;
    expect(typeDeclaration.toStringHierarchy()).toBe(outdent`
        TypeAlias Abc: { def: string; opt?: string; other: { arr: number[] }; prop: string }
          TypeLiteral __type
            Property def: string
            Property opt: string
            Property other: { arr: number[] }
              TypeLiteral __type
                Property arr: number[]
            Property prop: string
    `);

    const schemaDeclaration = project.getChildByName(
        "abc",
    ) as DeclarationReflection;
    expect(schemaDeclaration.toStringHierarchy()).toBe(
        "Variable abc: ZodObject<Abc>",
    );

    expect(
        (typeDeclaration.type as ReflectionType)!.declaration!.getChildByName(
            "def",
        )!.flags.isOptional,
    ).toBe(false);
});

test("input.ts", () => {
    const project = convert("input.ts");
    const typeDeclaration = project.getChildByName(
        "Abc",
    ) as DeclarationReflection;
    expect(typeDeclaration.toStringHierarchy()).toBe(outdent`
        TypeAlias Abc: { def?: string; opt?: string; other: { arr: number[] }; prop: string }
          TypeLiteral __type
            Property def: string
            Property opt: string
            Property other: { arr: number[] }
              TypeLiteral __type
                Property arr: number[]
            Property prop: string
    `);

    const schemaDeclaration = project.getChildByName(
        "abc",
    ) as DeclarationReflection;
    expect(schemaDeclaration.toStringHierarchy()).toBe(
        "Variable abc: ZodObject<Abc>",
    );

    expect(
        (typeDeclaration.type as ReflectionType)!.declaration!.getChildByName(
            "def",
        )!.flags.isOptional,
    ).toBe(true);
});

test("Schemas which have multiple declarations, #2", () => {
    const project = convert("gh2.ts");

    expect(project.toStringHierarchy()).toBe(outdent`
        Project typedoc-plugin-zod
          TypeAlias Foo: { a: string; b: number; c?: unknown }
            TypeLiteral __type
              Property a: string
              Property b: number
              Property c: unknown
          Variable Foo: ZodObject<Foo>
    `);
});

test("Serialized/deserialized projects do not create warnings, #6", () => {
    const project = convert("gh6.ts");
    const ser = app.serializer.projectToObject(project, normalizePath(process.cwd()));
    app.deserializer.reviveProject("gh6", ser, {
        projectRoot: normalizePath(process.cwd()),
        registry: project.files,
    });

    expect(project.toStringHierarchy()).toBe(outdent`
        Project typedoc-plugin-zod
          TypeAlias Foo: { a: string; b: number; c?: unknown }
            TypeLiteral __type
              Property a: string
              Property b: number
              Property c: unknown
          Variable Foo: ZodObject<Foo>
    `);

    expect(app.logger.hasWarnings()).toBe(false);
});

test("Comments on type aliases, #7", () => {
    const project = convert("gh7.ts");

    expect(project.toStringHierarchy()).toBe(outdent`
        Project typedoc-plugin-zod
          TypeAlias Bar: { b: string }
            TypeLiteral __type
              Property b: string
          TypeAlias Foo: { a: string }
            TypeLiteral __type
              Property a: string
          Variable Bar: ZodObject<Bar>
          Variable Foo: ZodObject<Foo>
    `);

    const comments = ["Bar type docs", "Foo docs", "Bar docs", "Foo docs"];
    const actualComments = project.children?.map((c) => Comment.combineDisplayParts(c.comment?.summary));
    expect(actualComments).toEqual(comments);
});

test("Support for Zod version 4, #10", () => {
    const project = convert("gh10.ts");

    console.log(project.toStringHierarchy());

    expect(project.toStringHierarchy()).toBe(outdent`
      Project typedoc-plugin-zod
        TypeAlias InferAbc: { inner: { arr: number[] } }
          TypeLiteral __type
            Property inner: { arr: number[] }
              TypeLiteral __type
                Property arr: number[]
        TypeAlias TypeOfAbc: { inner: { arr: number[] } }
          TypeLiteral __type
            Property inner: { arr: number[] }
              TypeLiteral __type
                Property arr: number[]
        Variable abc: ZodObject<TypeOfAbc>
    `);
});

test("Extract .describe() from Zod schemas", () => {
    const project = convert("describe.ts");

    // Check that the User type has the description from userSchema.describe()
    const userType = project.getChildByName("User") as DeclarationReflection;
    expect(userType).toBeDefined();
    expect(userType.comment?.summary).toBeDefined();
    const userComment = Comment.combineDisplayParts(userType.comment?.summary);
    expect(userComment).toContain("User information schema");

    // Check property descriptions for User type
    if (userType.type?.type === "reflection" && (userType.type as any).declaration) {
        const userDecl = (userType.type as any).declaration;
        const nameField = userDecl.getChildByName("name");
        expect(nameField).toBeDefined();
        const nameComment = Comment.combineDisplayParts(nameField?.comment?.summary);
        expect(nameComment).toContain("The user's full name");

        const emailField = userDecl.getChildByName("email");
        expect(emailField).toBeDefined();
        const emailComment = Comment.combineDisplayParts(emailField?.comment?.summary);
        expect(emailComment).toContain("The user's email address");
    }

    // Check that the Config type has the description from configSchema.describe()
    const configType = project.getChildByName("Config") as DeclarationReflection;
    expect(configType).toBeDefined();
    const configComment = Comment.combineDisplayParts(configType.comment?.summary);
    expect(configComment).toContain("Server configuration settings");

    // Check that the Product type has the description from productSchema.describe()
    const productType = project.getChildByName("Product") as DeclarationReflection;
    expect(productType).toBeDefined();
    const productComment = Comment.combineDisplayParts(productType.comment?.summary);
    expect(productComment).toContain("Product information");
});
