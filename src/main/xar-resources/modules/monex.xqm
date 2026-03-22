xquery version "3.1";

(:~
 : Monex-specific utility functions.
 :
 : @version 5.0.0
 :)
module namespace monex = "http://exist-db.org/xquery/monex";

import module namespace file = "http://exist-db.org/xquery/file";

(:~
 : Retrieve the JMX authentication token.
 : Only DBA users may call this function.
 :
 : @return the JMX token string, or empty sequence if not available
 :)
declare function monex:jmx-token() as xs:string? {
    let $data-dir := system:get-exist-home() || "/data"
    let $token-file := $data-dir || "/jmxservlet.token"
    return
        if (file:exists($token-file)) then
            let $content := file:read($token-file)
            (: token file is a Java properties file with key=value lines :)
            let $lines := tokenize($content, "\n")
            for $line in $lines
            let $trimmed := normalize-space($line)
            where starts-with($trimmed, "token=")
            return substring-after($trimmed, "token=")
        else
            ()
};
