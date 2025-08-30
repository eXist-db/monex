(:
 : SPDX LGPL-2.1-or-later
 : Copyright (C) 2017 The eXist-db Authors
 :)
(:
 : SPDX LGPL-2.1
 : Copyright (C) 2017 The eXist-db Authors
 :)
(:
 : eXist-db Open Source Native XML Database
 : Copyright (C) 2017 The eXist-db Authors
 : SPDX LGPL-2.1
 :)
(:
 : eXist-db Open Source Native XML Database
 : Copyright (C) 2017 The eXist-db Authors
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

import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";
import module namespace http="http://expath.org/ns/http-client";

let $instances := collection($config:app-root)//instance
let $name := request:get-parameter("name", ())
let $operation := request:get-parameter("operation", ())
let $instance := $instances[@name = $name]
let $baseURL :=
    if ($operation) then
        $instance/@url || "/status?operation=" || $operation || "&amp;token=" || $instance/@token
    else
        $instance/@url ||
        "/status?c=instances&amp;c=processes&amp;c=locking&amp;c=memory&amp;c=caches&amp;c=system&amp;c=operatingsystem&amp;token=" ||
        $instance/@token
let $extraParams :=
    string-join(
        for $param in request:get-parameter-names()
        let $values := request:get-parameter($param, ())
        where not($param = ("name", "operation"))
        return
            $values ! ($param || "=" || .),
        "&amp;"
    )
let $url :=
    if ($extraParams != "") then
        $baseURL || "&amp;" || $extraParams
    else
        $baseURL
let $request :=
    <http:request method="GET" href="{$url}" timeout="30"/>
let $response := http:send-request($request)
return
    if ($response[1]/@status = "200") then
        $response[2]
    else (
        response:set-status-code(500),
        $response[1]/@message/string()
    )
