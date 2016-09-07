xquery version "3.0";

import module namespace scheduler="http://exist-db.org/xquery/scheduler" at "java:org.exist.xquery.modules.scheduler.SchedulerModule";
import module namespace config="http://exist-db.org/apps/admin/config" at "config.xqm";

for $instance in collection($config:app-root)//instance
return (
    (
    let $cron := ($instance/@cron, "0 * * * * ?")[1]
    let $operation := if (exists($instance//alert) and not (exists($instance//test)))
                      then ("ping")
                      else if (exists($instance//alert) and exists($instance//test))
                      then ("ping+test")
                      else if (not (exists($instance//alert)) and exists($instance//test))
                      then ("test")
                      else
                          ()
    let $params :=
        <parameters>
            <param name="name" value="{$instance/@name}"/>
            <param name="operation" value="{$operation}"/>
            <param name="app-root" value="{$config:app-root}"/>
            <param name="data-root" value="{$config:data-root}"/>
        </parameters>
    let $result :=
        scheduler:schedule-xquery-cron-job($config:app-root || "/modules/job.xql",
            $cron, "jmx:" || $instance/@name, $params)
            return
                ()
    ),
    (
    for $alerts in $instance/poll
    let $cron := ($alerts/@cron, "0 * * * * ?")[1]
    let $operation := if(exists($instance//alert) and not(exists($instance//test)))
                      then("jmx")
                      else if(exists($instance//alert) and exists($instance//test))
                      then ("jmx+test")
                      else if(not(exists($instance//alert)) and exists($instance//test))
                      then ("test")
                      else
                          ()
    let $params :=
        <parameters>
            <param name="name" value="{$instance/@name}"/>
            <param name="operation" value="{$operation}"/>
            <param name="app-root" value="{$config:app-root}"/>
            <param name="data-root" value="{$config:data-root}"/>
        </parameters>
    let $result :=
        scheduler:schedule-xquery-cron-job($config:app-root || "/modules/job.xql",
            $cron, "jmx:" || $instance/@name || "-poll", $params)
    return
        ()
    )
)
