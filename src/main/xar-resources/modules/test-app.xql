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

module namespace testapp="http://exist-db.org/apps/admin/testapp";

import module namespace app="http://exist-db.org/apps/admin/templates" at "app.xql";
import module namespace console="http://exist-db.org/xquery/console";


declare namespace test="http://exist-db.org/xquery/xqsuite";


declare
    %test:arg("dateTime", "1970-01-01T00:00:00.000Z") %test:assertEquals(0)
    %test:arg("dateTime", "1971-01-01T00:00:00.000Z") %test:assertEquals(31536000000)
    %test:arg("dateTime", "2014-01-04T23:42:23.423Z") %test:assertEquals(1388878943423)
function testapp:time-to-millis($dateTime as xs:dateTime) as xs:long {
    let $millis := app:time-to-milliseconds($dateTime)
    let $debug1 := console:log("testapp:time-to-millis millis: " ||$millis)
    return 
        $millis
};


declare
    %test:arg("millis", 0) %test:assertEquals("1970-01-01T00:00:00.000Z")
    %test:arg("millis", 31536000000) %test:assertEquals("1971-01-01T00:00:00.000Z")
    %test:arg("millis", 1388878943423) %test:assertEquals("2014-01-04T23:42:23.423Z")
    %test:arg("millis", 1427846400096) %test:assertEquals("2015-04-01T00:00:00.096Z")
    %test:arg("millis", 1427846460066) %test:assertEquals("2015-04-01T00:01:00.066Z")
    %test:arg("millis", 1427846520062) %test:assertEquals("2015-04-01T00:02:00.062Z")
    
    
function testapp:millis-to-time($millis as xs:decimal) as xs:dateTime {
    let $time := app:milliseconds-to-time($millis)
    let $debug1 := console:log("testapp:time-to-millis time: " ||$time)
    
    return 
        $time
};
