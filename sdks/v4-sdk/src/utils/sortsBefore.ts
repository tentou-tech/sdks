import { Currency } from '@tentou-tech/uniswap-sdk-core'

export function sortsBefore(currencyA: Currency, currencyB: Currency): boolean {
  if (currencyA.isNative) return true
  if (currencyB.isNative) return false
  return currencyA.wrapped.sortsBefore(currencyB.wrapped)
}
