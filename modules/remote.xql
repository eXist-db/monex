xquery version "3.0";

import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";

let $instances := collection($config:app-root)//instance
let $name := request:get-parameter("name", ())
let $operation := request:get-parameter("operation", ())
let $instance := $instances[@name = $name]
let $url :=
    switch($operation)
        case "ping" return
            $instance/@url || "/status?operation=ping&amp;token=" || $instance/@token
        default return
            $instance/@url || 
            "/status?c=instances&amp;c=processes&amp;c=locking&amp;c=memory&amp;c=caches&amp;c=system&amp;token=" ||
            $instance/@token
return
    httpclient:get(xs:anyURI($url), false(), ())//httpclient:body/*