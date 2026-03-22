(:
 : SPDX LGPL-2.1-or-later
 : Copyright (C) 2014 The eXist-db Authors
 :
 : Cursor-based query execution using lsp:eval / lsp:fetch / lsp:close.
 :
 : lsp:eval($query) => map { "cursor": xs:string, "items": xs:integer, "elapsed": xs:integer }
 : lsp:fetch($cursor, $start, $count) => array of map { "value": xs:string, "type": xs:string, ... }
 : lsp:close($cursor) => xs:boolean
 :)
xquery version "3.1";

import module namespace lsp = "http://exist-db.org/xquery/lsp";

declare namespace output = "http://www.w3.org/2010/xslt-xquery-serialization";

declare option output:method "json";
declare option output:media-type "application/json";

let $action := request:get-parameter("action", ())
return
    switch ($action)

        case "eval" return
            let $query := request:get-parameter("query", ())
            return
                if (not($query)) then
                    map {
                        "error": "No query provided"
                    }
                else
                    try {
                        let $cursor := lsp:eval($query)
                        return map {
                            "cursorId": $cursor?cursor,
                            "hits": $cursor?items,
                            "elapsed": $cursor?elapsed
                        }
                    } catch * {
                        map {
                            "error": $err:description,
                            "code": $err:code,
                            "line": $err:line-number,
                            "column": $err:column-number
                        }
                    }

        case "fetch" return
            let $cursor-id := request:get-parameter("cursorId", ())
            let $start := xs:integer(request:get-parameter("start", "1"))
            let $count := xs:integer(request:get-parameter("count", "20"))
            return
                if (not($cursor-id)) then
                    map {
                        "error": "No cursorId provided"
                    }
                else
                    try {
                        let $results := lsp:fetch($cursor-id, $start, $count)
                        return map {
                            "cursorId": $cursor-id,
                            "start": $start,
                            "count": $count,
                            "items": array {
                                for $i in 1 to array:size($results)
                                return $results($i)?value
                            }
                        }
                    } catch * {
                        map {
                            "error": $err:description,
                            "code": $err:code
                        }
                    }

        case "close" return
            let $cursor-id := request:get-parameter("cursorId", ())
            return
                if ($cursor-id) then (
                    lsp:close($cursor-id),
                    map { "closed": true() }
                ) else
                    map { "error": "No cursorId provided" }

        default return
            map { "error": "Unknown action: " || $action }
