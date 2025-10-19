import {
    type Application,
    type Context,
    Comment,
    Converter,
    DeclarationReflection,
    IntrinsicType,
    makeRecursiveVisitor,
    ReferenceType,
    Reflection,
    ReflectionKind,
    ReflectionType,
    TypeScript as ts,
} from "typedoc";

interface PropertyDescription {
    path: string[];
    description: string;
}

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

                    // Try to extract Zod descriptions and add them to the comment
                    const zodDescription = extractZodDescription(context, refOrig);

                    // Use Zod description if available, otherwise fall back to JSDoc
                    if (zodDescription) {
                        if (!inferredType.comment) {
                            inferredType.comment = new Comment();
                        }
                        inferredType.comment.summary = [
                            { kind: "text", text: zodDescription }
                        ];
                    } else {
                        inferredType.comment ??= refOrig.reflection.comment?.clone();
                    }

                    // Extract property descriptions and apply them
                    const propertyDescriptions = extractZodPropertyDescriptions(context, refOrig);
                    if (propertyDescriptions.length > 0) {
                        applyPropertyDescriptions(inferredType, propertyDescriptions);
                    }
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

    /**
     * Extract description from a Zod schema by analyzing the AST
     */
    function extractZodDescription(context: Context, refType: ReferenceType): string | null {
        // The refType points to the schema variable (e.g., "userSchema")
        if (!refType.reflection || !refType.name) {
            return null;
        }

        // Get the symbol for the schema
        const schemaSymbol = refType.reflection instanceof DeclarationReflection
            ? getSymbolFromReflection(context, refType.reflection)
            : null;

        if (!schemaSymbol) return null;

        // Get the source file and find the schema declaration
        const declarations = schemaSymbol.getDeclarations();
        if (!declarations || declarations.length === 0) return null;

        for (const declaration of declarations) {
            // Look for variable declarations
            if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
                const description = extractDescribeFromNode(declaration.initializer);
                if (description) return description;
            }
        }

        return null;
    }

    /**
     * Extract property descriptions from a Zod schema
     */
    function extractZodPropertyDescriptions(context: Context, refType: ReferenceType): PropertyDescription[] {
        if (!refType.reflection || !refType.name) {
            return [];
        }

        const schemaSymbol = refType.reflection instanceof DeclarationReflection
            ? getSymbolFromReflection(context, refType.reflection)
            : null;

        if (!schemaSymbol) return [];

        const declarations = schemaSymbol.getDeclarations();
        if (!declarations || declarations.length === 0) return [];

        const descriptions: PropertyDescription[] = [];

        for (const declaration of declarations) {
            if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
                extractPropertyDescriptionsFromNode(declaration.initializer, [], descriptions);
            }
        }

        return descriptions;
    }

    /**
     * Recursively extract property descriptions from a Zod schema node
     */
    function extractPropertyDescriptionsFromNode(
        node: ts.Node | undefined,
        currentPath: string[],
        descriptions: PropertyDescription[]
    ): void {
        if (!node) return;

        // Handle z.object({ ... })
        if (ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression)) {

            const propName = node.expression.name.text;

            // Check if this is a z.object call
            if (propName === "object" && node.arguments.length > 0) {
                const arg = node.arguments[0];

                // Parse the object literal
                if (ts.isObjectLiteralExpression(arg)) {
                    for (const prop of arg.properties) {
                        if (ts.isPropertyAssignment(prop) &&
                            (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) {

                            const propPath = [...currentPath, prop.name.text];

                            // Look for descriptions in the property value
                            const propDescription = extractDescribeFromNode(prop.initializer);
                            if (propDescription) {
                                descriptions.push({
                                    path: propPath,
                                    description: propDescription
                                });
                            }

                            // Recursively check for nested objects
                            extractPropertyDescriptionsFromNode(prop.initializer, propPath, descriptions);
                        }
                    }
                }
            }

            // Check for describe on the current call and continue up the chain
            const description = extractDescribeFromNode(node);
            if (description && currentPath.length > 0) {
                descriptions.push({
                    path: currentPath,
                    description
                });
            }

            // Continue checking the chain
            extractPropertyDescriptionsFromNode(node.expression.expression, currentPath, descriptions);
        }
    }

    /**
     * Apply property descriptions to TypeDoc reflections
     */
    function applyPropertyDescriptions(
        typeRefl: DeclarationReflection,
        descriptions: PropertyDescription[]
    ): void {
        if (!typeRefl.type || typeRefl.type.type !== "reflection") {
            return;
        }

        const reflectionType = typeRefl.type as ReflectionType;
        if (!reflectionType.declaration) return;

        applyDescriptionsToReflection(reflectionType.declaration, descriptions, []);
    }

    /**
     * Recursively apply descriptions to nested reflections
     */
    function applyDescriptionsToReflection(
        refl: DeclarationReflection,
        descriptions: PropertyDescription[],
        currentPath: string[]
    ): void {
        if (!refl.children) return;

        for (const child of refl.children) {
            if (child.kindOf(ReflectionKind.Property)) {
                const childPath = [...currentPath, child.name];

                // Find matching description
                const desc = descriptions.find(d =>
                    d.path.length === childPath.length &&
                    d.path.every((p, i) => p === childPath[i])
                );

                if (desc) {
                    if (!child.comment) {
                        child.comment = new Comment();
                    }
                    if (!child.comment.summary || child.comment.summary.length === 0) {
                        child.comment.summary = [
                            { kind: "text", text: desc.description }
                        ];
                    }
                }

                // Recursively handle nested objects
                if (child.type && child.type.type === "reflection") {
                    const childReflType = child.type as ReflectionType;
                    if (childReflType.declaration) {
                        applyDescriptionsToReflection(
                            childReflType.declaration,
                            descriptions,
                            childPath
                        );
                    }
                }
            }
        }
    }

    /**
     * Extract .describe() call from a node (handles chained calls)
     */
    function extractDescribeFromNode(node: ts.Node | undefined): string | null {
        if (!node) return null;

        // Handle call expressions (method calls)
        if (ts.isCallExpression(node)) {
            // Check if this is a .describe() call
            if (ts.isPropertyAccessExpression(node.expression)) {
                const propName = node.expression.name.text;

                if (propName === "describe" && node.arguments.length > 0) {
                    const arg = node.arguments[0];
                    // Extract string literal from the describe call
                    if (ts.isStringLiteral(arg)) {
                        return arg.text;
                    }
                }

                // Recursively check the object being called (for chained calls)
                return extractDescribeFromNode(node.expression.expression);
            }

            // Check the expression being called
            return extractDescribeFromNode(node.expression);
        }

        // Handle property access (e.g., z.object)
        if (ts.isPropertyAccessExpression(node)) {
            return extractDescribeFromNode(node.expression);
        }

        return null;
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
