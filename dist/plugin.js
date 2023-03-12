"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = void 0;
const typedoc_1 = require("typedoc");
function load(app) {
    // schema type alias -> referenced validator
    const schemaTypes = new Map();
    app.converter.on(typedoc_1.Converter.EVENT_CREATE_DECLARATION, onCreateDeclaration);
    app.converter.on(typedoc_1.Converter.EVENT_END, (context) => {
        for (const [inferredType, refOrig] of schemaTypes) {
            if (refOrig.reflection instanceof typedoc_1.DeclarationReflection &&
                refOrig.reflection.type instanceof typedoc_1.ReferenceType) {
                refOrig.reflection.type.typeArguments = [
                    typedoc_1.ReferenceType.createResolvedReference(inferredType.name, inferredType, context.project),
                ];
            }
        }
        schemaTypes.clear();
    });
    function onCreateDeclaration(context, refl) {
        if (!refl.kindOf(typedoc_1.ReflectionKind.TypeAlias) ||
            refl.type?.type !== "reference" ||
            refl.type.package !== "zod" ||
            refl.type.qualifiedName !== "TypeOf") {
            return;
        }
        const originalRef = refl.type.typeArguments?.[0]?.visit({
            query: (t) => t.queryType,
        });
        const declaration = refl.project
            .getSymbolFromReflection(refl)
            ?.getDeclarations()?.[0];
        if (!declaration)
            return;
        const type = context.getTypeAtLocation(declaration);
        refl.type = context.converter.convertType(context, type);
        if (originalRef) {
            schemaTypes.set(refl, originalRef);
        }
    }
}
exports.load = load;
