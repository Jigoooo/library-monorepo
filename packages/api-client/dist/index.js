import axios from 'axios';
import qs from 'qs';

// src/init-api.ts

// src/config.ts
var _config = null;
var _axiosInstance = null;
function setApiConfig(config) {
  _config = config;
}
function getApiConfig() {
  if (!_config) {
    throw new Error(
      '@jigoooo/api-client: initApi()\uB97C \uBA3C\uC800 \uD638\uCD9C\uD558\uC138\uC694.',
    );
  }
  return _config;
}
function setAxiosInstance(instance) {
  _axiosInstance = instance;
}
function getAxiosInstance() {
  if (!_axiosInstance) {
    throw new Error(
      '@jigoooo/api-client: initApi()\uB97C \uBA3C\uC800 \uD638\uCD9C\uD558\uC138\uC694.',
    );
  }
  return _axiosInstance;
}

// src/utils/log.ts
var logOnDev = (...args) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

// src/interceptors.ts
var isRefreshing = false;
var failedQueue = [];
var processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};
var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var injectToken = async (headers) => {
  try {
    const { refreshTokenFn, retryConfig } = getApiConfig();
    if (!retryConfig?.isTokenExpired?.()) return;
    try {
      const newToken = await refreshTokenFn?.();
      if (newToken && headers) {
        headers.Authorization = `Bearer ${newToken}`;
      }
    } catch {
      const { onUnauthorized } = getApiConfig();
      onUnauthorized?.();
    }
  } catch {}
};
var applyToken = (headers) => {
  try {
    const { getToken } = getApiConfig();
    const token = getToken?.();
    if (token && headers) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
};
var onRequest = async (config) => {
  const { method, url, headers, params, baseURL } = config;
  logOnDev(`onRequest [API] ${method?.toUpperCase()} ${url} | Request`);
  if (!headers) {
    throw new Error('axios header is undefined');
  }
  if (params) {
    config.params = params;
  }
  await injectToken(headers);
  applyToken(headers);
  let fullUrl = `${baseURL || ''}${url}`;
  if (method?.toUpperCase() === 'GET' && config.params) {
    const queryString = qs.stringify(config.params, { arrayFormat: 'brackets' });
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }
  logOnDev(`onRequest [API] ${method?.toUpperCase()} ${fullUrl} | Request`);
  try {
    const { onRequest: userHook } = getApiConfig();
    if (userHook) {
      return await userHook({ ...config });
    }
  } catch {}
  return { ...config };
};
var logRequestError = (error) => {
  if (error.config) {
    logOnDev(`onErrorRequest: \uC694\uCCAD \uC2E4\uD328: ${error}`);
  } else if (error.request) {
    logOnDev(`onErrorRequest: \uC751\uB2F5 \uC5C6\uC74C ${error}`);
  } else {
    logOnDev(`onErrorRequest: ${error}`);
  }
};
var onErrorRequest = async (error) => {
  logRequestError(error);
  try {
    const { onErrorRequest: userHook } = getApiConfig();
    if (userHook) {
      await userHook(error);
    }
  } catch {}
  throw error;
};
var onResponse = (response) => {
  const { method, url } = response.config;
  const { status } = response;
  logOnDev(`onResponse [API] ${method?.toUpperCase()} ${url} | Request ${status}`);
  return response;
};
var truncateBase64 = (obj, maxLength = 100) => {
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') || (obj.length > 200 && /^[A-Za-z0-9+/=]+$/.test(obj))) {
      return `[BASE64_IMAGE: ${obj.length} chars]`;
    }
    if (obj.length > maxLength) {
      return obj.slice(0, maxLength) + '...';
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => truncateBase64(item, maxLength));
  }
  if (obj && typeof obj === 'object') {
    const truncated = {};
    for (const [key, value] of Object.entries(obj)) {
      truncated[key] = truncateBase64(value, maxLength);
    }
    return truncated;
  }
  return obj;
};
var getConfigData = (data) => {
  if (!data) return void 0;
  if (typeof data === 'string') {
    return truncateBase64(data, 200);
  }
  return truncateBase64(data);
};
var getResponseData = (data) => {
  if (!data) return void 0;
  return truncateBase64(JSON.stringify(data), 500);
};
var logAxiosErrorShort = (error) => {
  const safeError = {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    url: error.config?.url,
    method: error.config?.method?.toUpperCase(),
    params: error.config?.params,
    data: getConfigData(error.config?.data),
    responseData: getResponseData(error.response?.data),
  };
  console.log('AxiosError (short):', safeError);
};
var logResponseData = (data, configData) => {
  if (data) {
    logOnDev('onErrorResponse [API] data: ', JSON.stringify(data, null, 2));
  }
  if (configData) {
    try {
      if (typeof configData === 'string') {
        logOnDev('onErrorResponse [API] config.data: ', truncateBase64(JSON.parse(configData)));
      } else {
        logOnDev('onErrorResponse [API] config.data: ', truncateBase64(configData));
      }
    } catch {
      logOnDev('onErrorResponse [API] config.data (raw): ', truncateBase64(configData));
    }
  }
};
var attemptTokenRefresh = async (maxRetries, retryDelay, refreshTokenFn, onUnauthorized) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      if (retryDelay > 0) await delay(retryDelay);
      if (!refreshTokenFn) throw new Error('No refreshTokenFn');
      return await refreshTokenFn();
    } catch {
      attempt++;
      if (attempt >= maxRetries) {
        onUnauthorized?.();
        throw new Error('Token refresh failed');
      }
    }
  }
  throw new Error('Token refresh failed');
};
var handleTokenRefresh = async (error) => {
  try {
    const { refreshTokenFn, onUnauthorized, retryConfig } = getApiConfig();
    const {
      maxRetries = 1,
      retryDelay = 0,
      maxQueueSize = 50,
      shouldRetry = (e) => e.response?.status === 401,
    } = retryConfig ?? {};
    if (!shouldRetry(error) || !error.config) return;
    if (failedQueue.length >= maxQueueSize) {
      throw error;
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token) => {
            if (error.config) {
              error.config.headers.Authorization = `Bearer ${token}`;
              resolve(axios(error.config));
            }
          },
          reject,
        });
      });
    }
    isRefreshing = true;
    try {
      const newToken = await attemptTokenRefresh(
        maxRetries,
        retryDelay,
        refreshTokenFn,
        onUnauthorized,
      );
      processQueue(null, newToken);
      if (error.config) error.config.headers.Authorization = `Bearer ${newToken}`;
      return axios(error.config);
    } finally {
      isRefreshing = false;
    }
  } catch {}
};
var onErrorResponse = async (error) => {
  if (axios.isAxiosError(error)) {
    logAxiosErrorShort(error);
    if (error.response) {
      const { status, statusText, data } = error.response;
      const method = error.config?.method;
      const url = error.config?.url;
      const refreshResult = await handleTokenRefresh(error);
      if (refreshResult) {
        return refreshResult;
      }
      logOnDev(
        `onErrorResponse [API] ${method?.toUpperCase?.()} ${url} | Error ${status} ${statusText} | ${error.message}`,
      );
      logResponseData(data, error.config?.data);
    } else {
      const method = error.config?.method;
      const url = error.config?.url;
      logOnDev(
        `onErrorResponse [API] ${method?.toUpperCase?.()} ${url} | Network Error or Request Canceled | ${error.message}`,
      );
    }
  } else if (error.name === 'TimeoutError') {
    logOnDev(`[API] | TimeError ${error.toString()}`);
  } else {
    logOnDev(`[API] | Error ${error.toString()}`);
  }
  try {
    const { onErrorResponse: userHook } = getApiConfig();
    if (userHook) {
      await userHook(error);
    }
  } catch {}
  throw error;
};
var interceptors = (axiosInstance) => {
  axiosInstance.interceptors.request.use(onRequest, onErrorRequest);
  axiosInstance.interceptors.response.use(onResponse, onErrorResponse);
  return axiosInstance;
};

// src/init-api.ts
function customParamsSerializer(params) {
  const parts = [];
  for (const key in params) {
    if (Object.hasOwn(params, key)) {
      const value = params[key];
      if (Array.isArray(value)) {
        value.forEach((v) => {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
        });
      } else if (value !== null && value !== void 0) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    }
  }
  return parts.join('&');
}
function initApi(config) {
  setApiConfig(config);
  const instance = axios.create({
    ...config.axiosOptions,
    baseURL: config.baseURL,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      accept: 'application/json',
      ...config.axiosOptions?.headers,
    },
    responseType: 'json',
    paramsSerializer: config.axiosOptions?.paramsSerializer ?? customParamsSerializer,
    timeoutErrorMessage:
      '\uC694\uCCAD\uC2DC\uAC04\uC774 \uCD08\uACFC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
    timeout: config.axiosOptions?.timeout ?? 1e3 * 60 * 2,
  });
  interceptors(instance);
  setAxiosInstance(instance);
}

// src/customed-axios.ts
var customedAxios = new Proxy(
  {},
  {
    get(_target, prop) {
      const instance = getAxiosInstance();
      const value = instance[prop];
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  },
);

// src/utils/camelize.ts
var toCamelCase = (str) => str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
var deepCamelize = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(deepCamelize);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [toCamelCase(key), deepCamelize(value)]),
    );
  }
  return obj;
};

// src/api-request.ts
async function apiRequest(request) {
  const response = await request;
  const { transformResponse } = getApiConfig();
  let data;
  if (transformResponse === 'camelCase') {
    data = deepCamelize(response.data);
  } else if (typeof transformResponse === 'function') {
    data = transformResponse(response.data);
  } else {
    data = response.data;
  }
  return data;
}

// src/api.ts
var api = {
  get: (url, config) => apiRequest(customedAxios.get(url, config)),
  post: (url, data, config) => apiRequest(customedAxios.post(url, data, config)),
  put: (url, data, config) => apiRequest(customedAxios.put(url, data, config)),
  patch: (url, data, config) => apiRequest(customedAxios.patch(url, data, config)),
  delete: (url, config) => apiRequest(customedAxios.delete(url, config)),
};

export { api, apiRequest, customedAxios, initApi };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map
