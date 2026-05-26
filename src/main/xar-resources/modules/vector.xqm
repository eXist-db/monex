xquery version "3.1";

(:~
 : Vector diagnostics for Monex monitoring UI.
 :)
module namespace monex-vector = "http://exist-db.org/xquery/monex/vector";

declare namespace output = "http://www.w3.org/2010/xslt-xquery-serialization";

declare function monex-vector:diagnostics-map() as map(*) {
    let $diagnostics := function-lookup(
        fn:QName("http://exist-db.org/xquery/vector", "diagnostics"),
        0
    )
    return
        if (empty($diagnostics)) then
            map {
                "available": false(),
                "models": array { },
                "ready": 0,
                "total": 0
            }
        else
            let $models := $diagnostics()
            let $maps :=
                for $model in $models
                return map {
                    "id": $model/@id/string(),
                    "source": $model/@source/string(),
                    "path": $model/@path/string(),
                    "dimension": xs:integer($model/@dimension),
                    "status": $model/@status/string(),
                    "message": ($model/@message/string(), "")[1],
                    "provider": if ($model/@status/string() eq "http") then "HTTP" else "ONNX"
                }
            return
                map {
                    "available": true(),
                    "models": array { $maps },
                    "ready": count($models[@status eq "available"]),
                    "total": count($models)
                }
};

declare function monex-vector:diagnostics-json() as xs:string {
    serialize(
        monex-vector:diagnostics-map(),
        element output:serialization-parameters {
            attribute method { "json" }
        }
    )
};
