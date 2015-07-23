xquery version "3.0";

import module namespace app="http://exist-db.org/apps/admin/templates" at "app.xql";

declare namespace jmx="http://exist-db.org/jmx";

import module namespace templates="http://exist-db.org/xquery/templates" ;
import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";
import module namespace console="http://exist-db.org/xquery/console";


declare function local:run-timeline($header, $select, $start, $end){
    let $node := <test/>
    let $map := map {}
    let $instance := "history.state.gov"
    let $type := "lines,lines"
    let $labels := "1,2"

    let $tbegin := util:system-dateTime()
    let $result := app:timeline($node,$map,$instance, $select,$labels,$type,$start,$end)
    let $tend := util:system-dateTime()
    return "" || $header || " -- " || string(seconds-from-duration($tend - $tbegin))
};

declare function local:test-timeline(){

    (: 7d period with typical data :)
(:    let $start := "2015-07-01T00:00:00.000Z":)
(:    let $end := "2015-07-07T23:59:59.999Z":)
    
    (: 14d period with typical data :)
    let $start := "2015-06-25T00:00:00.000Z"
    let $end := "2015-07-08T23:59:59.999Z"
    let $select1 := "$jmx/jmx:ProcessReport/jmx:RecentQueryHistory/max(jmx:row/jmx:mostRecentExecutionDuration), $jmx/jmx:ProcessReport/jmx:RecentQueryHistory/avg(jmx:row/jmx:mostRecentExecutionDuration)"
    let $h1 := "max,avg"

    let $select2 := "$jmx/jmx:ProcessReport/jmx:RecentQueryHistory/avg(jmx:row/jmx:mostRecentExecutionDuration)"
    let $h2 := "avg"

    let $select3 := "$jmx/jmx:Database/jmx:ActiveBrokers"
    let $h3 := "brokers"

    let $select4 := "1"
    let $h4 := "dummy 1"

    return 
        (
(:            local:run-timeline($h1, $select1, $start, $end),:)
            local:run-timeline($h2, $select2, $start, $end),
            local:run-timeline($h3, $select3, $start, $end),
            local:run-timeline($h4, $select4, $start, $end),
            ()
        )
};

local:test-timeline()
