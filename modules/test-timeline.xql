xquery version "3.0";

import module namespace app="http://exist-db.org/apps/admin/templates" at "app.xql";

declare namespace jmx="http://exist-db.org/jmx";

import module namespace templates="http://exist-db.org/xquery/templates" ;
import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";
import module namespace console="http://exist-db.org/xquery/console";


declare function local:test-timeline-brokers($node,$map,$instance,$type){
    let $select := "$jmx/jmx:Database/jmx:ActiveBrokers, $jmx/jmx:ProcessReport/jmx:RunningQueries/count(./jmx:row)"
    let $labels := "Active brokers, Running queries"
    return 
        app:timeline($node,$map,$instance, $select,$labels,$type)
};

declare function local:test-timeline-cpu($node,$map,$instance,$type){
    let $select := "$jmx/jmx:OperatingSystemImpl/jmx:ProcessCpuLoad, $jmx/jmx:OperatingSystemImpl/jmx:SystemCpuLoad"
    let $labels := "Process CPU Load, System CPU Load"
    return 
        app:timeline($node,$map,$instance, $select,$labels,$type)
};

declare function local:test-timeline(){
    let $node := <test/>
    let $map := map {}
    let $instance := "exist-db.org"
    let $type := "lines,lines"

    return 
        (
            local:test-timeline-brokers($node,$map,$instance,$type),
            local:test-timeline-cpu($node,$map,$instance,$type)
        )
};

declare function local:test-xpath-expression-with-eval($instance){
        let $jmx := collection($config:data-root || "/" || $instance)/jmx:jmx[jmx:Database]
        return 
            if ($jmx) 
                then (util:eval("$jmx//jmx:ProcessCpuLoad",false()))
                else ("error")
    
};

declare function local:test-xpath-expression-without-eval($instance){
        let $jmx := collection($config:data-root || "/" || $instance)/jmx:jmx[jmx:Database]
        return 
            $jmx//jmx:ProcessCpuLoad
};

(:  
 local:test-timeline()
:)

local:test-xpath-expression-without-eval("exist-db.org")


    

