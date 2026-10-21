import { ipcMain } from 'electron'
import { CustomerService } from '../services/customerService'
import { CustomerInput, CreditMovementInput, CustomerSearchOptions } from '../../shared/types'

export function registerCustomerIpc(customerService: CustomerService): void {
  ipcMain.handle('customers:getCustomers', (_event, options?: CustomerSearchOptions) => {
    return customerService.getCustomers(options)
  })

  ipcMain.handle('customers:getCustomerById', (_event, id: number) => {
    return customerService.getCustomerById(id)
  })

  ipcMain.handle('customers:getCustomerByRut', (_event, rut: string) => {
    return customerService.getCustomerByRut(rut)
  })

  ipcMain.handle('customers:saveCustomer', (_event, input: CustomerInput) => {
    return customerService.saveCustomer(input)
  })

  ipcMain.handle('customers:deleteCustomer', (_event, id: number) => {
    return customerService.deleteCustomer(id)
  })

  ipcMain.handle('customers:addCreditMovement', (_event, input: CreditMovementInput) => {
    return customerService.addCreditMovement(input)
  })

  ipcMain.handle('customers:getStatement', (_event, customerId: number) => {
    return customerService.getCustomerStatement(customerId)
  })
}
