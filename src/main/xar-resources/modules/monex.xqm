xquery version "3.1";

(:~
 : Monex-specific utility functions.
 :
 : @version 5.0.0
 :)
module namespace monex = "http://exist-db.org/xquery/monex";

import module namespace file = "http://exist-db.org/xquery/file";

(:~
 : Candidate directories that may hold the `jmxservlet.token` file, in
 : priority order. eXist's own JMXServlet locates the token in the *resolved*
 : data directory (`db-connection/@files` from conf.xml), not in a fixed
 : `{exist-home}/data`. We mirror that: honour an explicit override, then the
 : configured value, then the two standard on-disk layouts. Only non-empty,
 : de-duplicated paths are returned.
 :
 : @return candidate directory paths, without trailing slash
 :)
declare %private function monex:data-dir-candidates() as xs:string* {
    let $home := system:get-exist-home()
    let $conf-files :=
        try {
            for $conf in ($home || "/etc/conf.xml", $home || "/conf.xml")
            where file:exists($conf)
            let $files := parse-xml(file:read($conf))/exist/db-connection/@files/string()
            where normalize-space($files) ne ''
            return
                (: an absolute path is used as-is; a relative one resolves
                   against exist-home, exactly as eXist itself does :)
                if (starts-with($files, "/")) then $files
                else $home || "/" || $files
        } catch * {
            ()
        }
    return
        distinct-values((
            util:system-property("exist.data.dir"),   (: honoured only if explicitly -D set :)
            $conf-files,
            $home || "/data",
            $home || "/webapp/WEB-INF/data"           (: standard webapp layout :)
        )[normalize-space(.) ne ''])
};

(:~
 : Retrieve the JMX authentication token.
 : Only DBA users may call this function.
 :
 : @return the JMX token string, or empty sequence if not available
 :)
declare function monex:jmx-token() as xs:string? {
    let $token-file :=
        (monex:data-dir-candidates() ! (. || "/jmxservlet.token"))[file:exists(.)][1]
    return
        if (exists($token-file)) then
            (: token file is a Java properties file with key=value lines :)
            let $tokens :=
                for $line in tokenize(file:read($token-file), "\n")
                let $trimmed := normalize-space($line)
                where starts-with($trimmed, "token=")
                return substring-after($trimmed, "token=")
            return head($tokens)
        else
            ()
};
