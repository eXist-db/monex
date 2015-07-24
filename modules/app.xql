xquery version "3.0";

module namespace app="http://exist-db.org/apps/admin/templates";

declare namespace html="http://www.w3.org/1999/xhtml";
declare namespace prof="http://exist-db.org/xquery/profiling";
declare namespace jmx="http://exist-db.org/jmx";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare namespace json="http://www.json.org";

import module namespace scheduler="http://exist-db.org/xquery/scheduler" at "java:org.exist.xquery.modules.scheduler.SchedulerModule";
import module namespace templates="http://exist-db.org/xquery/templates" ;
import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";

declare variable $app:OPTIMIZATIONS :=
    <optimizations>
        <opt n="0">No index</opt>
        <opt n="1">Basic</opt>
        <opt n="2">Full</opt>
    </optimizations>;

declare variable $app:get-scheduled-jobs := function-lookup(xs:QName("scheduler:get-scheduled-jobs"), 0);

declare variable $app:jmx-token :=
    try {
        util:import-module(xs:anyURI("http://exist-db.org/xquery/console"), "console", xs:anyURI("java:org.exist.console.xquery.ConsoleModule")),
        function-lookup(xs:QName("console:jmx-token"), 0)()
    } catch * {
        false()
    };

declare function app:scheduler-enabled($node as node(), $model as map(*)) {
    if (exists($app:get-scheduled-jobs)) then
        ()
    else
        $node
};

declare
    %templates:wrap
    %templates:default("instance", "localhost")
function app:get-instance($node as node(), $model as map(*), $instance as xs:string) {
    $instance
};

declare
    %templates:default("instance", "localhost")
function app:instances($node as node(), $model as map(*), $instance as xs:string) {
    for $current in collection($config:app-root)//instance
    return
        <li class="{if ($instance = $current/@name) then 'active' else ''}">
            <a href="index.html?instance={$current/@name}">
                <i class="fa fa-angle-double-right"/>
                {$current/@name/string()}
            </a>
            {
                if ($current/poll/@store = ("yes", "true")) then
                    <ul>
                        <li><a href="timelines.html?instance={$current/@name}">Timelines</a></li>
                    </ul>
                else
                    ()
            }
        </li>
};

declare
    %templates:wrap
    %templates:default("instance", "localhost")
function app:instances-data($node as node(), $model as map(*), $instance as xs:string) {
    let $instances := (
        <instance name="localhost" url="local" token="{$app:jmx-token}"/>,
        collection($config:app-root)//instance
    )
    return
        "var JMX_INSTANCES = [&#10;" ||
        string-join(
            for $instance in $instances
            let $statusRoot := collection($config:data-root)/jmx:jmx[jmx:instance = $instance/@name]
            let $status :=
                if ($statusRoot) then
                    if ($statusRoot/jmx:status = "ok") then
                        $statusRoot/jmx:SanityReport/jmx:Status/string()
                    else
                        $statusRoot/jmx:status/string()
                else
                    "Checking"
            return
                '{ name: "' || $instance/@name || 
                '", url: "' || $instance/@url || '", token: "' || $instance/@token || 
                '", status: "' || $status || '"}',
            ", "
        ),
        "&#10;];&#10;" ||
        "var JMX_INSTANCE = '" || $instance || "';&#10;" ||
        (if (exists($app:get-scheduled-jobs)) then
            "var JMX_ACTIVE = " || exists($app:get-scheduled-jobs()//scheduler:job[starts-with(@name, "jmx:")]) || ";&#10;"
        else
            "var JMX_ACTIVE = false;&#10;")
};

declare function app:btn-profiling($node as node(), $model as map(*)) {
    if (system:tracing-enabled()) then
        <a href="?action=disable" class="btn btn-default">
            <span class="glyphicon glyphicon-pause"/> Disable Tracing
        </a>
    else
        <a href="?action=enable" class="btn btn-default">
            <span class="glyphicon glyphicon-play"/> Enable Tracing
        </a>
};

declare 
    %templates:default("instance", "localhost")
function app:active-panel($node as node(), $model as map(*), $instance as xs:string) {
    let $items := templates:process($node/node(), $model)
    return
        element { node-name($node) } {
            $node/@*,
            let $panel := request:get-attribute("$exist:resource")
            for $li in $items
            let $active :=
                switch ($panel)
                    case "index.html" return
                        ($instance = "localhost" and $li/html:a/@href = "index.html") or
                        ($instance != "localhost" and $li/html:a/@href = "remotes.html")
                    case "collection.html" return 
                        $li/html:a/@href = "indexes.html"
                    default return
                        $li/html:a/@href = $panel
            return
                if ($active) then
                    <html:li class="active">
                    { $li/node() }
                    </html:li>
                else
                    $li
        }
};

declare
    %templates:wrap
function app:profile($node as node(), $model as map(*), $action as xs:string?) {
    switch ($action)
        case "clear" return
            system:clear-trace()
        case "enable" return
            system:enable-tracing(true())
        case "disable" return
            system:enable-tracing(false())
        default return
            (),
    map {
        "trace" := system:trace()
    }
};

declare
    %templates:wrap
    %templates:default("sort", "time")
function app:query-stats($node as node(), $model as map(*), $sort as xs:string) {
    if (empty($model("trace")/prof:query)) then
        <tr>
            <td colspan="3">No statistics available or tracing not enabled.</td>
        </tr>
    else
        let $queries :=
            for $query in $model("trace")/prof:query
            order by app:sort($query, $sort) descending
            return
                $query
        for $query in subsequence($queries, 1, 20)
        return
            <tr>
                <td>{app:truncate-source(replace($query/@source, "^.*/([^/]+)$", "$1"))}</td>
                <td class="trace-calls">{$query/@calls/string()}</td>
                <td class="trace-elapsed">{$query/@elapsed/string()}</td>
            </tr>
};

declare
    %templates:wrap
    %templates:default("sort", "time")
function app:function-stats($node as node(), $model as map(*), $sort as xs:string) {
    if (empty($model("trace")/prof:function)) then
        <tr>
            <td colspan="4">No statistics available or tracing not enabled.</td>
        </tr>
    else
        let $funcs :=
            for $func in $model("trace")/prof:function
            order by app:sort($func, $sort) descending
            return
                $func
        for $func in subsequence($funcs, 1, 20)
        return
            <tr>
                <td>{$func/@name/string()}</td>
                <td>{app:truncate-source(replace($func/@source, "^.*/([^/]+)$", "$1"))}</td>
                <td class="trace-calls">{$func/@calls/string()}</td>
                <td class="trace-elapsed">{$func/@elapsed/string()}</td>
            </tr>
};

declare
    %templates:wrap
    %templates:default("sort", "time")
function app:index-stats($node as node(), $model as map(*), $sort as xs:string) {
    if (empty($model("trace")/prof:index)) then
        <tr>
            <td colspan="4">No statistics available or tracing not enabled.</td>
        </tr>
    else
        let $indexes :=
            for $index in $model("trace")/prof:index
            order by app:sort($index, $sort) descending
            return
                $index
        for $index in subsequence($indexes, 1, 20)
        let $optimization := $app:OPTIMIZATIONS/opt[@n = $index/@optimization]/string()
        return
            <tr>
                <td>{app:truncate-source(replace($index/@source, "^.*/([^/]+)$", "$1"))}</td>
                <td class="trace-calls">{$index/@type/string()}</td>
                <td class="trace-calls">
                {
                    switch ($optimization)
                        case "No index" return
                            <span class="label label-danger">{$optimization}</span>
                        case "Full" return
                            <span class="label label-success">{$optimization}</span>
                        default return
                            <span class="label label-info">{$optimization}</span>
                }
                </td>
                <td class="trace-calls">{$index/@calls/string()}</td>
                <td class="trace-elapsed">{$index/@elapsed/string()}</td>
            </tr>
};

declare
    %templates:wrap
function app:current-user($node as node(), $model as map(*)) {
    let $user := request:get-attribute("org.exist.demo.login.user")
    return
        $user
};

declare function app:user-info($node as node(), $model as map(*)) {
    let $user := request:get-attribute("org.exist.login.user")
    let $name := sm:get-account-metadata($user, xs:anyURI("http://axschema.org/namePerson"))
    let $description := sm:get-account-metadata($user, xs:anyURI("http://exist-db.org/security/description"))
    return
        <p>
            { $name }
            <small>{ $description }</small>
        </p>
};

declare function app:form-action-to-current-url($node as node(), $model as map(*)) {
    <form action="{request:get-url()}">{
        $node/attribute()[not(name(.) = 'action')],
        $node/node()
    }</form>
};

declare %private function app:sort($function as element(), $sort as xs:string) {
    if ($sort eq "name") then
        $function/@name
    else if ($sort eq "calls") then
        xs:int($function/@calls)
    else if ($sort eq "source") then
        $function/@source
    else
        xs:double($function/@elapsed)
};

declare %private function app:truncate-source($source as xs:string) as xs:string {
    if (string-length($source) gt 60) then
        substring($source, 1, 60)
    else
        $source
};

declare
    %templates:wrap
    %templates:default("instance", "localhost")
    %templates:default("start", "")
    %templates:default("end", "")
function app:timeline($node as node(), $model as map(*), $instance as xs:string, $select as xs:string, $labels as xs:string, $type as xs:string, $start as xs:string, $end as xs:string) {
    let $labels := tokenize($labels, "\s*,\s*")
    let $xpaths := tokenize($select, "\s*,\s*")
    let $type := tokenize($type, "\s*,\s*")

    let $end := xs:dateTime(if($end = "") then (current-dateTime()) else ($end))
    let $start := xs:dateTime(if(not($start = "")) then ($start) else ($end - xs:dayTimeDuration('P1D')))
    let $jmxs := collection($config:data-root || "/" || $instance)/jmx:jmx[jmx:Database][xs:dateTime(./jmx:timestamp) ge $start][xs:dateTime(./jmx:timestamp) le $end]
    

    
    return
        if ($jmxs) then
            let $result :=
                <result>
                {
                    for $xpath at $n in $xpaths
                    let $timestamps := (for $jmx in $jmxs return app:time-to-milliseconds(xs:dateTime($jmx/jmx:timestamp)))
                    let $expression := "for $jmx in $jmxs return number((("|| $xpath ||"),0)[1])"
                    let $values := util:eval($expression, true())
                    return
                        <json:value json:array="true">
                            <label>{$labels[$n]}</label>
                            <data>
                            {
                                for $jmx at $pos in $jmxs
                                let $val := $values[$pos]
                                let $time := $timestamps[$pos]
                                where $val  (: this line filters empty results out :)
                                order by $time ascending
                                return
                                    <json:value json:array="true">
                                        <json:value json:literal="true">{$time}</json:value>
                                        <json:value json:literal="true">{$val}</json:value>
                                    </json:value>
                            }
                            </data>
                            {
                            element { $type[$n] } {
                                <show>true</show>
                            }   }
                        </json:value>
                }
                </result>
            return
                attribute data-data {
                    serialize($result, 
                        <output:serialization-parameters>
                            <output:method>json</output:method>
                        </output:serialization-parameters>
                    )
                }
        else
            attribute data-data { "[]" }
};

declare
    %templates:wrap
    %templates:default("instance", "localhost")
function app:load-record($node as node(), $model as map(*), $instance as xs:string, $timestamp as xs:long) {
    let $date := app:milliseconds-to-time($timestamp)
    let $jmx := collection($config:data-root || "/" || $instance)/jmx:jmx[jmx:timestamp = $date]
    return
        serialize($jmx)
};

declare
    %templates:wrap
function app:timestamp($node as node(), $model as map(*), $timestamp as xs:long) {
    app:milliseconds-to-time($timestamp)
};

declare function app:time-navigation-back($node as node(), $model as map(*), $instance as xs:string, $timestamp as xs:long) {
    let $date := app:milliseconds-to-time($timestamp)
    let $jmx := 
        (
            for $rec in collection($config:data-root || "/" || $instance)/jmx:jmx[jmx:timestamp < xs:dateTime($date)]
            order by xs:dateTime($rec/jmx:timestamp)
            return
                $rec
        )
        [last()]
    return
        element { node-name($node) } {
            $node/@*,
            attribute href { "?timestamp=" || app:time-to-milliseconds(xs:dateTime($jmx/jmx:timestamp)) || 
                "&amp;instance=" || $instance },
            templates:process($node/*, $model)
        }
};

declare function app:time-navigation-forward($node as node(), $model as map(*), $instance as xs:string, $timestamp as xs:long) {
    let $date := app:milliseconds-to-time($timestamp)
    let $jmx :=
        (
            for $rec in collection($config:data-root || "/" || $instance)/jmx:jmx[jmx:timestamp > xs:dateTime($date)]
            order by xs:dateTime($rec/jmx:timestamp)
            return
                $rec
        )
        [1]
    return
        element { node-name($node) } {
            $node/@*,
            attribute href { "?timestamp=" || app:time-to-milliseconds(xs:dateTime($jmx/jmx:timestamp)) || 
                "&amp;instance=" || $instance },
            templates:process($node/*, $model)
        }
};

declare  function app:time-to-milliseconds($dateTime as xs:dateTime) {
    let $diff := $dateTime - xs:dateTime("1970-01-01T00:00:00Z")
    return
        (days-from-duration($diff) * 60 * 60 * 24 +
        hours-from-duration($diff) * 60 * 60 +
        minutes-from-duration($diff) * 60 +
        seconds-from-duration($diff)) * 1000
};

declare function app:milliseconds-to-time($timestamp as xs:long) as xs:dateTime {
    let $days := xs:int($timestamp div 1000 div 24 div 60 div 60)
    let $remainder := $timestamp - ($days * 24 * 60 * 60 * 1000)
    let $hours := xs:int($remainder div 1000 div 60 div 60)
    let $remainder := $remainder - ($hours * 60 * 60 * 1000)
    let $minutes := xs:int($remainder div 1000 div 60)
    let $remainder := $remainder - ($minutes * 60 * 1000)
    let $seconds := xs:int($remainder div 1000)
    let $millis := format-number($remainder - ($seconds * 1000), "000")
    return
        xs:dateTime("1970-01-01T00:00:00Z") + 
        xs:dayTimeDuration("P" || $days || "DT" || $hours || "H" || $minutes || "M" || $seconds || "." || $millis || "S")
};

declare function app:edit-source($node as node(), $model as map(*), $instance as xs:string, $timestamp as xs:long) as node()* {
    let $date := app:milliseconds-to-time($timestamp)
    let $doc := collection($config:data-root || "/" || $instance)/jmx:jmx[jmx:timestamp = xs:dateTime($date)]
    let $link := templates:link-to-app("http://exist-db.org/apps/eXide", "index.html?open=" || document-uri(root($doc)))
    return
        element { node-name($node) } {
            attribute href { $link },
            attribute target { "eXide" },
            attribute class { $node/@class || " eXide-open" },
            attribute data-exide-open { document-uri(root($doc)) },
            $node/node()
        }
};
