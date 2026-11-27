# Contributing to cascade-sandbox

Thank you for helping. This repository holds pretend SMART on FHIR hospitals, for developing against a hospital with no
account and no network. A hospital is a function from a `Request` to a `Response`, and nothing here imports a runtime
package. [`README.md`](README.md) names the parts, [`rulings.md`](rulings.md) records each choice a hospital makes
against FHIR and SMART, and [`CLAUDE.md`](CLAUDE.md) holds the rules a change here follows; read it before you add a
test.

Report a security problem privately, by email to contact@cascadeprotocol.org, never in a public issue. The hospitals are pretend and protect nothing, so a weakness in them is not one.

## Set up

You need Node.js 24 or newer and git.

```sh
git clone git@github.com:<you>/cascade-sandbox.git
cd cascade-sandbox
npm ci
```

`npm ci` also compiles the TypeScript.

## Run the checks

These are the commands CI runs.

```sh
npm run lint
npm test
```

`npm run format` fixes what the formatting check in `npm run lint` finds. `npm test` runs in seconds, so run all of it.

A third check holds `vocabulary/people/`, the copy of the vocabulary's hand-written people, to the vocabulary's
`people/`. It reads [cascade-vocabulary](https://github.com/the-cascade-protocol/cascade-vocabulary) from the folder
`CASCADE_VOCABULARY` names, else from `cascade-vocabulary` beside this repository; `npm run people` without `--check`
copies it again.

```sh
npm run people -- --check
```

`npm run validate:data` checks every version of every record against FHIR R4 and US Core with the HL7 validator. It runs
in Docker and needs a network, so it is slow; CI runs it when a pull request touches the hospitals, the people, the
vocabulary, the source or the validator.

## What a pull request must pass

CI runs on every pull request, and a red check is a reason not to merge.

- **`check`**: `npm run lint` and `npm test`.
- **`people`**: the people against the vocabulary's newest main, or the vocabulary pull request a `Depends-On:` line
  names.
- **`pack`**: packs the package, once `check` and `people` pass, with a `vocabulary.json` naming the vocabulary commit
  `people` passed with. On `main`, `release` publishes it as the release `build-<commit>`; a push whose checks fail
  publishes nothing. A hand-started release of an older commit is checked against today's vocabulary.
- **`contract`**: the runtime's own tests of the rulings a sandbox change could break, run against your sandbox. See
  "A change that spans two repositories".
- **`validate-data`**: the HL7 validator, when the data changed. It is not a gate, but a failure in it is a real finding.

## Commits and pull requests

Use conventional commits: `feat(route): ...`, `fix(loader): ...`. Do not put a closing keyword (`closes`, `fixes`,
`resolves`) before an issue the pull request does not finish: GitHub closes it whatever the rest of the sentence says.
How to write a test, what to pin and where a reason goes are in [`CLAUDE.md`](CLAUDE.md).

A choice the hospital makes against FHIR or SMART goes in [`rulings.md`](rulings.md), with the text it follows and the
test that pins it.

## A change that spans two repositories

Nothing pins one repository to another: with no counterpart named, `contract` runs
[cascade-runtime-js](https://github.com/the-cascade-protocol/cascade-runtime-js)'s tests from its `main` over your branch,
and `people` reads the vocabulary's `main`. A change the other side must follow is two pull requests, one here and one
there, each naming the other in its description on a line of its own, with the full URL:

```
Depends-On: https://github.com/the-cascade-protocol/cascade-runtime-js/pull/123
Depends-On: https://github.com/the-cascade-protocol/cascade-vocabulary/pull/456
```

A change to a hand-written person is such a pair: the vocabulary's pull request, and one here made by `npm run people`
with that branch of the vocabulary beside this repository. The vocabulary's pull request runs this repository's check as
`npm run people -- --check`, in a checkout of it after `npm ci`, with the vocabulary under test beside it as
`cascade-vocabulary` or named by `CASCADE_VOCABULARY`. Merge the vocabulary's first, then this one: merged the other way
round, this repository's push run fails `people` and publishes no build until it is re-run.

Editing the description re-runs `contract`; re-run `check` with `gh run rerun`, and re-run either when the named pull
request changes after your checks have run.

## Licence

Apache-2.0. The generated people are synthetic, from Synthea, and carry their own notices in
[`people/NOTICE.md`](people/NOTICE.md).
