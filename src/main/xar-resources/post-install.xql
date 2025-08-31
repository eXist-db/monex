(:
 : SPDX LGPL-2.1-or-later
 : Copyright (C) 2017 The eXist-db Authors
 :)
xquery version "3.1";

declare namespace repo="http://exist-db.org/xquery/repo";

(: The following external variables are set by the repo:deploy function :)

(: the target collection into which the app is deployed :)
declare variable $target external;

let $data := xmldb:create-collection($target, "data")
let $col := xs:anyURI($data)
return (
    sm:chown($col, "monex"),
    sm:chgrp($col, "monex"),
    sm:chmod($col, "rw-rw----")
),
for $name in ("instances.xml", "notifications.xml")
let $res := xs:anyURI($target || "/" || $name)
return (
    sm:chown($res, "admin"),
    sm:chgrp($res, "dba"),
    sm:chmod($res, "rw-rw----")
)
