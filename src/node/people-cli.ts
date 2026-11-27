import { execFile } from "node:child_process";
import { isDeepStrictEqual, parseArgs, promisify } from "node:util";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = fileURLToPath(new URL("../../../", import.meta.url));
const COPY = join(PACKAGE, "vocabulary");
const FOLDER = "people";
const USAGE = [
  "usage: npm run people -- [--check]",
  "The vocabulary is the folder CASCADE_VOCABULARY names, else cascade-vocabulary beside this repository.",
].join("\n");

/** A vocabulary that cannot be read: a usage error, said in one sentence. */
class Unread extends Error {}

const named = process.env.CASCADE_VOCABULARY || undefined;
const VOCABULARY =
  named === undefined
    ? join(PACKAGE, "..", "cascade-vocabulary")
    : resolve(named);
const WHERE =
  named === undefined
    ? `${VOCABULARY}, beside this repository`
    : `${VOCABULARY}, which CASCADE_VOCABULARY names`;

/** Every file under `<root>/people/`, by its path from `<root>`, `/`-separated; undefined when there is no such folder. */
async function filesOf(root: string): Promise<Map<string, Buffer> | undefined> {
  let entries;
  try {
    entries = await readdir(join(root, FOLDER), {
      recursive: true,
      withFileTypes: true,
    });
  } catch {
    return undefined;
  }
  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files.set(relative(root, path).split(sep).join("/"), await readFile(path));
  }
  return files;
}

async function vocabulary(): Promise<Map<string, Buffer>> {
  const files = await filesOf(VOCABULARY);
  if (files === undefined || files.size === 0)
    throw new Unread(
      `${WHERE}, has no ${FOLDER}/: put a checkout of cascade-vocabulary beside this repository, or name one with CASCADE_VOCABULARY`,
    );
  return files;
}

/** `, at <commit>` when the vocabulary is the root of a git checkout, for the line that says what was read. */
async function commitOf(): Promise<string> {
  try {
    const { stdout } = await promisify(execFile)("git", [
      "-C",
      VOCABULARY,
      "rev-parse",
      "--show-prefix",
      "HEAD",
    ]);
    const [prefix, commit] = stdout.split("\n");
    return prefix === "" && commit ? `, at ${commit}` : "";
  } catch {
    return "";
  }
}

/** Whether two files say the same: a `.json` as parsed JSON, any other as text with its line endings ignored. */
function same(path: string, one: Buffer, other: Buffer): boolean {
  const text = (bytes: Buffer) => bytes.toString("utf8").replace(/\r\n/g, "\n");
  if (!path.endsWith(".json")) return text(one) === text(other);
  try {
    return isDeepStrictEqual(JSON.parse(text(one)), JSON.parse(text(other)));
  } catch {
    return false;
  }
}

async function check(): Promise<string[]> {
  const [want, have] = await Promise.all([vocabulary(), filesOf(COPY)]);
  const wrong: string[] = [];
  for (const [path, bytes] of want) {
    const held = have?.get(path);
    if (held === undefined) wrong.push(`vocabulary/${path} is missing`);
    else if (!same(path, bytes, held))
      wrong.push(`vocabulary/${path} differs from the vocabulary's`);
  }
  for (const path of have?.keys() ?? [])
    if (!want.has(path))
      wrong.push(`vocabulary/${path} is not in the vocabulary's ${FOLDER}/`);
  return wrong;
}

async function copy(): Promise<number> {
  const files = await vocabulary();
  await rm(join(COPY, FOLDER), { recursive: true, force: true });
  for (const [path, bytes] of files) {
    const to = join(COPY, ...path.split("/"));
    await mkdir(dirname(to), { recursive: true });
    await writeFile(to, bytes);
  }
  return files.size;
}

let args;
try {
  args = parseArgs({ options: { check: { type: "boolean" } } });
} catch {
  args = undefined;
}
if (args === undefined) {
  console.error(USAGE);
  process.exitCode = 2;
} else
  try {
    const read = `the ${FOLDER}/ of ${WHERE}${await commitOf()}`;
    if (args.values.check) {
      const wrong = await check();
      for (const line of wrong) console.error(line);
      if (wrong.length > 0) {
        console.error(
          `vocabulary/${FOLDER}/ is not ${read}: npm run people copies it again`,
        );
        process.exitCode = 1;
      } else console.log(`vocabulary/${FOLDER}/ is ${read}`);
    } else
      console.log(
        `Copied ${await copy()} files of ${read} into vocabulary/${FOLDER}/`,
      );
  } catch (error) {
    if (!(error instanceof Unread)) throw error;
    console.error(error.message);
    process.exitCode = 2;
  }
