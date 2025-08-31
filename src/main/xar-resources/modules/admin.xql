(:
 : SPDX LGPL-2.1-or-later
 : Copyright (C) 2017 The eXist-db Authors
 :)
xquery version "3.1";

let $action := request:get-parameter("action", ())
return
    switch ($action)
        case "kill" return
            let $id := request:get-parameter("id", ())
            return
                if ($id) then
                    system:kill-running-xquery($id)
                else
                    ()
        default return
            ()