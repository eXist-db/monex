# Monex (Monitoring for eXist)

![Image](resources/img/screenshot.png?raw=true)

An application for monitoring, profiling and inspecting a running eXist-db instance. The app includes:

1. Monitoring dashboard: shows memory usage, running queries, locked threads, cache usage and more
2. Query profiling page: essential for tuning queries and indexes
3. Index browser: inspect existing indexes
4. Remote console: send log messages from any query in eXist to the remote console.
Uses web sockets for real-time updates.
5. Data visualizer: get a quick overview of the frequency of elements in a collection.

Building
--------
If you wish to build Monex from source code you should follow these steps:

1. Clone it from *wolfgangmm* (or from your own fork) `git clone https://github.com/wolfgangmm/monex.git`.

2. Ensure you have Apache Ant installed and available:
```
$ ant -version
Apache Ant(TM) version 1.9.4 compiled on April 29 2014
```

3. Ensure that you have JDK 7 or newer installed and available:
```
$ javac -version
javac 1.8.0_40
```

4. Copy `build.properties` to `local.build.properties`.

5. Set the path to your eXist installation as the property `exist.dir` in  `local.build.properties`:
```
exist.dir=/opt/exist
```

6. Compile and build an EXPath package by running `ant xar`. The resultant XAR will be in the `build/` folder.
