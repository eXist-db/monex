xquery version "3.0";

(: The following external variables are set by the repo:deploy function :)

(: the target collection into which the app is deployed :)
declare variable $target external;

for $name in ("instances.xml", "notifications.xml")
let $res := xs:anyURI($target || "/" || $name)
return (
    sm:chown($res, "admin"),
    sm:chgrp($res, "dba"),
    sm:chmod($res, "rw-rw----")
)