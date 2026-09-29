import { ipcMain } from 'electron'
import { ReportService } from '../services/reportService'
import { ReportFilter } from '../../shared/types'

export function registerReportsIpc(reportService: ReportService): void {
  ipcMain.handle('reports:getData', (_event, filter: ReportFilter) => {
    return reportService.getReportData(filter)
  })

  ipcMain.handle('reports:exportExcel', (_event, filter: ReportFilter, targetFilePath?: string) => {
    return reportService.exportReportToExcel(filter, targetFilePath)
  })
}
