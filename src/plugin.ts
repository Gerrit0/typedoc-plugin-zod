import {
    type Application,
    type Context,
    Converter,
    DeclarationReflection,
    IntrinsicType,
    makeRecursiveVisitor,
    ReferenceType,
    Reflection,
    ReflectionKind,
    TypeScript as ts,
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
                    refOrig.reflection instanceof DeclarationReflection
                    && refOrig.reflection.type instanceof ReferenceType
                ) {
                    refOrig.reflection.type.typeArguments?.forEach((t) => t.visit(typeCleanup));
                    refOrig.reflection.type.typeArguments = [
                        ReferenceType.createResolvedReference(
                            inferredType.name,
                            inferredType,
                            context.project,
                        ),
                    ];

                    inferredType.comment ??= refOrig.reflection.comment?.clone();
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
        if ("deferConversion" in context.converter) {
            // In 0.28, the `type` member of type aliases isn't set yet, so we need
            // to wait until deferred conversion steps are happening to check it.
            // This isn't really what that hook was intended for originally, but seems
            // like an appropriate use for this plugin.
            context.converter.deferConversion(() => {
                resolveTypeAliasTypes(context, refl);
            });
        } else {
            resolveTypeAliasTypes(context, refl);
        }
    }

    function resolveTypeAliasTypes(context: Context, refl: DeclarationReflection) {
        // Check if this is a type alias which points to a zod schema
        // This is a rather unfortunate way to do this check... Zod's type structure
        // has changed somewhat between v3 and v4, so we have to check several names.
        // TypeDoc doesn't track scoped imports (zod vs zod/v4) so that doesn't need
        // to be checked here.
        if (
            !refl.kindOf(ReflectionKind.TypeAlias)
            || refl.type?.type !== "reference"
            || refl.type.package !== "zod"
            || !["TypeOf", "input", "output"].includes(refl.type.qualifiedName)
        ) {
            return;
        }

        const originalRef = refl.type.typeArguments?.[0]?.visit({
            query: (t) => t.queryType,
        });

        const declaration = getSymbolFromReflection(context, refl)
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
        if (type) {
            refl.type = context.converter.convertType(
                context.withScope(refl),
                type,
            );
        } else {
            refl.type = new IntrinsicType("any");
        }

        if (originalRef) {
            schemaTypes.set(refl, originalRef);
        }
    }
}

function getSymbolFromReflection(context: Context, refl: Reflection): ts.Symbol | undefined {
    if ("getSymbolFromReflection" in context) {
        // 0.28
        return context.getSymbolFromReflection(refl);
    }

    // <0.28
    return (refl.project as any).getSymbolFromReflection(refl);
}
