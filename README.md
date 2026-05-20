# Monex (Monitoring for eXist)

[![Build Status](https://github.com/eXist-db/monex/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/eXist-db/monex/actions/workflows/ci.yml)

![Image](src/main/xar-resources/resources/img/screenshot.png?raw=true)

An application for monitoring, profiling and inspecting a running eXist-db instance.

## Features

The app includes:

- **Monitoring dashboard**: shows memory usage, running queries, locked threads, cache usage and more
- **Query profiling** page: essential for tuning queries and indexes
- **Index browser**: inspect existing indexes
- **Remote console**: send log messages from any query in eXist to the remote console.
Uses web sockets for real-time updates.
- **Data visualizer**: get a quick overview of the frequency of elements in a collection.
- **Remote Monitoring**: monitor multiple remote eXistdb instances. Provides timelines for long term monitoring.

## Configure Monex

### Enable Remote Monitoring

#### Preconditions

Monex remote monitoring requires the eXistdb scheduler module to be enabled. Make sure it is enabled in `$eXistdb_home/extensions/build.properties`

```txt
# Scheduler module
include.module.scheduler = true
```

and in `$eXistdb_home/conf.xml` make sure the Scheduler module is not commented out:

```xml
<module uri="http://exist-db.org/xquery/scheduler"
	class="org.exist.xquery.modules.scheduler.SchedulerModule" />
```

##### Rebuilding eXistdb

This needs only to be done if `include.module.scheduler` in `extensions/build.properties` was set to `false`. Then eXistdb has to be rebuild to enable the scheduler module. Shutdown the database and in the root of the eXistdb project simply call

```shell
./build.sh
```

After starting the database again, the remote monitoring tab should show no more error warnings.

#### Adding an eXistdb instance to monitor

For each eXistdb instance to monitor its url and its unique token is needed. The token can be found in the data directory on the filesystem . The file is called `jmxservlet.token`. The path to the data directory can be found in `$existdb_home/conf.xml`

```xml
<db-connection files="path-to-your-data-dir" ... />
```

Each eXistdb installation to monitor is added as an instance entry at `/db/apps/monex/instances.xml`.

#### Sample Monex Instances

```xml
<instance name="localhost"
	url="http://localhost:8080/exist"
    token="3268b570-392e-56ea-9550-117012413e15" cron="0 * * * * ?">
	<poll cron="0/30 * * * * ?" store="yes">
    <alert name="More than 30 threads waiting for locks to be released"
    	condition="count($jmx//LockManager/WaitingThreads/row) > 30"/>
	<alert name="More than 40 brokers active"
    	condition="$jmx//Database/ActiveBrokers &gt; 10"/>
	<alert name="Process CPU load &gt; 1.0"
    	condition="$jmx//UnixOperatingSystem/ProcessCpuLoad &gt; 0.5"/>
	</poll>
</instance>
```

In the Monex Remote Monitoring tab click "Run" to start all remote monitoring jobs. You should now see an entry "localhost" beneath "Remote Monitoring" and beneath that an entry "Timelines".

## Building

Monex is built with Node.js + Gulp (Maven was removed in [#367](https://github.com/eXist-db/monex/pull/367); the Java pieces it used to ship now live in eXist-db core ≥ 7.x).

Requirements: Git and Node.js LTS. The Node version is pinned in `.nvmrc`; run `nvm use` if you use [nvm](https://github.com/nvm-sh/nvm).

```bash
git clone https://github.com/eXist-db/monex.git
cd monex
npm ci
npm run build
```

The resulting XAR is written to `dist/monex-<version>.xar`. On a fresh clone, `<version>` will be `0.0.0-development` (see [Release procedure](#release-procedure) for why).

For local development against a running eXist-db, see also `npm run develop` (live-reload) and `npm run deploy` (install the built XAR into the configured eXist-db instance — set credentials in `.env`, see `.env.example`).

## Release Procedure

Releases are fully automated: every push to `master` triggers [semantic-release](https://semantic-release.gitbook.io/), which computes the next version from [Conventional Commits](https://www.conventionalcommits.org/) since the last tag, builds the XAR, and publishes a GitHub Release with the XAR attached.

The pipeline takes care of:

1. Analyzing the commit history since the previous Git tag to determine the next SemVer-bumped version.
2. Writing that version into `package.json` (in-memory on the CI runner) so Gulp builds `dist/monex-<version>.xar` with the right filename.
3. Inserting a new `<change version="X.Y.Z">` entry into `repo.xml.tmpl` based on the same commit history (via `scripts/update-repo-changelog.js`).
4. Building the XAR (`npm run build`).
5. Creating a Git tag (`vX.Y.Z`), creating a corresponding [GitHub Release](https://github.com/eXist-db/monex/releases), and uploading the XAR as a release asset.

### What contributors need to do

- **Write [Conventional Commits](https://www.conventionalcommits.org/).** A `commitlint` + `husky` `commit-msg` hook enforces this locally (`@commitlint/config-conventional`). The commit type determines the version bump:
  - `feat:` → minor bump
  - `fix:`, `perf:` → patch bump
  - any commit with a `BREAKING CHANGE:` footer or a `!` after the type (e.g. `feat!:`) → major bump
  - `chore:`, `docs:`, `ci:`, `build:`, `style:`, `refactor:`, `test:` → no release (cosmetic / housekeeping)
- That's it. No version bump, no tag creation, no manual release commit.

### Why `package.json` always says `0.0.0-development` on `master`

Intentional, and matches the convention used by [`@existdb/xst`](https://github.com/eXist-db/xst), [`@existdb/node-exist`](https://github.com/eXist-db/node-exist), and [`@existdb/gulp-exist`](https://github.com/eXist-db/gulp-exist). The real version is set in-memory on the CI runner during the release pipeline; nothing is pushed back to `master`, which keeps branch protection meaningful and avoids the need for a PAT or GitHub App to bypass it. See [#386](https://github.com/eXist-db/monex/issues/386) and [#396](https://github.com/eXist-db/monex/pull/396) for the history.

### What release managers need to do

Nothing routine — pushes to `master` are released automatically.

If the release pipeline fails (check the `Release` job in the [Actions tab](https://github.com/eXist-db/monex/actions)) the commit history is still intact and re-running the job is safe: semantic-release is idempotent.
2. [The eXist-db Public EXPath Repository](https://exist-db.org/exist/apps/public-repo/admin)