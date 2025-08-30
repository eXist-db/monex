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
import module namespace test="http://exist-db.org/xquery/xqsuite" at "resource:org/exist/xquery/lib/xqsuite/xqsuite.xql";
import module namespace console="http://exist-db.org/xquery/console";

console:log("executing test suite"),
test:suite(
    inspect:module-functions(xs:anyURI("test-app.xql"))
),
console:log("finished test suite")