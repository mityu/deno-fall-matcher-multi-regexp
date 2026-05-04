# fall-matcher-multi-regexp

A matcher for [fall.vim](https://github.com/vim-fall/fall.vim) that filters
items based on query that is space-separated list of regex patterns.

## Example

For the details of matcher options or etc, please check
[@mityu/fall-matcher-multi-regexp](https://jsr.io/@mityu/fall-matcher-multi-regexp).

```typescript
// In your custom.ts
import type { Entrypoint } from "jsr:@vim-fall/custom";
import * as builtin from "jsr:@vim-fall/std/builtin";
import { multiRegexp } from "jsr:@mityu/fall-matcher-multi-regexp";

export const main: Entrypoint = ({ definePickerFromSource }) => {
  definePickerFromSource(
    "file",
    builtin.source.file,
    {
      matchers: [multiRegexp],
      previewers: [builtin.previewer.file],
      actions: {
        ...builtin.action.defaultOpenActions,
        ...builtin.action.defaultQuickfixActions,
      },
      defaultAction: "open",
    },
  );
};
```
