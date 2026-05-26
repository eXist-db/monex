(:
 : SPDX LGPL-2.1-or-later
 : Copyright (C) 2014 The eXist-db Authors
 :)
xquery version "3.1";

(:
    Module: Browse Indexes: See an overview of .xconf files stored in /db/system/config, 
    and browse the associated index keys.
    
    TODO: remove legacy fulltext code when it has been cut out of eXist-db 2.0
:)

module namespace indexes="http://exist-db.org/xquery/admin-interface/indexes";

declare namespace cc="http://exist-db.org/collection-config/1.0";
declare namespace range="http://exist-db.org/xquery/range";

(:import module namespace console="http://exist-db.org/xquery/console";:)
import module namespace templates="http://exist-db.org/xquery/html-templating";

(: 
    Global variables - derived from URL parameters
:)
declare variable $indexes:start-value := 
    request:get-parameter('start-value', '');
declare variable $indexes:callback as function(xs:anyAtomicType, xs:unsignedInt+) as item()* := indexes:term-callback#2;
declare variable $indexes:max-number-returned := xs:integer(request:get-parameter('max', 100));
declare variable $indexes:index := request:get-parameter('index', '');
declare variable $indexes:sortby := request:get-parameter('sortby', 'term');
declare variable $indexes:sortorder := request:get-parameter('sortorder', 'ascending');
declare variable $indexes:node-name := request:get-parameter('node-name', '');
declare variable $indexes:field := request:get-parameter("field", "");
declare variable $indexes:fields := request:get-parameter("fields", "");
declare variable $indexes:match := request:get-parameter('match', '');
declare variable $indexes:collection := request:get-parameter('collection', '');
declare variable $indexes:facet := request:get-parameter('facet', '');
declare variable $indexes:hierarchical := request:get-parameter('hierarchical', '');
declare variable $indexes:node-set := 
    if ($indexes:node-name ne '' and $indexes:collection ne '') then 
        indexes:get-nodeset-from-qname($indexes:collection, $indexes:node-name) 
    else if ($indexes:match ne '' and $indexes:collection ne '') then 
        indexes:get-nodeset-from-match($indexes:collection, $indexes:match) 
    else 
        ();
declare variable $indexes:qname := 
    if ($indexes:node-name ne '') then 
        if (not(matches($indexes:node-name, 'xml:')) and contains($indexes:node-name, ':')) then
            QName(
                indexes:get-namespace-uri-from-node-name($indexes:node-name, $indexes:collection), 
                if (starts-with($indexes:node-name, '@')) then substring-after($indexes:node-name, '@') else $indexes:node-name
            ) 
        else 
            xs:QName($indexes:node-name)
    else ();
declare variable $indexes:show-keys-by := request:get-parameter('show-keys-by', '');
declare variable $indexes:index-names :=
    <code-table>
        <name>Index Types</name>
        <description>This is the list of known index types and their labels.</description>
        <items>
            <item>
                <label>Lucene</label>
                <value>lucene-index</value>        
            </item>
            <item>
                <label>NGram</label>
                <value>ngram-index</value>
            </item>
            <item>
                <label>Range</label>
                <value>range-index</value>
            </item>
            <item>
                <label>New Range</label>
                <value>new-range-index</value>
            </item>
            <item>
                <label>Legacy Fulltext</label>
                <value>legacy-fulltext-index</value>
            </item>
        </items>
    </code-table>;

declare variable $indexes:range-lookup := 
    (
        function-lookup(xs:QName("range:index-keys-for-field"), 4),
        function-lookup(xs:QName("range:index-keys-for-field"), 3)
    )[1];

declare function indexes:xconf-stats($xconf as element(cc:collection)) as map(*) {
    let $fulltext := $xconf/cc:index/cc:fulltext
    let $legacy-ft :=
        count($fulltext/cc:create)
        + (
            if ($fulltext/@default != "none" and $fulltext/@attributes != "false") then 1
            else if ($fulltext/@default != "none" or $fulltext/@attributes = "true") then 1
            else 0
        )
    return
        map {
            "lucene": count($xconf//cc:lucene/cc:text),
            "vector-field": count($xconf//cc:vector-field),
            "vector-store": ($xconf//cc:lucene/@vector-store/string())[1],
            "ngram": count($xconf//cc:ngram),
            "range": count($xconf/cc:index/cc:create[not(ancestor::cc:range)]),
            "new-range": count($xconf//cc:range/cc:create) + count($xconf//cc:range//cc:field),
            "legacy-ft": $legacy-ft
        }
};

declare function indexes:stats-total($stats as map(*)) as xs:integer {
    sum((
        ($stats?lucene, 0)[1],
        ($stats?ngram, 0)[1],
        ($stats?range, 0)[1],
        ($stats?new-range, 0)[1],
        ($stats?legacy-ft, 0)[1]
    ))
};

declare function indexes:vector-collection-badge($stats as map(*)) as element(span)? {
    let $fields := ($stats?vector-field, 0)[1]
    let $store := string($stats?vector-store)
    return
        if ($fields gt 0 or $store ne "") then
            <span class="label label-info indexes-type-badge indexes-vector-summary-badge"
                  title="{string-join(
                      (
                          if ($fields gt 0) then
                              concat($fields, ' vector-field', if ($fields gt 1) then 's' else '')
                          else (),
                          if ($store ne "") then concat('vector store: ', $store) else ()
                      ),
                      ' · '
                  )}">
                Vector
            </span>
        else ()
};

declare function indexes:collection-type-badges($stats as map(*)) as element(span)* {
    (
        if (($stats?lucene, 0)[1] gt 0) then indexes:index-badge("lucene-index") else (),
        if (($stats?ngram, 0)[1] gt 0) then indexes:index-badge("ngram-index") else (),
        if (($stats?range, 0)[1] gt 0) then indexes:index-badge("range-index") else (),
        if (($stats?new-range, 0)[1] gt 0) then indexes:index-badge("new-range-index") else (),
        if (($stats?legacy-ft, 0)[1] gt 0) then indexes:index-badge("legacy-fulltext-index") else (),
        indexes:vector-collection-badge($stats)
    )
};

declare function indexes:index-label($index-name as xs:string) as xs:string {
    ($indexes:index-names//item[value eq $index-name]/label/text(), $index-name)[1]
};

declare function indexes:index-badge($index-name as xs:string) as element(span) {
    let $class :=
        switch ($index-name)
            case "lucene-index" return "label-primary"
            case "ngram-index" return "label-default"
            case "range-index" return "label-success"
            case "new-range-index" return "label-success"
            case "legacy-fulltext-index" return "label-warning"
            default return "label-default"
    return
        <span class="label {$class} indexes-type-badge">{indexes:index-label($index-name)}</span>
};

declare function indexes:vector-badge() as element(span) {
    <span class="label label-info vector-stat-badge">KNN</span>
};

declare function indexes:kpi-cell($label as xs:string, $value as xs:string) as element(div) {
    <div class="kpi-cell kpi-neutral">
        <span class="kpi-label">{$label}</span>
        <span class="kpi-value">{$value}</span>
    </div>
};

declare function indexes:collection-kpi($stats as map(*)) as element(div) {
    <div class="kpi-strip indexes-kpi">{
        indexes:kpi-cell("Lucene", string(($stats?lucene, 0)[1])),
        indexes:kpi-cell("Legacy range", string(($stats?range, 0)[1])),
        indexes:kpi-cell("New range", string(($stats?new-range, 0)[1])),
        indexes:kpi-cell("NGram", string(($stats?ngram, 0)[1])),
        indexes:kpi-cell("Vector fields", string(($stats?vector-field, 0)[1])),
        if (string($stats?vector-store) ne "") then
            indexes:kpi-cell("Vector store", string($stats?vector-store))
        else ()
    }</div>
};

declare function indexes:vector-field-label($field as element(cc:vector-field)) as xs:string {
    concat(
        $field/@name/string(),
        " · ",
        $field/@dimension/string(),
        "d · ",
        $field/@similarity/string()
        ,
        if ($field/@embedding) then concat(" · ", $field/@embedding/string()) else ()
        ,
        if ($field/@model) then concat(" · ", $field/@model/string()) else ()
    )
};

declare function indexes:type-detail-cell($text as xs:string) as element(td) {
    <td class="indexes-type-detail">{if (normalize-space($text) ne "") then $text else <span class="indexes-item-muted">—</span>}</td>
};

declare function indexes:browse-link($href as xs:string, $label as xs:string) as element(a) {
    <a href="{$href}">{$label}</a>
};

declare function indexes:lucene-index-keys-links(
    $collection as xs:string,
    $qname as xs:string?,
    $match as xs:string?
) as item()* {
    let $target :=
        if ($qname) then concat('node-name=', $qname) else concat('match=', $match)
    return (
        indexes:browse-link(
            concat('index-keys.html', indexes:replace-parameters((
                $target,
                concat('collection=', $collection),
                'index=lucene-index',
                'show-keys-by=qname'
            ))),
            'Browse qname'
        ),
        ', ',
        indexes:browse-link(
            concat('index-keys.html', indexes:replace-parameters((
                $target,
                concat('collection=', $collection),
                'index=lucene-index',
                'show-keys-by=node'
            ))),
            'Browse node'
        )
    )
};

declare function indexes:index-keys-link(
    $collection as xs:string,
    $index as xs:string,
    $show-keys-by as xs:string,
    $params as xs:string*
) as element(a) {
    let $label :=
        switch ($show-keys-by)
            case 'qname' return 'Browse qname'
            case 'field' return 'Browse field'
            default return 'Browse node'
    return
        indexes:browse-link(
            concat('index-keys.html', indexes:replace-parameters((
                $params,
                concat('collection=', $collection),
                concat('index=', $index),
                concat('show-keys-by=', $show-keys-by)
            ))),
            $label
        )
};

(:
    Main function: outputs the page.
:)
declare 
    %templates:wrap
function indexes:summary($node as node(), $model as map(*)) {
    let $xconfs := collection('/db/system/config/')/cc:collection[cc:index][ends-with(util:document-name(.), '.xconf')]
    let $total-collections := count($xconfs)
    let $vector-collections :=
        count(
            for $xconf in $xconfs
            where exists($xconf//cc:vector-field) or string($xconf//cc:lucene/@vector-store) ne ""
            return $xconf
        )
    return
        if (empty($xconfs)) then
            (
            <div class="box-header with-border">
                <h3 class="box-title">Index configurations</h3>
            </div>,
            <div class="box-body">
                <div class="indexes-empty-state">
                    <p class="indexes-empty-title">No index configurations found</p>
                    <p class="indexes-empty-hint">
                        Add <code>collection.xconf</code> files under
                        <code>/db/system/config</code> (mirroring your data collection paths) to
                        define Lucene, range, ngram, and vector indexes.
                    </p>
                </div>
            </div>
            )
        else (
            <div class="box-header with-border">
                <h3 class="box-title">Index configurations</h3>
            </div>,
            <div class="box-body no-padding">
                <div class="kpi-strip indexes-kpi">
                    {indexes:kpi-cell("Collections", string($total-collections))}
                    {indexes:kpi-cell("With vector", string($vector-collections))}
                </div>
                <h4 class="indexes-section-title">Configured collections</h4>
                <div class="indexes-table-wrap">
                    <table class="table table-striped indexes-collection-list">
                        <thead>
                            <tr>
                                <th>Collection</th>
                                <th>Index types</th>
                                <th class="text-right">Definitions</th>
                            </tr>
                        </thead>
                        <tbody>{
                            for $xconf in $xconfs
                            let $data-collection-name := substring-after(util:collection-name($xconf), '/db/system/config')
                            let $stats := indexes:xconf-stats($xconf)
                            let $badges := indexes:collection-type-badges($stats)
                            order by $data-collection-name
                            return
                                <tr>
                                    <td>
                                        <a href="collection.html?collection={$data-collection-name}">{$data-collection-name}</a>
                                    </td>
                                    <td>{ $badges, if (empty($badges)) then <span class="indexes-item-muted">—</span> else () }</td>
                                    <td class="text-right">{indexes:stats-total($stats)}</td>
                                </tr>
                        }</tbody>
                    </table>
                </div>
            </div>
        )
};

declare
    %templates:wrap
function indexes:current-collection($node as node(), $model as map(*)) {
    <a href="collection.html?collection={$indexes:collection}">{$indexes:collection}</a>
};

declare
    %templates:wrap
function indexes:current-index($node as node(), $model as map(*)) {
    indexes:index-name-to-label($indexes:index) || " Index on " || ($indexes:node-name, $indexes:match, $indexes:field)[normalize-space(.) ne ''][1]
};

declare
    %templates:wrap
function indexes:current-facet($node as node(), $model as map(*)) {
    $indexes:facet || " facet"
};

declare
    %templates:wrap
function indexes:current-field($node as node(), $model as map(*)) {
    $indexes:field || " field"
};

(:
    Transforms an index definition into an HTML table.
:)
declare function indexes:xconf-to-table($node as node(), $model as map(*)) as item()* {
    let $data-collection-name := $indexes:collection
    let $xconf-collection-name := concat('/db/system/config', $data-collection-name)
    let $xconf := collection('/db/system/config')/cc:collection[util:collection-name(.) = $xconf-collection-name]
    let $resource := $xconf-collection-name || '/' || xmldb:get-child-resources($xconf-collection-name)[ends-with(., '.xconf')]
    let $link := $model?eXide || "/index.html?open=" || $resource
    let $stats := if ($xconf) then indexes:xconf-stats($xconf) else map {}
    let $has-data := xmldb:collection-available($data-collection-name)
    return
        if (not($xconf)) then
            <div class="indexes-empty-state">
                <p class="indexes-empty-title">No configuration for this collection</p>
                <p class="indexes-empty-hint">
                    Expected <code>{ $xconf-collection-name }</code> with a
                    <code>collection.xconf</code> file.
                </p>
            </div>
        else
            <div>
                {indexes:collection-kpi($stats)}
                <div class="indexes-exide-link">
                    <a href="{$link}" target="eXide" class="eXide-open" data-exide-open="{$resource}">Open .xconf in eXide</a>
                    {if (not($has-data)) then <span class="indexes-no-data">Data collection missing</span> else ()}
                </div>
                {if (string($stats?vector-store) ne "") then
                    <p class="panel-subhead indexes-vector-store-subhead">
                        Vector store: <strong>{string($stats?vector-store)}</strong>
                        {' '}{indexes:vector-badge()}
                    </p>
                else ()}
                <h4 class="indexes-section-title">Index definitions</h4>
                <div class="indexes-table-wrap">
                    <table class="table table-striped indexes-definitions">
                        <thead>
                            <tr>
                                <th>Item indexed</th>
                                <th>Type</th>
                                <th>Detail</th>
                                <th>Browse keys</th>
                            </tr>
                        </thead>
                        <tbody>{
                            for $entry in (
                                indexes:analyze-legacy-fulltext-indexes($xconf),
                                indexes:analyze-lucene-indexes($xconf),
                                indexes:analyze-range-indexes($xconf),
                                indexes:analyze-ngram-indexes($xconf),
                                if (exists($indexes:range-lookup)) then (
                                    indexes:analyze-new-range-indexes($xconf),
                                    indexes:analyze-new-range-index-fields($xconf)
                                ) else ()
                            )
                            return $entry
                        }</tbody>
                    </table>
                </div>
            </div>
};

(:
    Shows the index keys on a given nodeset or QName
:)
declare 
    %templates:wrap
function indexes:show-index-keys($node as node(), $model as map(*)) {
    let $query-start-time := util:system-time()
    let $keys := 
        (: range indexes can use util:index-keys() without specifying the index :)
        if ($indexes:index eq 'range-index') then
            if (util:index-type($indexes:node-set) eq 'xs:string') then 
                util:index-keys($indexes:node-set, $indexes:start-value, $indexes:callback, $indexes:max-number-returned)
            else 
                let $start-value := 
                    if (util:index-type($indexes:node-set) eq 'xs:double') then 
                        if ($indexes:start-value castable as xs:double) then xs:double($indexes:start-value) else xs:double(0)
                    else if (util:index-type($indexes:node-set) eq 'xs:float') then 
                        if ($indexes:start-value castable as xs:float) then xs:float($indexes:start-value) else xs:float(0)
                    else if (util:index-type($indexes:node-set) eq 'xs:decimal') then 
                        if ($indexes:start-value castable as xs:decimal) then xs:decimal($indexes:start-value) else xs:decimal(0)
                    else if (util:index-type($indexes:node-set) eq 'xs:boolean') then 
                        if ($indexes:start-value castable as xs:boolean) then xs:boolean($indexes:start-value) else xs:boolean(0)
                    else if (util:index-type($indexes:node-set) eq 'xs:dateTime') then 
                        if ($indexes:start-value castable as xs:dateTime) then xs:dateTime($indexes:start-value) else xs:dateTime('0001-01-01T00:00:00-00:00')                  
                    else if (util:index-type($indexes:node-set) eq 'xs:date') then 
                        if ($indexes:start-value castable as xs:date) then xs:date($indexes:start-value) else xs:date('0001-01-01')                  
                    else 
                        if ($indexes:start-value castable as xs:integer) then xs:integer($indexes:start-value) 
                    else 
                        0
                return util:index-keys($indexes:node-set, $start-value, $indexes:callback, $indexes:max-number-returned)
        (: all other indexes need to specify the index in the 5th parameter of util:index-keys() :)
        else
            let $index := if ($indexes:index = "new-range-index") then "range-index" else $indexes:index
            return
                switch ($indexes:show-keys-by)
                    case "field" return
                      let $rows :=
                        (: Use the range function in $indexes:range-lookup to determine which arity to 
                          use with range:index-keys-for-field(). We can't re-use $indexes:range-lookup 
                          as a function here, because the global variable was not initialized explicitly 
                          with collection($indexes:collection). This method is probably why we get 
                          results on a document-by-document basis, but the alternative is not getting 
                          any results at all. :)
                        if (function-arity($indexes:range-lookup) = 4) then
                            collection($indexes:collection)/range:index-keys-for-field($indexes:field, $indexes:start-value, $indexes:callback, 
                               xs:int($indexes:max-number-returned))
                        else
                            collection($indexes:collection)/range:index-keys-for-field($indexes:field, $indexes:callback, 
                               xs:int($indexes:max-number-returned))
                      return
                        (: In some versions of eXist (v5.3.0 – v6.2.0), range:index-keys-for-field() 
                           returns erroneous data for the collection:
                              - one row is returned per term *per document*
                                - as such, the "frequency" reported is per document
                                - as such, the "documents" reported is always 1 in every row
                                - as such, the "position" appears to be determined by the number of 
                                  terms in the document
                              - the maximum number of terms ($indexes:max-number-returned) is either not 
                                honored, or (most likely) it would only be honored on a 
                                document-by-document basis.
                          If the number of rows matches the number of distinct terms, we can (hopefully) 
                          assume that this version of eXist is doing the right thing with the range 
                          function.
                         :)
                        if ( count($rows) eq count(distinct-values($rows/td[1])) and 
                             count($rows) lt $indexes:max-number-returned ) then
                          $rows
                        (: If the range function appears to be outputting erroneous information for the 
                          collection, we clean it up a little for the Monex user:
                              - grouping up terms so only one <tr> is given per unique term,
                              - totalling up frequencies and documents,
                              - setting new positions, and
                              - returning terms within the maximum set by $indexes:max-number-returned.
                         :)
                        else
                          let $distinct-rows :=
                            for $row-grp in $rows
                            let $term := xs:string($row-grp/td[1])
                            group by $term
                            let $total-frequency := sum($row-grp/td[2]/xs:integer(.))
                            let $total-docs := sum($row-grp/td[3]/xs:integer(.))
                            (: Note that because sorting is done after $indexes:max-number-returned is 
                              applied, $sorted-keys will only ever be accurate to the first N terms 
                              returned. We could get around that for the range index fields by applying 
                              the requested sort method here, but instead we're being consistent with 
                              the behavior of other index reports. We sort by term here only to ensure 
                              that our calculated positions are accurate. :)
                            order by $term[1] ascending
                            return
                              (: Note we're skipping the position here; the document-by-document version 
                                is useless. :)
                              <tr>
                                <td>{ $term[1] }</td>
                                <td>{ $total-frequency }</td>
                                <td>{ $total-docs }</td>
                              </tr>
                          return
                            (: Now that all the rows have distinct terms, we can determine the correct 
                              position for each term across the collection, and honor the requested
                              $indexes:max-number-returned. :)
                            for $row at $pos in subsequence($distinct-rows, 1, $indexes:max-number-returned)
                            return
                              <tr>
                                { $row/td }
                                <td>{ $pos }</td>
                              </tr>
                    case "node" return
                        util:index-keys($indexes:node-set, $indexes:start-value, $indexes:callback, $indexes:max-number-returned, $index)
                    default return
                        util:index-keys-by-qname($indexes:qname, $indexes:start-value, $indexes:callback, $indexes:max-number-returned, $index)
(:    let $log := console:log(concat("INDEXES index type:    ", $indexes:index)):)
(:    let $log := console:log(concat("INDEXES qname     :    ", $indexes:qname)):)
    
    (:  Reminder for sorting:
           term = $key/td[1]
           frequency := xs:integer($key/td[2])
           documents := xs:integer($key/td[3])
           position := xs:integer($key/td[4])
    :)
    let $primary-sort-value :=
      switch ($indexes:sortby)
        case 'term'       return function($key) { $key/td[1] }
        case 'frequency'  return function($key) { xs:integer($key/td[2]) }
        case 'documents'  return function($key) { xs:integer($key/td[3]) }
        case 'position'   return function($key) { xs:integer($key/td[4]) }
        default return ''
    let $sorted-keys :=
        (: If the sort method is "term" or "position", we don't need a second sort method. :)
        if ($indexes:sortby = ('term', 'position')) then
            if ($indexes:sortorder eq 'ascending') then
                for $key in $keys order by $primary-sort-value($key) ascending return $key
            else
                for $key in $keys order by $primary-sort-value($key) descending return $key
        (: If the sort method is "frequency" or "documents", use "term" as a secondary sort method. :)
        else if ($indexes:sortby = ('frequency', 'documents')) then
            if ($indexes:sortorder eq 'ascending') then
                for $key in $keys order by $primary-sort-value($key) ascending, $key/td[1] ascending return $key
            else
                for $key in $keys order by $primary-sort-value($key) descending, $key/td[1] ascending return $key
        (: No specified sort method, no need to sort. :)
        else $keys
    
    let $query-end-time := util:system-time()
    let $query-duration := ($query-end-time - $query-start-time) div xs:dayTimeDuration('PT1S')

    return
    
        <div>
            <div class="indexes-meta-block">
                <p class="indexes-meta-primary">{count($keys)} keys in {format-number($query-duration, '0.000')}s</p>
                <p class="indexes-meta-context">
                    {indexes:index-badge($indexes:index)}
                    {' '}
                    on "{string-join(($indexes:field, $indexes:node-name, $indexes:match)[normalize-space(.) ne ''], ', ')}"
                    in
                    <a href="{concat('collection.html?collection=', $indexes:collection)}">{$indexes:collection}</a>
                    · browse by {$indexes:show-keys-by}
                </p>
            </div>
            <div class="indexes-toolbar">
            <form method="get" class="form-horizontal" action="{indexes:remove-parameter-names('start-value')}" role="form">
                <div class="form-group">
                    <label for="max" class="col-sm-2 control-label">Max number returned:</label>
                    <div class="col-sm-4">
                        <select id="max" name="max" class="form-control">{
                            for $number in (10, 100, 1000, 10000)
                            return
                                <option value="{$number}">{if ($number eq $indexes:max-number-returned) then attribute selected {'selected'} else ()}{$number}</option>
                        }</select>
                    </div>
                </div>                
                <div class="form-group">
                    <label class="col-sm-2 control-label" for="start-value">Find terms starting with:</label>
                    <div class="col-sm-4">
                        <span class="input-group">
                            <input id="start-value" name="start-value" type="text" class="form-control" value="{$indexes:start-value}"/>
                            {
                                if ($indexes:start-value ne '') then 
                                    <span class="input-group-btn">
                                        <a href="{indexes:remove-parameter-names('start-value')}" class="btn btn-default" title="Clear search">
                                            <span class="glyphicon glyphicon-remove-circle"/>
                                        </a> 
                                    </span>
                                else 
                                    ()
                            }
                            <span class="input-group-btn">
                                <button type="submit" class="btn btn-primary" title="Submit">
                                    <span class="glyphicon glyphicon-search"/></button>
                            </span>
                        </span>
                        {
                        for $param in request:get-parameter-names()[not(. = ('max', 'start-value'))]
                        return 
                            <input type="hidden" id="{$param}" name="{$param}" value="{request:get-parameter($param, '')}"/>
                        }
                    </div>
                </div>
            </form>
            </div>
            <div class="indexes-table-wrap">
            <table class="table table-bordered table-striped dataTable indexes-definitions">
                <tr>{
                    for $column in ('term', 'frequency', 'documents', 'position')
                    return
                        <th><a href="{indexes:set-sortorder($column)}">{$column} {indexes:sort-direction-indicator($column)}</a></th>
                }</tr>
                { $sorted-keys }
            </table>
            </div>
        </div>
};

(:
    Shows facets on a given nodeset or QName
:)
declare 
    %templates:wrap
function indexes:show-facet($node as node(), $model as map(*)) {
    let $query-start-time := util:system-time()
    let $facets-expression := 
        string-join((
            if ($indexes:node-name) then
                indexes:get-namespace-declaration-from-node-name($indexes:node-name, $indexes:collection) => distinct-values()
            else (: if ($indexes:match) then :)
                let $node-tests := tokenize($indexes:match, "/+")[. ne ""]
                let $ns-prefixes := ($node-tests ! substring-before(., ":")) => distinct-values()
                let $representatives := 
                    for $ns-prefix in $ns-prefixes
                    return
                        $node-tests[matches(., "^" || $ns-prefix || ":")][1]
                return
                    $representatives ! indexes:get-namespace-declaration-from-node-name(., $indexes:collection)
            ,
            'collection("', $indexes:collection, '")'
            , 
            if ($indexes:node-name) then 
                ('//' || $indexes:node-name) 
            else 
                $indexes:match
            , 
            '[ft:query(., '
            ,
            (
            if ($indexes:fields ne "") then
                ('"' || string-join((tokenize($indexes:fields, ",") ! (. || ':*')), " ") || '"')
            else
                '()'
            )
            ,
            ', map { "leading-wildcard": "yes", "filter-rewrite": "yes"'
            ,
            if ($indexes:fields ne "") then
                ', "fields": (' || string-join((tokenize($indexes:fields, ",") ! ('"' || . || '"')), ", ") || ')'
            else
                ()
            ,
            '}'
            ,
            ')]'
            ,
            ' => ft:facets("', $indexes:facet, '")'
        ))
    let $facets := util:eval($facets-expression)
    let $rows := 
        map:for-each(
            $facets, 
            function($key, $value) { 
                <tr>
                    <td>{$key}</td>
                    <td>{$value}</td>
                </tr>
            }
        )
    let $sorted-rows := 
        if ($indexes:sortby eq "label") then 
            if ($indexes:sortorder eq "ascending") then
                for $row in $rows
                order by $row/td[1]
                return $row
            else
                for $row in $rows
                order by $row/td[1] descending
                return $row
        else (: if ($indexes:sortby eq "count") then :)
            if ($indexes:sortorder eq "ascending") then
                for $row in $rows
                order by $row/td[2] cast as xs:integer
                return $row
            else
                for $row in $rows
                order by $row/td[2] cast as xs:integer descending
                return $row
    let $query-end-time := util:system-time()
    let $query-duration := ($query-end-time - $query-start-time) div xs:dayTimeDuration('PT1S')

    return
    
        <div>
            <div class="indexes-meta-block">
                <p class="indexes-meta-primary">1–{min((count($sorted-rows), $indexes:max-number-returned))} of {count($sorted-rows)} labels in {format-number($query-duration, '0.000')}s</p>
                <p class="indexes-meta-context">
                    {indexes:index-badge('lucene-index')}
                    {' '}
                    Facet "{$indexes:facet}"
                    {if ($indexes:hierarchical eq "yes") then ' (hierarchical)' else ()}
                    on "{($indexes:node-name, $indexes:match)[. ne ''][1]}"
                    in
                    <a href="{concat('collection.html?collection=', $indexes:collection)}">{$indexes:collection}</a>
                </p>
            </div>
            <div class="indexes-toolbar">
            <form method="get" class="form-horizontal" action="{indexes:remove-parameter-names('start-value')}" role="form">
                <div class="form-group">
                    <label for="max" class="col-sm-2 control-label">Max number returned:</label>
                    <div class="col-sm-4">
                        <select id="max" name="max" class="form-control">{
                            for $number in (10, 100, 1000, 10000)
                            return
                                <option value="{$number}">{if ($number eq $indexes:max-number-returned) then attribute selected {'selected'} else ()}{$number}</option>
                        }</select>
                    </div>
                    <span class="input-group-btn">
                        <button type="submit" class="btn btn-primary" title="Submit">
                            <span class="glyphicon glyphicon-search"/></button>
                    </span>
                    {
                        for $param in request:get-parameter-names()[not(. = ('max', 'start-value'))]
                        return 
                            <input type="hidden" id="{$param}" name="{$param}" value="{request:get-parameter($param, '')}"/>
                    }
                </div>
            </form>
            </div>
            <div class="indexes-table-wrap">
            <table class="table table-bordered table-striped dataTable indexes-definitions">
                <tr>{
                    for $column in ('label', 'count')
                    return
                        <th><a href="{indexes:set-sortorder($column)}">{$column} {indexes:sort-direction-indicator($column)}</a></th>
                }</tr>
                { $sorted-rows }
            </table>
            </div>
        </div>
};

(:
    Shows fields on a given nodeset or QName
:)
declare 
    %templates:wrap
function indexes:show-field($node as node(), $model as map(*)) {
    let $query-start-time := util:system-time()
    let $fields-expression := 
        string-join((
            if ($indexes:node-name) then
                indexes:get-namespace-declaration-from-node-name($indexes:node-name, $indexes:collection) => distinct-values()
            else (: if ($indexes:match) then :)
                let $node-tests := tokenize($indexes:match, "/+")[. ne ""]
                let $ns-prefixes := ($node-tests ! substring-before(., ":")) => distinct-values()
                let $representatives := 
                    for $ns-prefix in $ns-prefixes
                    return
                        $node-tests[matches(., "^" || $ns-prefix || ":")][1]
                return
                    $representatives ! indexes:get-namespace-declaration-from-node-name(., $indexes:collection)
            ,
            'collection("', $indexes:collection, '")'
            , 
            if ($indexes:node-name) then 
                ('//' || $indexes:node-name) 
            else 
                $indexes:match
            , 
            '[ft:query(., '
            ,
            ('"' || $indexes:field || ':*"')
            ,
            ', map { "leading-wildcard": "yes", "filter-rewrite": "yes", "fields": ("', $indexes:field, '") }'
            ,
            ')]'
            ,
            ' ! ft:field(., "', $indexes:field, '")'
        ))
    let $fields := util:eval($fields-expression)
    let $rows := 
        for $f in $fields
        group by $field := $f
        return
            <tr>
                <td>{$field}</td>
                <td>{count($f)}</td>
            </tr>
    let $sorted-rows := 
        if ($indexes:sortby eq "value") then 
            if ($indexes:sortorder eq "ascending") then
                for $row in $rows
                order by $row/td[1]
                return $row
            else
                for $row in $rows
                order by $row/td[1] descending
                return $row
        else (: if ($indexes:sortby eq "count") then :)
            if ($indexes:sortorder eq "ascending") then
                for $row in $rows
                order by $row/td[2] cast as xs:integer
                return $row
            else
                for $row in $rows
                order by $row/td[2] cast as xs:integer descending
                return $row
    let $query-end-time := util:system-time()
    let $query-duration := ($query-end-time - $query-start-time) div xs:dayTimeDuration('PT1S')

    return
    
        <div>
            <div class="indexes-meta-block">
                <p class="indexes-meta-primary">1–{min((count($sorted-rows), $indexes:max-number-returned))} of {count($sorted-rows)} values in {format-number($query-duration, '0.000')}s</p>
                <p class="indexes-meta-context">
                    {indexes:index-badge('lucene-index')}
                    {' '}
                    Field "{$indexes:field}"
                    on "{($indexes:node-name, $indexes:match)[. ne ''][1]}"
                    in
                    <a href="{concat('collection.html?collection=', $indexes:collection)}">{$indexes:collection}</a>
                </p>
            </div>
            <div class="indexes-toolbar">
            <form method="get" class="form-horizontal" action="{indexes:remove-parameter-names('start-value')}" role="form">
                <div class="form-group">
                    <label for="max" class="col-sm-2 control-label">Max number returned:</label>
                    <div class="col-sm-4">
                        <select id="max" name="max" class="form-control">{
                            for $number in (10, 100, 1000, 10000)
                            return
                                <option value="{$number}">{if ($number eq $indexes:max-number-returned) then attribute selected {'selected'} else ()}{$number}</option>
                        }</select>
                    </div>
                    <span class="input-group-btn">
                        <button type="submit" class="btn btn-primary" title="Submit">
                            <span class="glyphicon glyphicon-search"/></button>
                    </span>
                    {
                        for $param in request:get-parameter-names()[not(. = ('max', 'start-value'))]
                        return 
                            <input type="hidden" id="{$param}" name="{$param}" value="{request:get-parameter($param, '')}"/>
                    }
                </div>
            </form>
            </div>
            <div class="indexes-table-wrap">
            <table class="table table-bordered table-striped dataTable indexes-definitions">
                <tr>{
                    for $column in ('value', 'frequency')
                    return
                        <th><a href="{indexes:set-sortorder($column)}">{$column} {indexes:sort-direction-indicator($column)}</a></th>
                }</tr>
                { $sorted-rows => subsequence(1, $indexes:max-number-returned) }
            </table>
            </div>
        </div>
};

(:
    Helper function: Callback function called used in indexes:show-index-keys() for util:index-keys()
:)
declare function indexes:term-callback($term as xs:anyAtomicType, $data as xs:unsignedInt+) as element(tr) {
    <tr>
        <td>{$term}</td>
        <td>{$data[1]}</td>
        <td>{$data[2]}</td>
        <td>{$data[3]}</td>
    </tr>
};

(:
    Analyzes the Lucene indexes in an index definition
:)
declare function indexes:analyze-lucene-indexes($xconf) {
    let $lucene := $xconf/cc:index/cc:lucene 
    return if (not($lucene) or not($lucene/cc:text)) then () else 
        (
        let $texts := $lucene//cc:text
        return
            (
            for $text in $texts
            let $qname := if ($text/@qname) then $text/@qname/string() else ()
            let $match := if ($text/@match) then $text/@match/string() else ()
            let $analyzer := if ($text/@analyzer) then $text/@analyzer/string() else ()
            let $collection := substring-after(util:collection-name($text), '/db/system/config')
            let $no-index := $text/@index eq "no"
            let $facets-fields := $text/(cc:facet | cc:field | cc:vector-field)
            return
            (
                <tr>
                    <td>
                        {if (exists($facets-fields)) then attribute rowspan { count($facets-fields) + 1 } else () }
                        {if ($qname) then $qname else $match}
                        {if ($no-index) then " (not indexed)" else ()}
                        {if ($text/@boost) then concat(' (boost: ', $text/@boost/string(), ')') else ()}
                        {if ($text/cc:ignore) then (<br/>, concat('(ignore: ', string-join(for $ignore in $text/cc:ignore return $ignore/@qname/string(), ', '), ')')) else ()}</td>
                    <td>{indexes:index-badge('lucene-index')}</td>
                    {indexes:type-detail-cell(
                        concat(
                            if ($qname) then 'QName' else 'Match',
                            if ($analyzer) then concat(' · ', $analyzer, ' analyzer') else ' · default analyzer'
                        )
                    )}
                    <td class="indexes-drill-links">{indexes:lucene-index-keys-links($collection, $qname, $match)}</td>
                </tr>,
                for $f in $facets-fields
                return
                    <tr class="{if ($f instance of element(cc:vector-field)) then 'indexes-vector-row' else ()}">
                        <td>{if ($f instance of element(cc:vector-field)) then
                            $f/@name/string()
                        else
                            string(($f/(@dimension | @name)/string(), $f/name())[1])
                        }</td>
                        <td>{
                            if ($f instance of element(cc:facet)) then
                                indexes:index-badge('lucene-index')
                            else if ($f instance of element(cc:vector-field)) then
                                indexes:vector-badge()
                            else if ($f/@store eq "no") then
                                <span class="indexes-item-muted">not stored</span>
                            else
                                indexes:index-badge('lucene-index')
                        }</td>
                        {indexes:type-detail-cell(
                            if ($f instance of element(cc:vector-field)) then
                                indexes:vector-field-label($f)
                            else
                                string-join(
                                    (
                                        string($f/name()),
                                        if ($f/@hierarchical eq "yes") then 'hierarchical' else (),
                                        if ($f/@store eq "no") then 'not stored' else (),
                                        if ($f/@analyzer) then concat($f/@analyzer/string(), ' analyzer') else ()
                                    )[normalize-space(.) ne ''],
                                    ' · '
                                )
                        )}
                        <td class="indexes-drill-links">{
                            if ($f instance of element(cc:facet)) then
                                indexes:browse-link(
                                    concat('facet.html', indexes:replace-parameters((
                                        if ($qname) then concat('node-name=', $qname) else concat('match=', $match)
                                        , 
                                        concat('collection=', $collection)
                                        ,
                                        concat('facet=', $f/@dimension)
                                        ,
                                        if ($f/@hierarchical) then concat('hierarchical=', $f/@hierarchical) else ()
                                    ))),
                                    'Browse facet'
                                )
                            else if ($f instance of element(cc:vector-field)) then
                                <span class="indexes-item-muted">Key browse not available for vector fields</span>
                            else if ($f/@store eq "no") then
                                <span class="indexes-item-muted">—</span>
                            else
                                indexes:browse-link(
                                    concat('field.html', indexes:replace-parameters((
                                        if ($qname) then concat('node-name=', $qname) else concat('match=', $match)
                                        , 
                                        concat('collection=', $collection)
                                        ,
                                        concat('field=', $f/@name)
                                    ))),
                                    'Browse field'
                                )
                        }</td>
                    </tr>
                )
            )
        )
};

(:
    Analyzes the legacy fulltext indexes in an index definition
:)
declare function indexes:analyze-legacy-fulltext-indexes($xconf) {
    let $collection := substring-after(util:collection-name($xconf), '/db/system/config')
    let $index := 'legacy-fulltext-index'
    let $index-label := indexes:index-name-to-label($index)
    let $fulltext := $xconf/cc:index/cc:fulltext
    let $creates := $fulltext/cc:create
    let $default-none := $fulltext/@default eq 'none'
    let $attributes-none := $fulltext/@attributes eq 'false'
    
    let $no-fulltext := if ( not($fulltext) or ($default-none and $attributes-none and not($creates)) ) then '(disabled)' else ()
    return 
        if ($no-fulltext) then
            ()
        else if (not($default-none) and not($attributes-none)) then
            <tr>
                <td>All Elements and Attributes!</td>
                <td>{indexes:index-badge($index)}</td>
                {indexes:type-detail-cell('')}
                <td><span class="indexes-item-muted">Too many to display</span></td>
            </tr>
        else
            (
            for $create in $creates
            let $qname := $create/@qname/string()
            let $mixed := $create/@mixed/string()
            return
                <tr>
                    <td>{$qname}</td>
                    <td>{indexes:index-badge($index)}</td>
                    {indexes:type-detail-cell(if ($mixed) then 'mixed content' else '')}
                    <td class="indexes-drill-links">{
                        indexes:index-keys-link(
                            $collection,
                            $index,
                            'node',
                            concat('node-name=', $qname)
                        )
                    }</td>
                </tr>
            ,
            let $only-elements-disabled := if ($fulltext/@default eq 'none' and $fulltext/@attributes ne 'no') then '(elements disabled)' else ()
            let $only-attribs-disabled := if ($fulltext/@default ne 'none' and $fulltext/@attributes eq 'no') then '(attributes disabled)' else ()
            return
            if ($only-elements-disabled) then
                <tr>
                    <td>All Attributes! {$only-elements-disabled}</td>
                    <td>{indexes:index-badge($index)}</td>
                    {indexes:type-detail-cell('attributes only')}
                    <td><span class="indexes-item-muted">Too many to display</span></td>
                </tr>
            else if ($only-attribs-disabled) then 
                <tr>
                    <td>All Elements! {$only-attribs-disabled}</td>
                    <td>{indexes:index-badge($index)}</td>
                    {indexes:type-detail-cell('elements only')}
                    <td><span class="indexes-item-muted">Too many to display</span></td>
                </tr>
            else ()
            )
};

(:
    Analyzes the range indexes in an index definition
:)
declare function indexes:analyze-range-indexes($xconf) {
    let $index-label := indexes:index-name-to-label('range-index')
    let $ranges := $xconf/cc:index/cc:create 
    return 
        if (not($ranges) or empty($indexes:range-lookup)) then 
            () 
        else 
            for $range in $ranges
            let $qname := $range/@qname/string()
            let $match := $range/@path/string()
            let $type := $range/@type/string()
            let $collection := substring-after(util:collection-name($range), '/db/system/config')
(:            let $nodeset := if ($qname) then indexes:get-nodeset-from-qname($collection, $qname) else indexes:get-nodeset-from-match($collection, $match):)
            return
                <tr>
                    <td>{if ($qname) then $qname else $match}</td>
                    <td>{indexes:index-badge('range-index')}</td>
                    {indexes:type-detail-cell(
                        concat(
                            if ($qname) then 'QName' else 'Path',
                            ' · ',
                            $type
                        )
                    )}
                    <td class="indexes-drill-links">{
                        indexes:index-keys-link(
                            $collection,
                            'range-index',
                            'node',
                            if ($qname) then concat('node-name=', $qname) else concat('match=', $match)
                        )
                    }</td>
                </tr>
};

(:
    Analyzes the new range indexes in an index definition
:)
declare function indexes:analyze-new-range-indexes($xconf) {
    let $index-label := indexes:index-name-to-label('new-range-index')
    let $ranges := $xconf/cc:index/cc:range/cc:create[not(cc:field)]
    return if (not($ranges)) then () else 
        for $range in $ranges
        let $qname := $range/@qname/string()
        let $type := $range/@type/string()
        let $collection := substring-after(util:collection-name($range), '/db/system/config')
(:        let $nodeset := indexes:get-nodeset-from-qname($collection, $qname):)
        return
            <tr>
                <td>{$qname}</td>
                <td>{indexes:index-badge('new-range-index')}</td>
                {indexes:type-detail-cell(concat('QName · ', $type))}
                <td class="indexes-drill-links">{
                    indexes:index-keys-link(
                        $collection,
                        'new-range-index',
                        'node',
                        concat('node-name=', $qname)
                    )
                }</td>
            </tr>
};

(:
    Analyzes the new range indexes in an index definition
:)
declare function indexes:analyze-new-range-index-fields($xconf) {
    let $index-label := indexes:index-name-to-label('new-range-index')
    let $ranges := $xconf/cc:index/cc:range/cc:create/cc:field
    return if (not($ranges)) then () else 
        for $range in $ranges
        let $name := $range/@name/string()
        let $match := $range/@match/string()
        let $type := $range/@type/string()
        let $collection := substring-after(util:collection-name($range), '/db/system/config')
(:        let $nodeset := indexes:get-nodeset-from-field($collection, $range/parent::cc:create/@qname, $match):)
        return
            <tr>
                <td>{$name}</td>
                <td>{indexes:index-badge('new-range-index')}</td>
                {indexes:type-detail-cell(concat('field · ', $type))}
                <td class="indexes-drill-links">{
                    indexes:index-keys-link(
                        $collection,
                        'new-range-index',
                        'field',
                        concat('field=', $name)
                    )
                }</td>
            </tr>
};

(:
    Analyzes the NGram indexes in an index definition
:)
declare function indexes:analyze-ngram-indexes($xconf) {
    let $index-label := indexes:index-name-to-label('ngram-index')
    let $ngrams := $xconf/cc:index/cc:ngram
    return if (not($ngrams)) then () else
        for $ngram in $ngrams
        let $qname := $ngram/@qname/string()
        let $collection := substring-after(util:collection-name($ngram), '/db/system/config')
(:        let $nodeset := indexes:get-nodeset-from-qname($collection, $qname):)
        return
            <tr>
                <td>{$qname}</td>
                <td>{indexes:index-badge('ngram-index')}</td>
                {indexes:type-detail-cell('QName')}
                <td class="indexes-drill-links">{
                    indexes:index-keys-link(
                        $collection,
                        'ngram-index',
                        'qname',
                        concat('node-name=', $qname)
                    ),
                    ', ',
                    indexes:index-keys-link(
                        $collection,
                        'ngram-index',
                        'node',
                        concat('node-name=', $qname)
                    )
                }</td>
            </tr>    
};

(:
    Helper function: Returns a nodeset of instances of a node-name in a collection
:)
declare function indexes:get-nodeset-from-qname($collection as xs:string, $node-name as xs:string) as node()* {
    let $nodeset-expression := 
        concat(
            indexes:get-namespace-declaration-from-node-name($node-name, $collection)
            ,
            'collection("', $collection, '")//', $node-name
        )
(:    let $log := console:log(concat("INDEXES get-nodeset:          ", $nodeset-expression)):)
    return
        util:eval($nodeset-expression)
};

(:
    Helper function: Returns a nodeset of instances of a match expression in a collection
:)
declare function indexes:get-nodeset-from-match($collection as xs:string, $match as xs:string) as node()* {
    let $nodeset-expression := 
        concat(
            string-join(
                distinct-values(
                let $node-names := tokenize(replace($match, '//', '/'), '/')
                return
                    for $node-name in $node-names
                    return
                        indexes:get-namespace-declaration-from-node-name($node-name, $collection)
                ), ' ')
            ,
            'collection("', $collection, '")', $match, if (contains($match, '@')) then () else ()
        )
    return
        util:eval($nodeset-expression) 
};

(:
    Helper function: Returns a nodeset of instances of a node-name in a collection
:)
declare function indexes:get-nodeset-from-field($collection as xs:string, $parentQName as xs:string, $match as xs:string?) as node()* {
    let $nodeset-expression := 
        indexes:get-namespace-declaration-from-node-name($parentQName, $collection) ||
        'collection("' || $collection || '")//' || $parentQName
    let $nodeset-expression :=
            if ($match) then $nodeset-expression || "/" || $match else $nodeset-expression
(:    let $log := console:log(concat("INDEXES get-nodeset:          ", $nodeset-expression)):)
    return
        util:eval($nodeset-expression)
};

(:
    Helper function: Returns the index definition for a given collection
:)
declare function indexes:get-xconf($collection as xs:string) as document-node() {
    let $config-root := '/db/system/config'
    let $xconf-collection := concat($config-root, $collection)
    let $xconf-filename := xmldb:get-child-resources($xconf-collection)[ends-with(., '.xconf')]
    let $xconf := doc(concat($xconf-collection, '/', $xconf-filename))
    return $xconf
};

(:
    Helper function: Looks in the collection.xconf's collection and index elements for namespace URIs for a given node name
:)
declare function indexes:get-namespace-uri-from-node-name($node-name, $collection) {

    let $name := if (starts-with($node-name,'@')) then
                    substring-after( substring-before($node-name, ':'), '@' )
                else
                    substring-before($node-name, ':')
    
    let $xconf := indexes:get-xconf($collection)
    let $uri := (namespace-uri-for-prefix($name, $xconf/cc:collection), namespace-uri-for-prefix($name, $xconf//cc:index))[1]
    return
        $uri
};

(:
    Helper function: Constructs a namespace declaration for use in util:eval()
:)
declare function indexes:get-namespace-declaration-from-node-name($node-name as xs:string, $collection as xs:string) as xs:string? {
    if (not(matches($node-name, 'xml:')) and contains($node-name, ':')) then
    
        let $name := if (starts-with($node-name,'@')) then
                        substring-after( substring-before($node-name, ':'), '@' )
                    else
                        substring-before($node-name, ':')
        
        let $uri := indexes:get-namespace-uri-from-node-name($node-name, $collection)
        return
            concat('declare namespace ', $name, '="', $uri, '"; ') 
    else ()
};

(:
    Helper function: gets the label for a given index-name
:)
declare function indexes:index-name-to-label($index-name as xs:string) as xs:string {
    $indexes:index-names//item[value eq $index-name]/label/text() 
};

(:
    ====
    Helper functions for modifying the sort order used in indexes:show-index-keys() 
    ====
:)
declare function indexes:toggle-sortorder($current-sortorder) {
    indexes:toggle-sortorder($current-sortorder, ('ascending'))
};

declare function indexes:toggle-sortorder($current-sortorder, $other-new-parameters) {
    let $neworder := 
        if ($current-sortorder eq 'ascending') then
            'sortorder=descending'
        else 
            'sortorder=ascending'
    let $new-parameters := ($neworder, $other-new-parameters)
    return
        indexes:replace-parameters($new-parameters)
};

declare function indexes:set-sortorder($current-sortorder, $current-sortby, $new-sortby) {
    if ($current-sortby eq $new-sortby) then 
        indexes:toggle-sortorder($current-sortorder)
    else 
        indexes:strip-param-from-param-string(indexes:replace-parameters(concat('sortby=', $new-sortby)), 'sortorder')
};

declare function indexes:set-sortorder($new-sortby) {
    indexes:set-sortorder($indexes:sortorder, $indexes:sortby, $new-sortby)
};

declare function indexes:sort-direction-indicator($sortby as xs:string) {
    if ($sortby eq $indexes:sortby) then
        if ($indexes:sortorder eq 'ascending') then
            ' ↓'
        else
            ' ↑'
    else ()
};


(: 
    ====
    Helper functions for handling parameters 
    ====
:)
declare function indexes:remove-parameter-names($parameter-names-to-remove) {
    let $current-parameter-names := request:get-parameter-names()
    let $remaining-parameters :=
        indexes:remove-parameter-names(
            for $current-parameter-name in $current-parameter-names 
            return 
                concat($current-parameter-name, '=', request:get-parameter( $current-parameter-name, () )[1])
            ,
            $parameter-names-to-remove
            )
    return 
        if (exists($remaining-parameters)) then 
            concat('?', string-join($remaining-parameters, '&amp;'))
        else 
            '?'
};

declare function indexes:remove-parameter-names($current-parameters, $parameter-names-to-remove) {
    for $current-parameter in $current-parameters 
    return 
        if (substring-before($current-parameter, '=') = $parameter-names-to-remove) then
            ()
        else 
            $current-parameter
};

declare function indexes:remove-parameter-names-except($parameter-names-to-keep) {
    let $current-parameter-names := request:get-parameter-names()
    return
        indexes:remove-parameter-names($current-parameter-names[not(. = $parameter-names-to-keep)])
};

declare function indexes:replace-parameters($new-parameters) {
    let $current-parameter-names := request:get-parameter-names()
    let $current-parameters := 
        for $name in $current-parameter-names
        return concat($name, '=', request:get-parameter($name, ())[1])
    return
        indexes:replace-parameters($current-parameters, $new-parameters)
};

declare function indexes:replace-parameters($current-parameters, $new-parameters) {
    let $new-parameter-names := for $new-parameter in $new-parameters return substring-before($new-parameter, '=')
    let $remaining-parameters := indexes:remove-parameter-names($current-parameters, $new-parameter-names)
    let $result-parameters := for $param in ($remaining-parameters, $new-parameters) order by $param return $param
    return
        concat('?', string-join($result-parameters, '&amp;'))
};

declare function indexes:strip-param-from-param-string($param-string, $param) {
    replace($param-string, concat('&amp;?', $param, '=[^&amp;]*?&amp;?.*$'), '')
};
