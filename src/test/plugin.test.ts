import outdent from "outdent";
import {
    Application,
    DeclarationReflection,
    ProjectReflection,
    TSConfigReader,
} from "typedoc";
import { test, expect, beforeAll } from "vitest";
import { load } from "../plugin";

let project: ProjectReflection;

beforeAll(async () => {
    const app = await Application.bootstrap(
        {
            entryPoints: ["src/testdata/infer.ts"],
        },
        [new TSConfigReader()],
    );
    load(app);

    project = (await app.convert())!;
    expect(project).toBeDefined();
});

test("infer.ts", () => {
    const typeDeclaration = project.getChildByName(
        "Abc",
    ) as DeclarationReflection;
    expect(typeDeclaration.toStringHierarchy()).toBe(outdent`
        TypeAlias Abc:Object
          TypeLiteral __type
            Property opt:string
            Property other:{ arr: number[]; }
            Property prop:string
    `);

    const schemaDeclaration = project.getChildByName(
        "abc",
    ) as DeclarationReflection;
    expect(schemaDeclaration.toStringHierarchy()).toBe(
        "Variable abc:ZodObject<Abc>",
    );
});
