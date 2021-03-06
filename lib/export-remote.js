'use strict';

var scriptjs = require('scriptjs');
var bromote = require('../loaders');
var jsonpject = require('jsonpject');
var loaded = {};
var loading = {};

function attachDep(windowKey, requireKey, cb) {
  try {
    window[windowKey] = require(requireKey);
    setTimeout(cb, 0);
  } catch (reqerr) {
    // not in the bundle, lets hope it's a remote
    if (typeof bromote[requireKey] !== 'function')
      return cb(new Error(requireKey + ' was neither included in the bundle, nor as a remote script!'));

    bromote[requireKey](function (dep) {
      window[windowKey] = dep;
      cb();
    });
  }
}

function attachDepsToWindow(deps, cb) {
  if (!deps) return setTimeout(cb, 0);

  var keys = Object.keys(deps)
    , tasks = keys.length
    , error;

  if (!tasks) return setTimeout(cb, 0);

  keys.forEach(function (k) {
    attachDep(deps[k], k, function (err) {
      if (error) return;
      if (err) return cb(error = err);
      if (!--tasks) cb();
    });
  });
}

function loadScript (asset, cb) {
  scriptjs(asset.url, function () {
    loaded[asset.url] = window[asset.exports];
    loading[asset.url] = false;
    if (typeof asset.init === 'function') asset.init();
    cb(loaded[asset.url]);
  });
}

module.exports = function load(asset, cb) {

  var jsonp = jsonpject(asset.url, cb);
  if(typeof jsonp.fnName !== 'undefined'){
    window[jsonp.fnName] = jsonp.fn;
    asset.url = jsonp.url;
    cb = function(){};
  }

  if (loaded[asset.url])
    return setTimeout(cb.bind(null, loaded[asset.url]), 0);

  // if we are currently loading an asset, try again in a bit to call back with the loaded asset
  if (loading[asset.url])
    return setTimeout(load.bind(null, asset, cb), 10);

  loading[asset.url] = true;
  attachDepsToWindow(asset.deps, function (err) {
    if (err) return (console.error(err.message), console.error(err.stack));

    loadScript(asset, cb);
  });
};
