# Skillet Schema Language (`s.*`)

Hashbrown ships "Skillet" — a Zod-inspired schema language optimised for
streaming LLM output. It is used to type tool arguments and structured responses.

## Import

```js
import { s } from '@hashbrownai/core';
```

## Primitives

```js
s.string('Description for the LLM')
s.number('A numeric value')
s.integer('Whole number only')
s.boolean('True or false flag')
s.nullish()                         // null | undefined
```

## Objects

```js
const PageSchema = s.object('A wiki page', {
  path: s.string('Drive path, e.g. "notes/meeting"'),
  content: s.string('Full markdown content of the page'),
});

// Nested
const RenameSchema = s.object('Rename operation', {
  from: s.string('Current path'),
  to:   s.string('New path'),
});
```

## Arrays

```js
s.array('List of paths', s.string('A single path'))
```

## Enums and literals

```js
s.enumeration('Document type', ['markdown', 'snippet', 'drawing'])
s.literal('fixed-value')
```

## Unions (`anyOf`)

```js
s.anyOf([
  s.object('Create op', { action: s.literal('create'), path: s.string('') }),
  s.object('Delete op', { action: s.literal('delete'), path: s.string('') }),
])
```

## Type inference

```js
// Infer the TypeScript type from a schema
/** @type {s.Infer<typeof PageSchema>} */
const page = { path: 'home', content: '# Welcome' };
```

## Using schemas with tools

Pass a schema as the `parameters` field of a tool definition (see `tools.md`).

```js
const writePageTool = {
  name: 'writePage',
  description: 'Create or overwrite a wiki page with the given markdown content',
  parameters: s.toJsonSchema(
    s.object('Write page input', {
      path:    s.string('Page path without .md extension, e.g. "notes/meeting"'),
      content: s.string('Full markdown content to write'),
    })
  ),
  handler: async ({ path, content }) => { /* ... */ },
};
```

## Structured output (responseSchema)

Force the LLM to reply with a typed JSON object instead of free text:

```js
const chat = fryHashbrown({
  model: 'claude-3-5-sonnet-20241022',
  system: 'Extract metadata from the user message.',
  responseSchema: s.object('Extracted metadata', {
    title:   s.string('Page title'),
    summary: s.string('One-sentence summary'),
    tags:    s.array('Relevant tags', s.string('A single tag')),
  }),
  transport: createHttpTransport({ baseUrl: WORKER_URL }),
});
```

The `lastAssistantMessage` signal will then contain a typed object rather than a string.

## References

| Resource | URL |
|----------|-----|
| Skillet schema source (`s.*` base types) | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/schema/base.ts |
| `toJsonSchema` source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/schema/to-json-schema.ts |
| Standard JSON Schema interop source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/schema/standard-json-schema.ts |
| Streaming schema helpers source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/schema/streaming.ts |
| `fromJsonAst` source (partial JSON parsing) | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/schema/from-json-ast.ts |
| Skillet JSON parser source | https://github.com/liveloveapp/hashbrown/blob/main/packages/core/src/skillet/parser/json-parser.ts |
| Concepts: schema | https://hashbrown.dev/docs/react/concept/schema |
| Concepts: structured output | https://hashbrown.dev/docs/react/concept/structured-output |
| Concepts: streaming | https://hashbrown.dev/docs/react/concept/streaming |
| Recipe: natural language → structured data | https://hashbrown.dev/docs/react/recipes/natural-language-to-structured-data |
