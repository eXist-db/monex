# Monex (Monitoring for eXist-db and Elemental)

[![Build Status](https://github.com/eXist-db/monex/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/eXist-db/exist/monex/workflows/ci.yml)
[![Java 21](https://img.shields.io/badge/java-21-blue.svg)](https://adoptopenjdk.net/)
[![License](https://img.shields.io/badge/license-LGPL%202.1-blue.svg)](https://www.gnu.org/licenses/lgpl-2.1.html)

![Image](src/main/xar-resources/resources/img/screenshot.png?raw=true)

An application for monitoring, profiling and inspecting a running eXist-db or Elemental instance.

## Features

The app includes:

- **Monitoring dashboard**: shows memory usage, running queries, locked threads, cache usage and more
- **Query profiling** page: essential for tuning queries and indexes
- **Index browser**: inspect existing indexes
- **Remote console**: send log messages from any query to the remote console.
Uses web sockets for real-time updates.
- **Data visualizer**: get a quick overview of the frequency of elements in a collection.
- **Remote Monitoring**: monitor multiple remote instances. Provides timelines for long term monitoring.

## Configure Monex

### Enable Remote Monitoring

#### Preconditions

Monex remote monitoring requires the Scheduler Module to be enabled. Make sure the Scheduler module is not commented out in `etc/conf.xml`:

```xml
<module uri="http://exist-db.org/xquery/scheduler"
	class="org.exist.xquery.modules.scheduler.SchedulerModule" />
```

#### Adding an instance to monitor

For each instance to monitor its URL and its unique token is needed. The token can be found in the data directory on the filesystem . The file is called `jmxservlet.token`. The path to the data directory can be found in `etc/conf.xml`

```xml
<db-connection files="path-to-your-data-dir" ... />
```

Each installation to monitor is added as an instance entry at `/db/apps/monex/instances.xml`.

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

If you wish to build Monex from source code you should follow these steps:

1. Ensure you have Git, GnuPG, Apache Maven 3.3+, and Java JDK 21 installed and available. If you wish to run the test suite, you will also need to have Docker installed.

```bash
$ git --version
git version 2.49.0

$ mvn --version

Apache Maven 3.9.10 (5f519b97e944483d878815739f519b2eade0a91d)
Maven home: /usr/local/Cellar/maven/3.9.10/libexec
Java version: 21.0.7, vendor: Eclipse Adoptium, runtime: /Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home
Default locale: en_GB, platform encoding: UTF-8
OS name: "mac os x", version: "15.4.1", arch: "x86_64", family: "mac"
```

2. Clone and build an EXPath package of Monex by running:

```bash
git clone https://github.com/exist-db/monex.git
cd monex
mvn package
```

The resulting XAR will be in the `target/` folder.


3. Running the Test Suite:

  1. Against eXist-db 6.x.x:

  ```bash
  mvn verify -P docker-integration-test-db-api-6,cypress-with-recording-db-api-6
  ```

  2. Against Elemental 7.x.x:
  ```bash
  mvn verify -P docker-integration-test-db-api-7,cypress-with-recording-db-api-7
  ```

## Release Procedure

This project is configured to use the [Maven Release Plugin](https://maven.apache.org/maven-release/maven-release-plugin/) to make creating and subsequently publishing a release easy.

The release plugin will take care of:

1. Testing the project (all tests must pass)
2. Verifying all rules, e.g. license declarations present, etc.
3. Creating a Git Tag and pushing the Tag to GitHub
4. Building and signing the artifacts (e.g. EXPath Pkg `.xar` file).

Before performing the release, in addition to the Build requirements you need an installed and functioning copy of GPG or [GnuPG](https://gnupg.org/) with your private key setup correctly for signing.

Only users with push access to the GitHub repo can act as release manager.

### Preparation

Before creating the release, check if:

- [ ] the changelog is up-to-date for the planned release?
- [ ] the target versions for the Database API and Implementation are correctly declared in `monex-parent/pom.xml`?
  
   ```xml
        <!-- Version of eXist-db and Elemental 6.x.x that Monex is compatible with -->
        <db.api.6.version>6.0.0</db.api.6.version>
        <db.api.6.impl.version>6.1.0</db.api.6.impl.version>
        <db.api.6.java.version>1.8</db.api.6.java.version>

        <!-- Version of eXist-db and Elemental 7.x.x that Monex is compatible with -->
        <db.api.7.version>7.0.0</db.api.7.version>
        <db.api.7.impl.version>7.0.0</db.api.7.impl.version>
        <db.api.7.java.version>21</db.api.7.java.version>
   ```


#### Changelog

To edit the release notes for the planned release within `xar-assembly.xml` located in the root of this repo, e.g.:

```xml
<changelog>
	<change version="4.0.0">
		<ul xmlns="http://www.w3.org/1999/xhtml">
			<li>Breaking: Due to internal API changes this version of monex requires eXist-db version 6.1.0 or later - <a href="https://github.com/eXist-db/monex/pull/210">#210</a>, <a href="https://github.com/eXist-db/monex/pull/223">#223</a></li>
			<li>Fixed: Added missing release notes for 3.0.5 release - <a href="https://github.com/eXist-db/monex/issues/217">#217</a></li>
		</ul>
	</change>
</changelog>
```

### Release

To perform the release, from within your local Git cloned repository run:

```bash
mvn release:prepare && mvn release:perform
```

You will be prompted for the answers to a few questions along the way. The default response will be provided for you, and you can simply press "Enter" (or "Return") to accept it. Alternatively you may enter your own value and press "Enter" (or "Return").

```bash
What is the release version for "monex"? (org.exist-db.apps:monex) 4.3.0:
What is SCM release tag or label for "monex"? (org.exist-db.apps:monex) 4.3.0:
What is the new development version for "monex"? (org.exist-db.apps:monex) 4.3.1-SNAPSHOT:
```

- For the `release version`, please sensibly consider using the next appropriate [SemVer 2.0.0](https://semver.org/) version number.
- For the `SCM release tag`, please use the same value as the `release version`.
- For the `new development version`, the default value should always suffice.

Once the release process completes, there will be a `.xar` file in the `target/` sub-folder. This file may be published to:

1. [GitHub Releases](https://github.com/eXist-db/monex/releases)
2. [The eXist-db Public EXPath Repository](https://exist-db.org/exist/apps/public-repo/admin)