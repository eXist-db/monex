xquery version "3.0";

import module namespace app="http://exist-db.org/apps/admin/templates" at "app.xql";

let $node := <test/>
let $map := map {}
let $instance := "history.state.gov"
let $type := "lines,lines"

(: Active Brokers and Running Queries
let $select := "$jmx/jmx:Database/jmx:ActiveBrokers, $jmx/jmx:ProcessReport/jmx:RunningQueries/count(./jmx:row)"
let $labels := "Active brokers, Running queries"

:)

(: Process CPU Load and System CPU Load
let $select := "$jmx/jmx:OperatingSystemImpl/jmx:ProcessCpuLoad, $jmx/jmx:OperatingSystemImpl/jmx:SystemCpuLoad"
let $labels := "Process CPU Load, System CPU Load"
:)

let $select := "$jmx/jmx:OperatingSystemImpl/jmx:ProcessCpuLoad, $jmx/jmx:OperatingSystemImpl/jmx:SystemCpuLoad"
let $labels := "Process CPU Load, System CPU Load"
return
    app:timeline($node,$map,$instance, $select,$labels,$type)
