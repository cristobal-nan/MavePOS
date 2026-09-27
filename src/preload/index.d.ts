import { WindowAPI } from './index'

declare global {
  interface Window {
    api: WindowAPI
  }
}
