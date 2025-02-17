# Monex (Monitoring for eXist)

[![Build Status](https://github.com/eXist-db/monex/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/eXist-db/exist/monex/workflows/ci.yml)

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

If you wish to build Monex from source code you should follow these steps:

1. Ensure you have Git, Apache Maven 3.3+, and Java JDK 8 installed and available:

```bash
$ git --version
git version 2.20.0

$ mvn --version

Apache Maven 3.5.4 (1edded0938998edf8bf061f1ceb3cfdeccf443fe; 2018-06-18T02:33:14+08:00)
Maven home: /usr/local/maven
Java version: 1.8.0_192, vendor: Azul Systems, Inc., runtime: /Library/Java/JavaVirtualMachines/zulu8.33.0.1-jdk8.0.192-macosx_x64/jre
Default locale: en_GB, platform encoding: UTF-8
OS name: "mac os x", version: "10.14.1", arch: "x86_64", family: "mac"
```

1. Clone and build an EXPath package by running:

```bash
git clone https://github.com/eXist-db/monex.git
cd monex
mvn package
```

The resulting XAR will be in the `target/` folder.

## Release Procedure

This project is configured to use the [Maven Release Plugin](https://maven.apache.org/maven-release/maven-release-plugin/) to make creating and subsequently publishing a release easy.

The release plugin will take care of:

1. Testing the project (all tests must pass)
2. Verifying all rules, e.g. license declarations present, etc.
3. Creating a Git Tag and pushing the Tag to GitHub
4. Building and signing the artifacts (e.g. EXPath Pkg `.xar` file).

Before performing the release, in addition to the Build requirements you need an installed and functioning copy of GPG or [GnuPG](https://gnupg.org/) with your private key setup correctly for signing.

Only users with push access to the GitHub repo can act as release manager.

```shell
mvn release:prepare
mvn release:perform
```

### Preparation

Before creating the release, check if:

- [ ] the changelog is up-to-date for the planned release?
- [ ] the target versions for eXistdb are correctly declared in `pom.xml`?
  
   ```xml
   <exist.java-api.version>5.4.0</exist.java-api.version>
   <exist.processor.version>7.0.0-SNAPSHOT</exist.processor.version> 
   ```


#### Changelog

To edit release notes for the planned release within `xar-assembly.xml` located in the root of this repo, e.g.:

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
What is the release version for "monex"? (org.exist-db.apps:monex) 2.3.1: : 2.4.0
What is SCM release tag or label for "monex"? (org.exist-db.apps:monex) 2.4.0: :
What is the new development version for "monex"? (org.exist-db.apps:monex) 2.4.1-SNAPSHOT: :
```

- For the `release version`, please sensibly consider using the next appropriate [SemVer 2.0.0](https://semver.org/) version number.
- For the `SCM release tag`, please use the same value as the `release version`.
- For the `new development version`, the default value should always suffice.

Once the release process completes, there will be a `.xar` file in the `target/` sub-folder. This file may be published to:

1. [GitHub Releases](https://github.com/eXist-db/monex/releases)
2. [The eXist-db Public EXPath Repository](https://exist-db.org/exist/apps/public-repo/admin)