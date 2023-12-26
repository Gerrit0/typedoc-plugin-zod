# typedoc-plugin-zod

Improves display of types created with [Zod](https://github.com/colinhacks/zod)'s `z.infer` type.

## Usage

```bash
npm install --save-dev typedoc-plugin-zod
```

```jsonc
// typedoc.json
{
    "plugin": ["typedoc-plugin-zod"]
}
```

See [an example](https://gerritbirkeland.com/typedoc-plugin-zod/types/Abc.html) of this plugin in action.

## Change Log

### v1.1.1

-   Fixed conversion of symbols where the same name is used for a type and variable, #2.

### v1.1.0

-   Add support for TypeDoc 0.25.x

### v1.0.2

-   Update peer dependency to allow TypeDoc 0.24

### v1.0.1

-   Add GitHub links to NPM package
