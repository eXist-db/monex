xquery version "3.0";

import module namespace app="http://exist-db.org/apps/admin/templates" at "app.xql";

let $node := <test/>
let $map := map {}
let $instance := "history.state.gov"
let $select := "$jmx/jmx:Database/jmx:ActiveBrokers, $jmx/jmx:ProcessReport/jmx:RunningQueries/count(./jmx:row)"
let $labels := "Active brokers, Running queries"
let $type := "lines,lines"
return 
    app:timeline($node,$map,$instance, $select,$labels,$type)
