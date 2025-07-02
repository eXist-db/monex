(:
 : eXist-db Open Source Native XML Database
 : Copyright (C) 2014 The eXist-db Authors
 :
 : info@exist-db.org
 : https://www.exist-db.org
 :
 : This library is free software; you can redistribute it and/or
 : modify it under the terms of the GNU Lesser General Public
 : License as published by the Free Software Foundation; either
 : version 2.1 of the License, or (at your option) any later version.
 :
 : This library is distributed in the hope that it will be useful,
 : but WITHOUT ANY WARRANTY; without even the implied warranty of
 : MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 : Lesser General Public License for more details.
 :
 : You should have received a copy of the GNU Lesser General Public
 : License along with this library; if not, write to the Free Software
 : Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
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
