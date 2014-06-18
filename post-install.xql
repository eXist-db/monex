xquery version "3.0";

(: The following external variables are set by the repo:deploy function :)

(: the target collection into which the app is deployed :)
declare variable $target external;

let $instances := xs:anyURI($target || "/instances.xml")
return (
    sm:chown($instances, "admin"),
    sm:chgrp($instances, "dba"),
    sm:chmod($instances, "rw-rw----")
)