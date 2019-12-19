'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');
var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
var combineURLs = require('./../helpers/combineURLs');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
 // 请求取消时：
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 * 发请求
 * 
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Support baseURL config
  // 请求没有取消 执行下面的请求。
  // 拼接url，判断在设置baseURL的情况下，传入的url如果不是绝对的，就进行拼接
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Ensure headers exist
  // 确定请求头确实存在
  config.headers = config.headers || {};

  // Transform request data
  // 转换数据
  config.data = transformData(
    config.data,
    config.headers,
    // func 用来根据不同类型来转换data，并设置相应的headers
    config.transformRequest
  );


  // Flatten headers
  // 合并配置
  config.headers = utils.merge(
    // common:{'Accept': 'application/json, text/plain, */*'}
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  // 还原header.['get']等上面的属性，来保证下次使用的时候任然是初始值
  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );


  // 获取请求方式，主要是为了区分nodejs环境和浏览器环境
  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    // 封装response
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    // 失败处理
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};
