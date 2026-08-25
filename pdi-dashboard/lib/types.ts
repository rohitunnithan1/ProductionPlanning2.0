export interface VehicleRecord {
  id: number
  month: string
  sr_no: string
  production_date: string   // "DD-MM-YYYY"
  production_time: string   // "HH:MM"
  vin: string
  vcu: string
  motor_no: string
  evcc: string
  mcu: string
  pdi_remarks: string
  pdi_signoff_date: string  // "DD-MM-YYYY" or ""
  pdi_signed_off: boolean
  has_issues: boolean
  source_sheet: string
}

export interface DailyCount {
  date: string   // "DD-MM-YYYY"
  count: number
  signedOff: number
  plan: number   // planned vehicles from PPC sheet (Vehicle - Movement to Plant Outbound)
}

export interface ProductionStats {
  total: number
  signedOff: number
  pending: number
  withIssues: number
  allOK: number
  dailyCounts: DailyCount[]
  latestVehicles: VehicleRecord[]
  month: string
}
