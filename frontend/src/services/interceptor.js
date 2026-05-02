import HttpService from "./htttp.service";

let interceptorsInitialized = false;

export const setupAxiosInterceptors = (onUnauthenticated) => {
  if (interceptorsInitialized) return;

  const onRequestSuccess = async (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  };
  const onRequestFail = (error) => Promise.reject(error);

  HttpService.addRequestInterceptor(onRequestSuccess, onRequestFail);

  const onResponseSuccess = (response) => response;

  const onResponseFail = (error) => {
    const status = error?.response?.status || error?.status;
    if (status === 401) {
      onUnauthenticated();
    }

    return Promise.reject(error);
  };
  HttpService.addResponseInterceptor(onResponseSuccess, onResponseFail);
  interceptorsInitialized = true;
};
