import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { VOCABULARY_PEOPLE } from "../src/node/index.js";

const PEOPLE_CLI = fileURLToPath(
  new URL("../src/node/people-cli.js", import.meta.url),
);
const ROWAN = join("people", "rowan-ellery-marsh", "person.json");

const scratch = await mkdtemp(join(tmpdir(), "sandbox-people-"));
after(() => rm(scratch, { recursive: true, force: true }));

/** A vocabulary folder holding the package's copy of the people, changed by `edit`. */
async function vocabulary(
  name: string,
  edit: (folder: string) => Promise<void> = async () => {},
): Promise<string> {
  const folder = join(scratch, name);
  await cp(VOCABULARY_PEOPLE, join(folder, "people"), { recursive: true });
  await edit(folder);
  return folder;
}

/** The check run with `CASCADE_VOCABULARY` naming the folder: its exit code and what it printed. */
function check(
  folder: string,
  args: string[] = ["--check"],
): Promise<{ code: number; said: string }> {
  return new Promise((resolve) =>
    execFile(
      process.execPath,
      [PEOPLE_CLI, ...args],
      { env: { ...process.env, CASCADE_VOCABULARY: folder } },
      (error, stdout, stderr) =>
        resolve({
          code: error === null ? 0 : (error.code as number),
          said: stdout + stderr,
        }),
    ),
  );
}

/** `npm run people -- --check` is the command a vocabulary pull request runs to try its people against these hospitals. */
describe("Checking the hand-written people against the vocabulary · npm run people", () => {
  describe("npm run people -- --check, with CASCADE_VOCABULARY naming the vocabulary", () => {
    it("passes on a vocabulary whose people/ is the copy, and names the folder it read", async () => {
      const folder = await vocabulary("same");
      const { code, said } = await check(folder);
      assert.equal(code, 0, said);
      assert.ok(said.includes(folder), said);
    });

    it("passes on the same JSON written with other spacing and line endings", async () => {
      const folder = await vocabulary("respaced", async (at) => {
        const file = join(at, ROWAN);
        const person: unknown = JSON.parse(await readFile(file, "utf8"));
        await writeFile(file, JSON.stringify(person, null, 4).replace(/\n/g, "\r\n"));
      });
      const { code, said } = await check(folder);
      assert.equal(code, 0, said);
    });

    for (const [title, edit, line] of [
      [
        "fails naming a file the vocabulary changed",
        async (at: string) => {
          const file = join(at, ROWAN);
          const person = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
          await writeFile(file, JSON.stringify({ ...person, birthDate: "1979-04-13" }));
        },
        "vocabulary/people/rowan-ellery-marsh/person.json differs",
      ],
      [
        "fails naming a file the vocabulary added",
        async (at: string) => {
          await mkdir(join(at, "people", "new-person"));
          await writeFile(join(at, "people", "new-person", "person.json"), "{}");
        },
        "vocabulary/people/new-person/person.json is missing",
      ],
      [
        "fails naming a file the vocabulary removed",
        (at: string) => rm(join(at, ROWAN)),
        "vocabulary/people/rowan-ellery-marsh/person.json is not in",
      ],
    ] as const)
      it(title, async () => {
        const folder = await vocabulary(title.replace(/\W+/g, "-"), edit);
        const { code, said } = await check(folder);
        assert.equal(code, 1, said);
        assert.ok(said.includes(line), said);
      });

    for (const [title, args, text] of [
      [
        "refuses a folder with no people/, saying how to name the vocabulary, and exits 2",
        ["--check"],
        "CASCADE_VOCABULARY",
      ],
      [
        "refuses a folder named on the command line, printing the usage, and exits 2",
        ["--check", "../cascade-vocabulary"],
        "usage: npm run people",
      ],
    ] as const)
      it(title, async () => {
        const { code, said } = await check(join(scratch, "nowhere"), [...args]);
        assert.equal(code, 2, said);
        assert.ok(said.includes(text), said);
      });
  });
});
