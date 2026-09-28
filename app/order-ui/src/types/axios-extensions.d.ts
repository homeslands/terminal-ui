// eslint-disable-next-line @typescript-eslint/no-unused-vars
import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    doNotShowLoading?: boolean
    _retry?: boolean
  }
  interface InternalAxiosRequestConfig {
    doNotShowLoading?: boolean
    _retry?: boolean
  }
}
