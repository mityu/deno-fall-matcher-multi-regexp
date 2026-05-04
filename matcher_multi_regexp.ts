import { defineMatcher, type Matcher } from "@vim-fall/std/matcher";

export function splitUserInput(input: string): string[] {
  const sep = /(?<!(?<=(?:^|[^\\])(?:\\\\)*)\\)\s/;
  return input.split(sep).filter((v) => v.length != 0);
}

export function removeBackslashBeforeSpace(input: string): string {
  return input.replace(/\\(?=\s)/g, "");
}

function strlen(s: string): number {
  return (new TextEncoder()).encode(s).length;
}

/**
 * Options for regexp matching.
 *
 * - `ignoreCase`: Enables case-insensitive matching regardless of query casing.
 * - `smartCase`: Turns off `ignoreCase` when query contains upper-cased characters.
 *    This has no effect when `ignoreCase` option is off.
 */
export type MultiRegexpOptions = {
  ignoreCase?: boolean;
  smartCase?: boolean;
};

/**
 * Creates a matcher that filters items by space-separated queries.
 * Each query is treated as a regular expression pattern and applied to each
 * item.  If an item matches to the every query, it remains in the list,
 * otherwise it is filtered-out from the list.
 * Each matched query within items is decorated with its position and length.
 *
 * @param opts - Matching options to control case sensitivity.
 * @returns A matcher that applies extended substring filtering with decorations.
 */
export const multiRegexp = (opts?: MultiRegexpOptions): Matcher => {
  return defineMatcher(async function* (_denops, { query, items }, { signal }) {
    const matchers = splitUserInput(query).map((v) =>
      removeBackslashBeforeSpace(v)
    );
    if (matchers.length === 0) {
      yield* items;
      return;
    }

    const buildRegexps = () => {
      const ignoreCase = opts?.ignoreCase &&
        !(opts?.smartCase && /[A-Z]/.test(query));
      const flags = ignoreCase ? "i" : "";
      try {
        return matchers.map((v) => new RegExp(v, flags));
      } catch (_) {
        // Ignore
      }
    };
    const regexps = buildRegexps();
    if (!regexps) {
      yield* items;
      return;
    }

    for await (const item of items) {
      signal?.throwIfAborted();

      const skip = regexps.reduce(
        (skip, re) => skip || !re.test(item.value),
        false,
      );
      if (skip) {
        continue;
      }

      // Build decorations.
      const matches = regexps.flatMap(
        (re) => {
          const matches = [];
          const r = new RegExp(re, re.flags + "g");
          let prevMatchIndex = -1;
          for (;;) { // Search for all the matches.
            const match = r.exec(item.value);
            if (!match || match.index === prevMatchIndex) {
              break;
            }
            matches.push(match);
            prevMatchIndex = match.index;
          }
          return matches;
        },
      );
      const decorations = matches.map((match) => {
        const column = strlen(item.value.slice(0, match.index)) + 1;
        const length = strlen(match[0]);

        return { column, length };
      });

      yield {
        ...item,
        decorations: item.decorations
          ? [...item.decorations, ...decorations]
          : decorations,
      };
    }
  });
};
