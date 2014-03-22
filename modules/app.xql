xquery version "3.0";

module namespace app="http://exist-db.org/apps/admin/templates";

declare namespace html="http://www.w3.org/1999/xhtml";
declare namespace prof="http://exist-db.org/xquery/profiling";

import module namespace templates="http://exist-db.org/xquery/templates" ;
import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";

declare variable $app:OPTIMIZATIONS :=
    <optimizations>
        <opt n="0">No index</opt>
        <opt n="1">Basic</opt>
        <opt n="2">Full</opt>
    </optimizations>;
    
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
    %templates:wrap
    %templates:default("panel", "index.html")
function app:active-panel($node as node(), $model as map(*)) {
    let $panel := request:get-attribute("$exist:resource")
    for $li in $node/html:li
    return
        if ($li/html:a[@href = $panel] or ($panel = "collection.html" and $li/html:a/@href = "indexes.html")) then
            <html:li class="active">
            { $li/node() }
            </html:li>
        else
            $li
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
                        case "No Index" return
                            <span class="label label-important">{$optimization}</span>
                        case "Full" return
                            <span class="label label-success">{$optimization}</span>
                        default return
                            <span class="label label-warning">{$optimization}</span>
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
    let $user := request:get-attribute("org.exist.demo.login.user")
    let $name := sm:get-account-metadata($user, xs:anyURI("http://axschema.org/namePerson"))
    let $description := sm:get-account-metadata($user, xs:anyURI("http://exist-db.org/security/description"))
    return
        <p>
            { $name }
            <small>{ $description }</small>
        </p>
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