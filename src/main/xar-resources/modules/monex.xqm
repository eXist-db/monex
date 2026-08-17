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
 : Delegates to system:get-jmx-token() where available (eXist > 7.0.0-beta3,
 : see https://github.com/eXist-db/exist/issues/6620), which resolves the
 : token exactly as JMXServlet itself does — via the DiskUsage MBean's
 : DataDirectory attribute — so the two cannot diverge. On older versions it
 : falls back to reading {exist-home}/data/jmxservlet.token, a guess that
 : only holds for the default on-disk layout (see issue #411).
 :
 : @return the JMX token string, or empty sequence if not available
 :)
declare function monex:jmx-token() as xs:string? {
    let $get-jmx-token := function-lookup(xs:QName("system:get-jmx-token"), 0)
    return
        if (exists($get-jmx-token)) then
            $get-jmx-token()
        else
            monex:jmx-token-from-default-layout()
};

(:~
 : Legacy fallback for eXist versions without system:get-jmx-token():
 : read the token file from the default data directory location. This
 : cannot work when db-connection/@files in conf.xml points elsewhere.
 :
 : @return the JMX token string, or empty sequence if not available
 :)
declare %private function monex:jmx-token-from-default-layout() as xs:string? {
    let $token-file := system:get-exist-home() || "/data/jmxservlet.token"
    return
        if (file:exists($token-file)) then
            (: token file is a Java properties file with key=value lines :)
            (
                for $line in tokenize(file:read($token-file), "\n")
                let $trimmed := normalize-space($line)
                where starts-with($trimmed, "token=")
                return substring-after($trimmed, "token=")
            )[1]
        else
            ()
};
