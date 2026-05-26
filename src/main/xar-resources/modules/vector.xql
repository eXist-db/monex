(:
 : SPDX LGPL-2.1-or-later
 : Copyright (C) 2014 The eXist-db Authors
 :)
xquery version "3.1";

declare option exist:serialize "method=json media-type=application/json";

import module namespace monex-vector = "http://exist-db.org/xquery/monex/vector"
    at "vector.xqm";

monex-vector:diagnostics-map()
