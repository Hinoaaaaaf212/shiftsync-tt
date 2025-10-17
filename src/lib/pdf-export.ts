import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Shift } from './database.types'
import { formatDateTrinidad, formatTimeTrinidad, calculateShiftHours, formatCurrencyTTD } from './date-utils'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, startOfMonth, endOfMonth, startOfYear } from 'date-fns'
import { calculateNetPay, formatTTD } from './trinidad-tax'

interface Employee {
  id: string
  first_name: string
  last_name: string
  role: string
  position?: string
}

interface ExportOptions {
  businessName: string
  weekStart: Date
  shifts: Shift[]
  employees: Employee[]
}

/**
 * Export weekly schedule to PDF
 */
export function exportWeeklyScheduleToPDF(options: ExportOptions): void {
  const { businessName, weekStart, shifts, employees } = options

  // Calculate week dates
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Create employee map for quick lookup
  const employeeMap = new Map<string, Employee>()
  employees.forEach(emp => {
    employeeMap.set(emp.id, emp)
  })

  // Create PDF
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  // Add header
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(businessName, 14, 15)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Weekly Schedule: ${formatDateTrinidad(weekStart)} - ${formatDateTrinidad(weekEnd)}`,
    14,
    23
  )

  doc.setFontSize(10)
  doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 29)

  let yPosition = 35

  // Process each day
  daysOfWeek.forEach((day, index) => {
    const dayShifts = shifts.filter(shift => {
      if (!shift.shift_date) return false
      return isSameDay(parseISO(shift.shift_date), day)
    })

    // Add day header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(format(day, 'EEEE, dd/MM/yyyy'), 14, yPosition)

    yPosition += 7

    if (dayShifts.length === 0) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.text('No shifts scheduled', 20, yPosition)
      yPosition += 10
    } else {
      // Create table data for this day
      const tableData = dayShifts.map(shift => {
        const employee = employeeMap.get(shift.employee_id)
        const employeeName = employee
          ? `${employee.first_name} ${employee.last_name}`
          : 'Unknown'
        const role = employee?.role || '-'
        const hours = calculateShiftHours(shift.start_time, shift.end_time)

        return [
          employeeName,
          role,
          `${formatTimeTrinidad(shift.start_time)} - ${formatTimeTrinidad(shift.end_time)}`,
          `${hours.toFixed(1)}h`,
          shift.position || '-',
          shift.notes || '-'
        ]
      })

      // Add table
      autoTable(doc, {
        startY: yPosition,
        head: [['Employee', 'Role', 'Time', 'Hours', 'Position', 'Notes']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2
        },
        headStyles: {
          fillColor: [59, 130, 246], // primary-500
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251] // gray-50
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Employee
          1: { cellWidth: 25 }, // Role
          2: { cellWidth: 50 }, // Time
          3: { cellWidth: 20 }, // Hours
          4: { cellWidth: 30 }, // Position
          5: { cellWidth: 'auto' } // Notes
        }
      })

      yPosition = (doc as any).lastAutoTable.finalY + 10
    }

    // Add page break if needed (except for last day)
    if (index < daysOfWeek.length - 1 && yPosition > 170) {
      doc.addPage()
      yPosition = 15
    }
  })

  // Add summary statistics on a new page
  doc.addPage()
  yPosition = 15

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Weekly Summary', 14, yPosition)

  yPosition += 10

  // Calculate total hours and shifts per employee
  const employeeStats = new Map<string, { name: string; role: string; shifts: number; hours: number }>()

  shifts.forEach(shift => {
    const employee = employeeMap.get(shift.employee_id)
    if (!employee) return

    const hours = calculateShiftHours(shift.start_time, shift.end_time)
    const key = shift.employee_id

    if (employeeStats.has(key)) {
      const stats = employeeStats.get(key)!
      stats.shifts += 1
      stats.hours += hours
    } else {
      employeeStats.set(key, {
        name: `${employee.first_name} ${employee.last_name}`,
        role: employee.role,
        shifts: 1,
        hours: hours
      })
    }
  })

  // Create summary table
  const summaryData = Array.from(employeeStats.values())
    .sort((a, b) => b.hours - a.hours)
    .map(stat => [
      stat.name,
      stat.role,
      stat.shifts.toString(),
      `${stat.hours.toFixed(1)}h`
    ])

  if (summaryData.length > 0) {
    autoTable(doc, {
      startY: yPosition,
      head: [['Employee', 'Role', 'Shifts', 'Total Hours']],
      body: summaryData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 }
      },
      foot: [[
        'TOTAL',
        '',
        summaryData.length.toString() + ' employees',
        summaryData.reduce((sum, row) => sum + parseFloat(row[3]), 0).toFixed(1) + 'h'
      ]],
      footStyles: {
        fillColor: [243, 244, 246],
        textColor: [0, 0, 0],
        fontStyle: 'bold'
      }
    })
  } else {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('No shifts scheduled this week', 14, yPosition)
  }

  // Add footer to all pages
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128, 128, 128)
    doc.text(
      `Page ${i} of ${pageCount} • Generated by ShiftSync TT`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Save the PDF
  const fileName = `${businessName.replace(/\s+/g, '_')}_Schedule_${format(weekStart, 'yyyy-MM-dd')}.pdf`
  doc.save(fileName)
}

/**
 * Export employee schedule to PDF
 */
export function exportEmployeeScheduleToPDF(
  employeeName: string,
  businessName: string,
  shifts: Shift[],
  startDate: Date,
  endDate: Date
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Add header
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(`${employeeName}'s Schedule`, 14, 15)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(businessName, 14, 23)
  doc.text(
    `${formatDateTrinidad(startDate)} - ${formatDateTrinidad(endDate)}`,
    14,
    29
  )

  // Create table data
  const tableData = shifts.map(shift => {
    const hours = calculateShiftHours(shift.start_time, shift.end_time)
    return [
      formatDateTrinidad(shift.shift_date),
      format(parseISO(shift.shift_date), 'EEEE'),
      `${formatTimeTrinidad(shift.start_time)} - ${formatTimeTrinidad(shift.end_time)}`,
      `${hours.toFixed(1)}h`,
      shift.position || '-',
      shift.notes || ''
    ]
  })

  // Add table
  autoTable(doc, {
    startY: 35,
    head: [['Date', 'Day', 'Time', 'Hours', 'Position', 'Notes']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 25 },
      2: { cellWidth: 45 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 },
      5: { cellWidth: 'auto' }
    }
  })

  // Add summary
  const totalHours = shifts.reduce((sum, shift) => {
    return sum + calculateShiftHours(shift.start_time, shift.end_time)
  }, 0)

  const finalY = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${shifts.length} shifts, ${totalHours.toFixed(1)} hours`, 14, finalY)

  // Save the PDF
  const fileName = `${employeeName.replace(/\s+/g, '_')}_Schedule_${format(startDate, 'yyyy-MM-dd')}.pdf`
  doc.save(fileName)
}

/**
 * Export employee pay slip to PDF (Trinidad format)
 */
export interface PaySlipOptions {
  businessName: string
  businessAddress?: string
  employeeName: string
  employeeId: string
  employeeRole: string
  employeePosition?: string
  hourlyRate: number
  payPeriodStart: Date
  payPeriodEnd: Date
  paymentDate: Date
  shifts: Shift[]
  allYearShifts: Shift[] // For YTD calculations
}

export function exportPaySlipToPDF(options: PaySlipOptions): void {
  const {
    businessName,
    businessAddress,
    employeeName,
    employeeId,
    employeeRole,
    employeePosition,
    hourlyRate,
    payPeriodStart,
    payPeriodEnd,
    paymentDate,
    shifts,
    allYearShifts
  } = options

  // Calculate current period totals
  const totalHours = shifts.reduce((sum, shift) => {
    return sum + calculateShiftHours(shift.start_time, shift.end_time)
  }, 0)

  const grossPay = totalHours * hourlyRate
  const payCalc = calculateNetPay(grossPay)

  // Calculate Year-to-Date totals
  const ytdHours = allYearShifts.reduce((sum, shift) => {
    return sum + calculateShiftHours(shift.start_time, shift.end_time)
  }, 0)

  const ytdGrossPay = ytdHours * hourlyRate
  const ytdPayCalc = calculateNetPay(ytdGrossPay)

  // Create PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  let yPos = 20

  // Header - PAY SLIP Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('PAY SLIP', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // Business Name
  doc.setFontSize(14)
  doc.text(businessName, pageWidth / 2, yPos, { align: 'center' })
  yPos += 5

  // Business Address
  if (businessAddress) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(businessAddress, pageWidth / 2, yPos, { align: 'center' })
    yPos += 8
  } else {
    yPos += 3
  }

  // Horizontal line
  doc.setLineWidth(0.5)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 8

  // Pay Slip Details (Left side)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Pay Slip No:', 14, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${format(payPeriodEnd, 'yyyy-MM')}-${employeeId.substring(0, 8).toUpperCase()}`,
    60,
    yPos
  )

  yPos += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Payment Date:', 14, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDateTrinidad(paymentDate), 60, yPos)

  yPos += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Pay Period:', 14, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `${formatDateTrinidad(payPeriodStart)} - ${formatDateTrinidad(payPeriodEnd)}`,
    60,
    yPos
  )

  yPos += 10

  // Employee Details Section
  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 6

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('EMPLOYEE DETAILS', 14, yPos)
  yPos += 6

  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Name:', 14, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(employeeName, 60, yPos)

  yPos += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Position:', 14, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(employeePosition || employeeRole, 60, yPos)

  yPos += 5
  doc.setFont('helvetica', 'bold')
  doc.text('Employee ID:', 14, yPos)
  doc.setFont('helvetica', 'normal')
  doc.text(employeeId.substring(0, 8).toUpperCase(), 60, yPos)

  yPos += 10

  // Earnings Section
  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 6

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('EARNINGS', 14, yPos)
  yPos += 2

  // Earnings table
  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Hours', 'Rate', 'Amount']],
    body: [
      [
        'Regular Hours',
        totalHours.toFixed(2),
        formatTTD(hourlyRate),
        formatTTD(grossPay)
      ]
    ],
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 2
    },
    headStyles: {
      fontStyle: 'bold',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 25, halign: 'right' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 42, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  })

  yPos = (doc as any).lastAutoTable.finalY + 3

  // Gross Pay Total
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('GROSS PAY', pageWidth - 56, yPos)
  doc.text(formatTTD(payCalc.grossPay), pageWidth - 14, yPos, { align: 'right' })

  yPos += 8

  // Deductions Section
  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 6

  doc.setFontSize(11)
  doc.text('DEDUCTIONS', 14, yPos)
  yPos += 2

  // Deductions table
  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Amount']],
    body: [
      ['NIS (4.2%)', formatTTD(payCalc.nis)],
      ['PAYE', formatTTD(payCalc.paye)]
    ],
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 2
    },
    headStyles: {
      fontStyle: 'bold',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 42, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  })

  yPos = (doc as any).lastAutoTable.finalY + 3

  // Total Deductions
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL DEDUCTIONS', 14, yPos)
  doc.text(formatTTD(payCalc.totalDeductions), pageWidth - 14, yPos, { align: 'right' })

  yPos += 10

  // Net Pay - Highlighted
  doc.setLineWidth(0.5)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 8

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('NET PAY', 14, yPos)
  doc.text(formatTTD(payCalc.netPay), pageWidth - 14, yPos, { align: 'right' })

  yPos += 5
  doc.setLineWidth(0.5)
  doc.line(14, yPos, pageWidth - 14, yPos)

  yPos += 12

  // Year-to-Date Summary
  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 6

  doc.setFontSize(11)
  doc.text('YEAR-TO-DATE SUMMARY', 14, yPos)
  yPos += 2

  // YTD table
  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Amount']],
    body: [
      ['Gross Earnings YTD', formatTTD(ytdPayCalc.grossPay)],
      ['NIS YTD', formatTTD(ytdPayCalc.nis)],
      ['PAYE YTD', formatTTD(ytdPayCalc.paye)],
      ['Net Pay YTD', formatTTD(ytdPayCalc.netPay)]
    ],
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 2
    },
    headStyles: {
      fontStyle: 'bold',
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0]
    },
    columnStyles: {
      0: { cellWidth: 140, fontStyle: 'bold' },
      1: { cellWidth: 42, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  })

  yPos = (doc as any).lastAutoTable.finalY + 10

  // Footer
  doc.setLineWidth(0.3)
  doc.line(14, yPos, pageWidth - 14, yPos)
  yPos += 5

  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text('This is a computer-generated document.', pageWidth / 2, yPos, { align: 'center' })
  yPos += 4
  doc.text(
    `Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  )

  // Save the PDF
  const fileName = `PaySlip_${employeeName.replace(/\s+/g, '_')}_${format(payPeriodEnd, 'yyyy-MM')}.pdf`
  doc.save(fileName)
}
