import { outdent } from "outdent";
import {
    Application,
    DeclarationReflection,
    TSConfigReader,
    TypeScript as ts,
    ReflectionType,
} from "typedoc";
import { test, expect, beforeAll } from "vitest";
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
        TypeAlias Abc: Object
          TypeLiteral __type
            Property def: string
            Property opt: string
            Property other: Object
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
        TypeAlias Abc: Object
          TypeLiteral __type
            Property def: string
            Property opt: string
            Property other: Object
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
          TypeAlias Foo: Object
            TypeLiteral __type
              Property a: string
              Property b: number
              Property c: unknown
          Variable Foo: ZodObject<Foo>
    `);
});
