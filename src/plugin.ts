import {
    TypeScript as ts,
    type Application,
    type Context,
    Converter,
    DeclarationReflection,
    ReferenceType,
    ReflectionKind,
    makeRecursiveVisitor,
} from "typedoc";

export function load(app: Application) {
    // schema type alias -> referenced validator
    const schemaTypes = new Map<DeclarationReflection, ReferenceType>();

    app.converter.on(Converter.EVENT_CREATE_DECLARATION, onCreateDeclaration);
    app.converter.on(
        Converter.EVENT_RESOLVE_BEGIN,
        (context: Context) => {
            const typeCleanup = makeRecursiveVisitor({
                reflection: (type) => {
                    context.project.removeReflection(type.declaration);
                },
            });

            for (const [inferredType, refOrig] of schemaTypes) {
                if (
                    refOrig.reflection instanceof DeclarationReflection &&
                    refOrig.reflection.type instanceof ReferenceType
                ) {
                    refOrig.reflection.type.typeArguments?.forEach((t) =>
                        t.visit(typeCleanup),
                    );
                    refOrig.reflection.type.typeArguments = [
                        ReferenceType.createResolvedReference(
                            inferredType.name,
                            inferredType,
                            context.project,
                        ),
                    ];

                    inferredType.comment ??=
                        refOrig.reflection.comment?.clone();
                }
            }

            schemaTypes.clear();
        },
        2000,
    );

    function onCreateDeclaration(
        context: Context,
        refl: DeclarationReflection,
    ) {
        if (
            !refl.kindOf(ReflectionKind.TypeAlias) ||
            refl.type?.type !== "reference" ||
            refl.type.package !== "zod" ||
            (refl.type.qualifiedName !== "TypeOf" &&
                refl.type.qualifiedName !== "input")
        ) {
            return;
        }

        const originalRef = refl.type.typeArguments?.[0]?.visit({
            query: (t) => t.queryType,
        });

        const declaration = refl.project
            .getSymbolFromReflection(refl)
            ?.getDeclarations()
            ?.find(ts.isTypeAliasDeclaration);
        if (!declaration) return;

        const type = context.getTypeAtLocation(declaration);
        refl.type.visit(
            makeRecursiveVisitor({
                reflection: (type) => {
                    context.project.removeReflection(type.declaration);
                },
            }),
        );
        refl.type = context.converter.convertType(
            context.withScope(refl),
            type,
        );

        if (originalRef) {
            schemaTypes.set(refl, originalRef);
        }
    }
}
