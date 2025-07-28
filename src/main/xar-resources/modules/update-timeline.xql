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

declare namespace html="http://www.w3.org/1999/xhtml";
declare namespace prof="http://exist-db.org/xquery/profiling";
declare namespace jmx="http://exist-db.org/jmx";
declare namespace output="http://www.w3.org/2010/xslt-xquery-serialization";
declare namespace json="http://www.json.org";

import module namespace app="http://exist-db.org/apps/admin/templates" at "app.xql";
import module namespace scheduler="http://exist-db.org/xquery/scheduler" at "java:org.exist.xquery.modules.scheduler.SchedulerModule";
import module namespace templates="http://exist-db.org/xquery/html-templating";
import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";

declare option exist:serialize "method=json media-type=text/javascript";


let $node := <test/>
let $map := map {}
let $instance := request:get-parameter("instance", "")
let $start := request:get-parameter("start","")
let $end := request:get-parameter("end","")
let $id := request:get-parameter("id","") 

return 
    app:default-timeline($node, $map ,$instance, $id , $start, $end)  


(: 
let $instance := request:get-parameter("instance", "history.state.gov")
let $start := request:get-parameter("start","2015-06-28T09:00:00.028Z")
let $end := request:get-parameter("end","2015-06-28T10:00:00.028Z")
let $id := request:get-parameter("id","cpu-graph") 

let $ids := ("brokers-graph", "threads-graph", "cpu-graph", "memory-graph", "slow-queries-graph")
for $id in $ids
    return app:default-timeline($node, $map ,$instance, $id , $start, $end)
 :)
