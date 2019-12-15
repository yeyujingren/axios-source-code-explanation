'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  // interceptors： 拦截器
  this.interceptors = {
    // 创建InterceptorManager实例，返回一个header空数组，并继承了prototype
    // 上的use、eject、forEach方法
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
// 核心方法：使用到了Promise的链式调用，也是用到了中间件的思想
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    /**
     * 这里这种判断是为了兼容两种书写方式：
     * （1）axios.get('/api', {
     *  contentType: 'application/json'
     * })
     * 
     * （2）axios({
     *  method: "get",
     *  url: "/api",
     *  contentType: "application/json"
     * })
     * 
     */
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  // 合并配置
  config = mergeConfig(this.defaults, config);
  // 请求方式，默认为get
  config.method = config.method ? config.method.toLowerCase() : 'get';

  // Hook up interceptors middleware
  // 重点：拦截器的中间件
  // 初始的chain数组dispatchRequest是发送请求的方法
  var chain = [dispatchRequest, undefined];
  // 生成一个promise对象
  // 其实可以这样认为此时的config已经是一个包涵ajax请求所需参数的一个obj。
  var promise = Promise.resolve(config);

  // 然后 遍历 interceptors 
  // 注意 这里的 forEach 不是 Array.forEach， 也不是上面讲到的 util.forEach. 具体 拦截器源码 会讲到
  // 现在我们只要理解他是遍历给 chain 里面追加两个方法就可以

  // 将请求前方法置入chain数组的前面 一次置入两个：成功的和失败
  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  // 将请求后方法置入chain数组的前面 一次置入两个：成功的和失败
  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  // 之後，chain变成为
  // chain = [ 请求拦截器的成功方法，请求拦截器的失败方法，dispatchRequest， undefined, 响应拦截器的成功方法，响应拦截器的失败方法 ]。

  // 通过shift方法，把第一个元素从其中删除，并返回第一个参数
  while (chain.length) {
    // 意思就是将 chainn 内的方法两两拿出来执行 成如下这样
    // promise.then(请求拦截器的成功方法, 请求拦截器的失败方法)
    //        .then(dispatchRequest, undefined)
    //        .then(响应拦截器的成功方法, 响应拦截器的失败方法)
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};


// 合并配置：将用户的配置和默认配置合并
Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods

// 给Axios.prototype方法上增加delete、get、head、options方法，这样我们就可以使用axios.get(),axios.post()等方法
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    // 调用this.request方法
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;