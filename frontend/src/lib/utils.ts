import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('pt-BR')
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('pt-BR')
}

export function formatNumber(num: number) {
  return new Intl.NumberFormat('pt-BR').format(num)
}

export function formatPercentage(num: number) {
  return `${num.toFixed(1)}%`
}

export function formatDuration(days: number) {
  if (days < 1) {
    const hours = Math.round(days * 24)
    return `${hours}h`
  }
  return `${days.toFixed(1)}d`
}
