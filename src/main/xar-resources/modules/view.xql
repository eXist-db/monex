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
(:~
 : This is the main XQuery which will (by default) be called by controller.xql
 : to process any URI ending with ".html". It receives the HTML from
 : the controller and passes it to the templating system.
 :)
xquery version "3.1";

import module namespace templates="http://exist-db.org/xquery/html-templating";
import module namespace lib="http://exist-db.org/xquery/html-templating/lib";
(: 
 : The following modules provide functions which will be called by the 
 : templating.
 :)
import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";
import module namespace app="http://exist-db.org/apps/admin/templates" at "app.xql";
import module namespace indexes="http://exist-db.org/xquery/admin-interface/indexes" at "indexes.xqm";

declare option exist:serialize "method=html5 media-type=text/html";

let $config := map {
    $templates:CONFIG_APP_ROOT : $config:app-root,
    $templates:CONFIG_STOP_ON_ERROR : true()
}
(:
 : We have to provide a lookup function to templates:apply to help it
 : find functions in the imported application modules. The templates
 : module cannot see the application modules, but the inline function
 : below does see them.
 :)
let $lookup := function($functionName as xs:string, $arity as xs:integer) {
    try {
        function-lookup(xs:QName($functionName), $arity)
    } catch * {
        ()
    }
}
(:
 : The HTML is passed in the request from the controller.
 : Run it through the templating system and return the result.
 :)
let $content := request:get-data()
return
    templates:apply($content, $lookup, (), $config)
