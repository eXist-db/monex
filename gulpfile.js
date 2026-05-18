/*
 * SPDX LGPL-2.1-or-later
 * Copyright (C) 2014 The eXist-db Authors
 */
import { src, dest, series, parallel, watch as gulpWatch } from "gulp";
import { createClient, readOptionsFromEnv } from "@existdb/gulp-exist";
import replace from "@existdb/gulp-replace-tmpl";
import rename from "gulp-rename";
import zip from "gulp-zip";
import del from "delete";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("./package.json", "utf-8"));
const { version, license, app } = packageJson;

// template replacements: first value wins
const replacements = [app, { version, license }];

const defaultOptions = { basic_auth: { user: "admin", pass: "" } };
const connectionOptions = Object.assign(defaultOptions, readOptionsFromEnv());

let existClient;
try {
  existClient = createClient(connectionOptions);
} catch (e) {
  // client creation may fail if server is not available; OK for build-only usage
}

const targetCollection = `/db/apps/${app.target}`;
const packageFilename = `monex-${version}.xar`;

const paths = {
  input: "src/main/xar-resources",
  staging: ".build",
  output: "dist",
  vendor: {
    scripts: [
      "src/main/xar-resources/resources/vendor/scripts/*",
      "node_modules/ion-rangeslider/js/ion.rangeSlider.min.js",
      "node_modules/bootstrap/dist/js/bootstrap.min.*",
      "node_modules/jquery/dist/jquery.min.*",
      "node_modules/prismjs/prism.js",
      "node_modules/prismjs/components/prism-xquery.min.js",
      "node_modules/knockout/build/output/knockout-latest.js",
      "node_modules/bootstrap-daterangepicker/daterangepicker.js",
      "node_modules/bootstrap-daterangepicker/moment.min.js",
      "node_modules/datatables.net/js/jquery.dataTables.min.js",
      "node_modules/datatables.net-bs/js/dataTables.bootstrap.min.js",
      "node_modules/datatables.net-responsive/js/dataTables.responsive.min.js",
      "node_modules/datatables.net-responsive-bs/js/responsive.bootstrap.min.js",
      "node_modules/admin-lte/dist/js/adminlte.min.js",
      // unminified source
      "node_modules/knockout.mapping/knockout.mapping.js",
      "node_modules/fastclick/lib/fastclick.js",
    ],
    styles: [
      "node_modules/ionicons/dist/css/ionicons.min.css",
      "node_modules/ionicons/dist/css/ionicons.min.css.map",
      "node_modules/ion-rangeslider/css/ion.rangeSlider.min.css",
      "node_modules/bootstrap/dist/css/bootstrap.min.*",
      "node_modules/prismjs/themes/prism.css",
      "node_modules/font-awesome/css/font-awesome.min.css",
      "node_modules/bootstrap-daterangepicker/daterangepicker.css",
      "node_modules/datatables.net-bs/css/dataTables.bootstrap.min.css",
      "node_modules/datatables.net-responsive-bs/css/responsive.bootstrap.min.css",
      "node_modules/admin-lte/dist/css/AdminLTE.min.css",
      "node_modules/admin-lte/dist/css/skins/skin-black.min.css",
    ],
    fonts: [
      "node_modules/bootstrap/dist/fonts/*",
      "node_modules/font-awesome/fonts/*",
      "node_modules/ionicons/dist/fonts/*",
    ],
  },
};

// ==================== //
//    Clean tasks        //
// ==================== //

function clean(cb) {
  del([paths.staging, paths.output], cb);
}
export { clean };

// ==================== //
//    Copy xar-resources //
// ==================== //

function copyXarResources() {
  return src(`${paths.input}/**/*`, { encoding: false })
    .pipe(dest(paths.staging));
}

function copyProjectFiles() {
  return src(["README.md", "LICENSE"], { allowEmpty: true, encoding: false })
    .pipe(dest(paths.staging));
}

// ==================== //
//    Template tasks     //
// ==================== //

function templates() {
  return src("*.tmpl")
    .pipe(replace(replacements, { unprefixed: true }))
    .pipe(rename((path) => { path.extname = ""; }))
    .pipe(dest(paths.staging));
}

// ==================== //
//    Frontend assets    //
// ==================== //

function styles() {
  return src("src/main/xar-resources/resources/css/*")
    .pipe(dest(`${paths.staging}/resources/css`));
}

function scripts() {
  return src("src/main/xar-resources/resources/scripts/*")
    .pipe(dest(`${paths.staging}/resources/scripts`));
}

function copyVendorScripts() {
  return src(paths.vendor.scripts)
    .pipe(dest(`${paths.staging}/resources/scripts`));
}

function copyVendorStyles() {
  return src(paths.vendor.styles)
    .pipe(dest(`${paths.staging}/resources/css`));
}

function copyVendorFonts() {
  return src(paths.vendor.fonts, { encoding: false })
    .pipe(dest(`${paths.staging}/resources/fonts`));
}

const copyStatic = parallel(
  copyVendorFonts,
  copyVendorScripts,
  copyVendorStyles
);

// ==================== //
//    XAR packaging      //
// ==================== //

function createXar() {
  return src(`${paths.staging}/**/*`, { encoding: false })
    .pipe(zip(packageFilename))
    .pipe(dest(paths.output));
}

// ==================== //
//    Deploy to eXist    //
// ==================== //

function deployXar() {
  return src(`${paths.output}/${packageFilename}`, { encoding: false })
    .pipe(existClient.install({ packageUri: app.namespace }));
}

// ==================== //
//    Composed tasks     //
// ==================== //

const build = series(
  clean,
  parallel(copyXarResources, copyProjectFiles),
  parallel(styles, scripts, copyStatic),
  templates,
  createXar
);

const install = series(build, deployXar);

export { build, install };

// default: build + deploy + watch
export default series(build, deployXar, function watchTask() {
  gulpWatch(`${paths.input}/**/*`, build);
});
