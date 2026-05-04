import type { Denops } from "@denops/std";
import { DenopsStub } from "@denops/test";
import { derive } from "@vim-fall/custom/derivable";
import { enumerate } from "@core/iterutil/enumerate";
import type { Detail, IdItem, Matcher, MatchParams } from "@vim-fall/std";
import {
  multiRegexp,
  removeBackslashBeforeSpace,
  splitUserInput,
} from "./matcher_multi_regexp.ts";
import { assertEquals } from "@std/assert";

type TestCase<T extends Detail> = {
  description?: string;
  items: IdItem<T>[];
  query: string;
  matcher: Matcher<T>;
  result: IdItem<T>[];
};

/**
 * Build list of IdItem<Detail> from given list of strings with the 0-indexed
 * sequence of ids.
 */
function buildItems(
  items: string[],
): IdItem<Detail>[] {
  return items.map((value, id) => ({ id, value, detail: {} } satisfies Detail));
}

function collectMatches<T extends Detail>(
  denops: Denops,
  matcher: Matcher<T>,
  param: MatchParams<T>,
): Promise<IdItem<T>[]> {
  return Array.fromAsync(matcher.match(denops, param, {}));
}

async function runParametarized<T extends Detail>(
  t: Deno.TestContext,
  denops: Denops,
  cases: TestCase<T>[],
) {
  for (const [i, v] of enumerate(cases)) {
    const description = v.description ? `${v.description}: ` : "";
    await t.step(
      `${description}(idx, query) = (${i}, "${v.query}")`,
      async () => {
        const matched = await collectMatches(
          denops,
          v.matcher,
          {
            query: v.query,
            items: v.items,
          },
        );
        assertEquals(matched, v.result);
      },
    );
  }
}

Deno.test("splitUserInput", async (t) => {
  await t.step("splits input by space(s)", () => {
    assertEquals(splitUserInput(String.raw`a b`), ["a", "b"]);
    assertEquals(splitUserInput(String.raw`a  b`), ["a", "b"]);
  });

  await t.step("does not split input when space is escaped", async (t) => {
    const cases = [
      String.raw`a\ b`,
      String.raw`a\\\ b`,
      String.raw`a\\\\\ b`,
      String.raw`\ b`,
      String.raw`\\\ b`,
      String.raw`\\\\\ b`,
    ];
    for (const i in cases) {
      const c = cases[i];
      await t.step(c, () => {
        assertEquals(splitUserInput(c), [c]);
      });
    }
  });

  await t.step(
    "splits input when even count of backslashes are before spaces",
    () => {
      assertEquals(splitUserInput(String.raw`a\\ b`), ["a\\\\", "b"]);
      assertEquals(splitUserInput(String.raw`\\ b`), ["\\\\", "b"]);
    },
  );
});

Deno.test("removeBackslashBeforeSpace", async (t) => {
  const cases = [
    [String.raw`a\ b`, String.raw`a b`],
    [String.raw`\ b`, String.raw` b`],
    [String.raw`a\ `, String.raw`a `],
    [String.raw`a\\ b`, String.raw`a\ b`],
    [String.raw`a\\\ b`, String.raw`a\\ b`],
    [String.raw`a\ b\\ c`, String.raw`a b\ c`],
    [String.raw`a\b\\c`, String.raw`a\b\\c`],
    [String.raw`a\\`, String.raw`a\\`],
  ];
  for (const i in cases) {
    const c = cases[i];
    await t.step(c[0], () => {
      assertEquals(removeBackslashBeforeSpace(c[0]), c[1]);
    });
  }
});

Deno.test("multiRegexp matcher", async (t) => {
  const denops = new DenopsStub({});

  await t.step("check with single regex pattern", async (t) => {
    await t.step("with noignorecase (default)", async (t) => {
      const cases = [
        {
          description: "Exclude unmathced items",
          items: buildItems(["itema", "itemA", "hoge", "an-item-x"]),
          query: "item",
          result: [
            {
              id: 0,
              value: "itema",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 1,
              value: "itemA",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 3,
              value: "an-item-x",
              decorations: [{ column: 4, length: 4 }],
              detail: {},
            },
          ],
        },
        {
          description: "Don't match with upper cased letter",
          items: buildItems(["itema", "itemA"]),
          query: "itema",
          result: [
            {
              id: 0,
              value: "itema",
              decorations: [{ column: 1, length: 5 }],
              detail: {},
            },
          ],
        },
        {
          description: "Match using special character",
          items: buildItems(["item", "itemmm", "ite"]),
          query: "item+",
          result: [
            {
              id: 0,
              value: "item",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 1,
              value: "itemmm",
              decorations: [{ column: 1, length: 6 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({ ...v, matcher: derive(multiRegexp) }));

      await runParametarized(t, denops, cases);
    });
    await t.step("with ignorecase", async (t) => {
      const cases = [
        {
          description: "Exclude unmathced items",
          items: buildItems(["item", "ITEM", "hoge", "an-item-x"]),
          query: "itEm",
          result: [
            {
              id: 0,
              value: "item",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 1,
              value: "ITEM",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 3,
              value: "an-item-x",
              decorations: [{ column: 4, length: 4 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({
        ...v,
        matcher: derive(multiRegexp({ ignoreCase: true })),
      }));

      await runParametarized(t, denops, cases);
    });

    await t.step("with smartcase", async (t) => {
      const cases = [
        {
          description: "ignores case",
          items: buildItems(["xxx", "XXX", "xXx"]),
          query: "xxx",
          result: [
            {
              id: 0,
              value: "xxx",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
            {
              id: 1,
              value: "XXX",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
            {
              id: 2,
              value: "xXx",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
          ],
        },
        {
          description: "respects case",
          items: buildItems(["xxx", "XXX", "xXx"]),
          query: "xXx",
          result: [
            {
              id: 2,
              value: "xXx",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({
        ...v,
        matcher: derive(multiRegexp({ ignoreCase: true, smartCase: true })),
      }));

      await runParametarized(t, denops, cases);
    });

    await t.step(
      "standalone smartcase doesn't have effects",
      async (t) => {
        await runParametarized(t, denops, [{
          matcher: derive(multiRegexp({ smartCase: true })),
          items: buildItems(["xxx", "XXX", "xXx"]),
          query: "xxx",
          result: [
            {
              id: 0,
              value: "xxx",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
          ],
        }]);
      },
    );

    await t.step("Multiple regex patterns", async (t) => {
      await runParametarized(t, denops, [
        {
          description: "Split query",
          matcher: derive(multiRegexp),
          items: buildItems(["aaa bbb", "ab", "bca", "ac"]),
          query: "a+ b+",
          result: [
            {
              id: 0,
              value: "aaa bbb",
              decorations: [{ column: 1, length: 3 }, { column: 5, length: 3 }],
              detail: {},
            },
            {
              id: 1,
              value: "ab",
              decorations: [{ column: 1, length: 1 }, { column: 2, length: 1 }],
              detail: {},
            },
            {
              id: 2,
              value: "bca",
              decorations: [{ column: 3, length: 1 }, { column: 1, length: 1 }],
              detail: {},
            },
          ],
        },
      ]);
    });
  });
});
