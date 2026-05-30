xquery version "3.1";

declare namespace jmx = "http://exist-db.org/jmx";

declare variable $instance external := "__INSTANCE__";

declare function local:to-milliseconds($dateTime as xs:dateTime) as xs:integer {
    let $diff := $dateTime - xs:dateTime("1970-01-01T00:00:00Z")
    return
        xs:integer(
            (days-from-duration($diff) * 60 * 60 * 24 +
            hours-from-duration($diff) * 60 * 60 +
            minutes-from-duration($diff) * 60 +
            seconds-from-duration($diff)) * 1000
        )
};

let $data-root := "/db/apps/monex/data"
let $timestamp := xs:dateTime("2026-05-26T17:00:00.000Z")
let $root := $data-root || "/" || $instance
let $_ := (
    if (xmldb:collection-available($data-root)) then
        ()
    else
        xmldb:create-collection("/db/apps/monex", "data")
)
let $_ := (
    if (xmldb:collection-available($root)) then
        ()
    else
        xmldb:create-collection($data-root, $instance)
)
let $doc :=
    <jmx:jmx>
        <jmx:timestamp>{$timestamp}</jmx:timestamp>
        <jmx:Database>
            <jmx:InstanceId>exist</jmx:InstanceId>
            <jmx:Uptime>3600000</jmx:Uptime>
            <jmx:MaxBrokers>20</jmx:MaxBrokers>
            <jmx:ActiveBrokers>1</jmx:ActiveBrokers>
            <jmx:ActiveBrokersMap>
                <jmx:row>
                    <jmx:owner>qtp-cypress-test-1</jmx:owner>
                    <jmx:stack>at org.exist.test.Main.run(Main.java:1)&#10; at org.exist.test.Worker.run(Worker.java:2)</jmx:stack>
                </jmx:row>
            </jmx:ActiveBrokersMap>
        </jmx:Database>
        <jmx:ProcessReport>
            <jmx:RecentQueryHistory>
                <jmx:row>
                    <jmx:mostRecentExecutionTime>1730000000000</jmx:mostRecentExecutionTime>
                    <jmx:mostRecentExecutionDuration>120006</jmx:mostRecentExecutionDuration>
                    <jmx:sourceKey>/db/apps/monex/modules/view.xql</jmx:sourceKey>
                    <jmx:requestURI>/exist/rest/db?_query=import%20module%20namespace%20util%3D%22http%3A%2F%2Fexist-db.org%2Fxquery%2Futil%22%3B%20util%3Await(1)</jmx:requestURI>
                </jmx:row>
            </jmx:RecentQueryHistory>
            <jmx:RunningQueries/>
        </jmx:ProcessReport>
        <jmx:LockManager>
            <jmx:WaitingThreads/>
        </jmx:LockManager>
        <jmx:SystemInfo>
            <jmx:ProductName>eXist</jmx:ProductName>
            <jmx:ProductVersion>7.0.0-SNAPSHOT</jmx:ProductVersion>
            <jmx:OperatingSystem>Linux</jmx:OperatingSystem>
            <jmx:ProductBuild>cypress</jmx:ProductBuild>
            <jmx:DefaultEncoding>UTF-8</jmx:DefaultEncoding>
            <jmx:DefaultLocale>en</jmx:DefaultLocale>
        </jmx:SystemInfo>
    </jmx:jmx>
let $olderTimestamp := xs:dateTime("2026-05-26T16:00:00.000Z")
let $olderDoc :=
    <jmx:jmx>
        <jmx:timestamp>{$olderTimestamp}</jmx:timestamp>
        <jmx:Database>
            <jmx:InstanceId>exist</jmx:InstanceId>
            <jmx:Uptime>3000000</jmx:Uptime>
            <jmx:MaxBrokers>20</jmx:MaxBrokers>
            <jmx:ActiveBrokers>0</jmx:ActiveBrokers>
            <jmx:ActiveBrokersMap/>
        </jmx:Database>
        <jmx:ProcessReport>
            <jmx:RecentQueryHistory/>
            <jmx:RunningQueries/>
        </jmx:ProcessReport>
        <jmx:LockManager>
            <jmx:WaitingThreads/>
        </jmx:LockManager>
        <jmx:SystemInfo>
            <jmx:ProductName>eXist</jmx:ProductName>
            <jmx:ProductVersion>7.0.0-SNAPSHOT</jmx:ProductVersion>
            <jmx:OperatingSystem>Linux</jmx:OperatingSystem>
            <jmx:ProductBuild>cypress</jmx:ProductBuild>
            <jmx:DefaultEncoding>UTF-8</jmx:DefaultEncoding>
            <jmx:DefaultLocale>en</jmx:DefaultLocale>
        </jmx:SystemInfo>
    </jmx:jmx>
let $_ := xmldb:store($root, "cypress-details-fixture-older.xml", $olderDoc)
let $_ := xmldb:store($root, "cypress-details-fixture.xml", $doc)
return local:to-milliseconds($timestamp)
