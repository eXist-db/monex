(:
 : SPDX LGPL-2.1-or-later
 : Copyright (C) 2014 The eXist-db Authors
 :)
xquery version "3.1";

module namespace testapp="http://exist-db.org/apps/admin/testapp";

import module namespace app="http://exist-db.org/apps/admin/templates" at "app.xql";

declare namespace test="http://exist-db.org/xquery/xqsuite";

declare variable $testapp:mock-profile := 
    <stats:calls xmlns:stats="http://exist-db.org/xquery/profiling">
        <stats:function name="util:binary-to-string" elapsed="0.008" calls="20" source="/db/system/repo/templating-1.2.1/content/lib.xqm [-1:-1]"/>
        <stats:function name="templates:process-output" elapsed="0.0" calls="3" source="/db/system/repo/templating-1.2.1/content/templates.xqm [237:17]"/>
        <stats:function name="map:keys" elapsed="0.001" calls="1" source="/db/system/repo/templating-1.2.1/content/templates.xqm [80:30]"/>
        <stats:function name="exists" elapsed="0.0" calls="9" source="/db/system/repo/templating-1.2.1/content/templates.xqm [270:12]"/>
        <stats:function name="exists" elapsed="0.0" calls="1" source="/db/system/repo/templating-1.2.1/content/templates.xqm [450:9]"/>
        <stats:function name="file:exists" elapsed="0.0" calls="1" source="/db/apps/monex/modules/monex.xqm [22:13]"/>
        <stats:function name="ft:query-vector" elapsed="0.042" calls="3" source="/db/apps/demo/search.xql [18:12]"/>
        <stats:function name="vector:embed" elapsed="0.015" calls="2" source="/db/apps/demo/index.xql [44:8]"/>
        <stats:index type="range" source="/db/apps/monex/modules/app.xql [123:84]" elapsed="0.0" calls="4" optimization-level="BASIC"/>
        <stats:index type="lucene" source="/db/apps/demo/search.xql [12:5]" elapsed="0.012" calls="2" optimization-level="OPTIMIZED"/>
        <stats:index type="lucene-vector" source="/db/apps/demo/search.xql [18:12]" elapsed="0.031" calls="3" optimization-level="OPTIMIZED"/>
        <stats:index type="range" source="/db/apps/monex/modules/monex.xqm [28:19]" elapsed="0.0" calls="4" optimization-level="NONE"/>
        <stats:index type="range" source="/db/apps/monex/modules/config.xqm [25:13]" elapsed="0.0" calls="1" optimization-level="NONE"/>
        <stats:index type="range" source="/db/system/repo/templating-1.2.1/content/templates.xqm [255:26]" elapsed="0.001" calls="10" optimization-level="OPTIMIZED"/>
        <stats:index type="range" source="c:\this\is\a\really\long\filesystem\path\on\windows.xql [123:84]" elapsed="0.0" calls="4" optimization-level="BASIC"/>
    </stats:calls>
;

declare
    %test:arg("dateTime", "1970-01-01T00:00:00.000Z") %test:assertEquals(0)
    %test:arg("dateTime", "1971-01-01T00:00:00.000Z") %test:assertEquals(31536000000)
    %test:arg("dateTime", "2014-01-04T23:42:23.423Z") %test:assertEquals(1388878943423)
function testapp:time-to-millis($dateTime as xs:string) as xs:integer {
    app:time-to-milliseconds(xs:dateTime($dateTime))
};


declare
    %test:arg("millis", 0) %test:assertEquals("1970-01-01T00:00:00.000Z")
    %test:arg("millis", 31536000000) %test:assertEquals("1971-01-01T00:00:00.000Z")
    %test:arg("millis", 1388878943423) %test:assertEquals("2014-01-04T23:42:23.423Z")
    %test:arg("millis", 1427846400096) %test:assertEquals("2015-04-01T00:00:00.096Z")
    %test:arg("millis", 1427846460066) %test:assertEquals("2015-04-01T00:01:00.066Z")
    %test:arg("millis", 1427846520062) %test:assertEquals("2015-04-01T00:02:00.062Z")
function testapp:millis-to-time($millis as xs:integer) as xs:dateTime {
    app:milliseconds-to-time($millis)
};

declare
    %test:assertXPath('<tr><td colspan="5">No statistics available or tracing not enabled.</td></tr>')
function testapp:index-stats-empty() {
    app:index-stats(<root/>, map{}, "test")
};

declare
    %test:assertEquals("true", "true")
function testapp:index-stats-shortens-long-paths() {
    let $rendered := app:index-stats(<root/>, map{ "trace": $testapp:mock-profile }, "test")
    let $long-paths := $rendered//span[@title]
    return for $next in $long-paths
        let $is-shortened := contains($next/string(), '[...]')
        let $start := substring-before($next/string(), '[...]')
        let $end := substring-after($next/string(), '[...]')
        let $matches := 
          starts-with($next/@title, $start) and 
          ends-with($next/@title, $end)
        return if ($is-shortened and $matches and string-length($start) > 0 and string-length($end) > 0) then true() else error((), $next/@title || " <> " || $next/string() || $end || $start) 
};

declare
    %test:assertEquals(5, 5)
function testapp:index-stats-returns-cols-and-rows() {
    let $rows := app:index-stats(<root/>, map{ "trace": $testapp:mock-profile }, "test")
    let $first := head($rows)
    return ( 
        count($rows),
        count($first//td)
    )
};

declare
    %test:assertEquals(true(), true())
function testapp:index-stats-labels-vector-knn() {
    let $rows := app:index-stats(<root/>, map{ "trace": $testapp:mock-profile }, "test")
    return
        if (exists($rows[contains(., "Lucene vector KNN") and contains(., "KNN")])) then
            true()
        else
            error((), "expected Lucene vector KNN label and badge")
};

declare
    %test:assertEquals(true(), true())
function testapp:vector-stats-aggregates-vector-workload() {
    let $rows := app:vector-stats(<root/>, map{ "trace": $testapp:mock-profile }, "test")
    return
        if (count($rows) ge 3 and
            exists($rows[contains(., "ft:query-vector")]) and
            exists($rows[contains(., "vector:embed")]) and
            exists($rows[contains(., "Lucene vector KNN")])) then
            true()
        else
            error((), "expected vector function and index rows")
};
