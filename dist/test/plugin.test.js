"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const outdent_1 = __importDefault(require("outdent"));
const typedoc_1 = require("typedoc");
const vitest_1 = require("vitest");
const plugin_1 = require("../plugin");
let project;
(0, vitest_1.beforeAll)(() => {
    const app = new typedoc_1.Application();
    app.options.addReader(new typedoc_1.TSConfigReader());
    app.bootstrap({
        entryPoints: ["src/testdata/infer.ts"],
    });
    (0, plugin_1.load)(app);
    project = app.convert();
    (0, vitest_1.expect)(project).toBeDefined();
});
(0, vitest_1.test)("infer.ts", () => {
    const typeDeclaration = project.getChildByName("Abc");
    (0, vitest_1.expect)(typeDeclaration.toStringHierarchy()).toBe((0, outdent_1.default) `
        TypeAlias Abc:Object
          TypeLiteral __type
            Property other:{ arr: number[]; }
            Property prop:string
    `);
    const schemaDeclaration = project.getChildByName("abc");
    (0, vitest_1.expect)(schemaDeclaration.toStringHierarchy()).toBe("Variable abc:ZodObject<Abc>");
});
