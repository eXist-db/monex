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

import module namespace login="http://exist-db.org/xquery/login" at "resource:org/exist/xquery/modules/persistentlogin/login.xql";

declare variable $exist:path external;
declare variable $exist:resource external;
declare variable $exist:controller external;
declare variable $exist:prefix external;
declare variable $exist:root external;

if ($exist:path eq '') then
    <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
        <redirect url="{request:get-uri()}/"/>
    </dispatch>
    
else if ($exist:path eq "/") then
    (: forward root path to index.xql :)
    <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
        <redirect url="index.html"/>
    </dispatch>
    
else if (ends-with($exist:resource, ".html")) then (
    login:set-user("org.exist.login", (), false()),
    let $user := request:get-attribute("org.exist.login.user")
    return
        if ($user and sm:is-dba($user)) then
            (: the html page is run through view.xql to expand templates :)
            <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
                <view>
                    <forward url="{$exist:controller}/modules/view.xql">
                        <set-header name="Cache-Control" value="no-cache"/>
                    </forward>
                </view>
        		<error-handler>
        			<forward url="{$exist:controller}/error-page.html" method="get"/>
        			<forward url="{$exist:controller}/modules/view.xql"/>
        		</error-handler>
            </dispatch>
        else
            <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
                <forward url="login.html"/>
                <view>
                    <forward url="{$exist:controller}/modules/view.xql">
                        <set-header name="Cache-Control" value="no-cache"/>
                    </forward>
                </view>
        		<error-handler>
        			<forward url="{$exist:controller}/error-page.html" method="get"/>
        			<forward url="{$exist:controller}/modules/view.xql"/>
        		</error-handler>
            </dispatch>
) else if (ends-with($exist:resource, ".xql")) then (
    login:set-user("org.exist.login", (), false()),
    <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
        <cache-control cache="no"/>
    </dispatch>
) 
else
    (: everything else is passed through :)
    <dispatch xmlns="http://exist.sourceforge.net/NS/exist">
        <cache-control cache="yes"/>
    </dispatch>
