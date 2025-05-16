import { pack } from '@ethersproject/solidity'
import { Currency } from '@tentou-tech/uniswap-sdk-core'
import { Pair } from '@tentou-tech/uniswap-v2-sdk'
import { Pool as V3Pool } from '@tentou-tech/uniswap-v3-sdk'
import { Pool as V4Pool } from '@tentou-tech/uniswap-v4-sdk'
import { Pool as V3S1Pool } from '@tentou-tech/uniswap-v3s1-sdk'
import {
  ADDRESS_ZERO,
  MIXED_QUOTER_V2_V2_FEE_PATH_PLACEHOLDER,
  MIXED_QUOTER_V2_V3_FEE_PATH_PLACEHOLDER,
  MIXED_QUOTER_V2_V4_FEE_PATH_PLACEHOLDER,
  MIXED_QUOTER_V2_V3S1_FEE_PATH_PLACEHOLDER,
} from '../constants'
import { MixedRouteSDK } from '../entities/mixedRoute/route'

/**
 * Converts a route to a hex encoded path
 * @notice only supports exactIn route encodings
 * @param route the mixed path to convert to an encoded path
 * @returns the exactIn encoded path
 */
export function encodeMixedRouteDexToPath(route: MixedRouteSDK<Currency, Currency>): string {
  let path: (string | number)[] = [route.pathInput.isNative ? ADDRESS_ZERO : route.pathInput.address]
  let types: string[] = ['address']
  let currencyIn = route.pathInput

  for (const pool of route.pools) {
    const currencyOut = currencyIn.equals(pool.token0) ? pool.token1 : pool.token0

    if (pool instanceof V4Pool) {
      // a tickSpacing of 0 indicates a "fake" v4 pool where the quote actually requires a wrap or unwrap
      // the fake v4 pool will always have native as token0 and wrapped native as token1
      if (pool.tickSpacing === 0) {
        const wrapOrUnwrapEncoding = 0
        path.push(wrapOrUnwrapEncoding, currencyOut.isNative ? ADDRESS_ZERO : currencyOut.wrapped.address)
        types.push('uint8', 'address')
      } else {
        const v4Fee = pool.fee + MIXED_QUOTER_V2_V4_FEE_PATH_PLACEHOLDER
        path.push(
          v4Fee,
          pool.tickSpacing,
          pool.hooks,
          currencyOut.isNative ? ADDRESS_ZERO : currencyOut.wrapped.address
        )
        types.push('uint24', 'uint24', 'address', 'address')
      }
    } else if (pool instanceof V3Pool) {
      const v3Fee = pool.fee + MIXED_QUOTER_V2_V3_FEE_PATH_PLACEHOLDER
      path.push(v3Fee, currencyOut.wrapped.address)
      types.push('uint24', 'address')
    } else if (pool instanceof V3S1Pool) {
      const v3s1Fee = pool.fee + MIXED_QUOTER_V2_V3S1_FEE_PATH_PLACEHOLDER
      path.push(v3s1Fee, currencyOut.wrapped.address)
      types.push('uint24', 'address')
    } else if (pool instanceof Pair) {
      const v2Fee = MIXED_QUOTER_V2_V2_FEE_PATH_PLACEHOLDER
      path.push(v2Fee, currencyOut.wrapped.address)
      types.push('uint8', 'address')
    } else {
      throw new Error(`Unsupported pool type ${JSON.stringify(pool)}`)
    }

    currencyIn = currencyOut
  }

  return pack(types, path)
}
