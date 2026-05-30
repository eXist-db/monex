/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
// util.js must be loaded first, otherwise JMX is undefined
var Monex = window.Monex || {};
window.Monex = Monex;

function jmxValue(value) {
    if (value && typeof ko !== "undefined" && ko.isObservable(value)) {
        return value();
    }
    return value;
}
