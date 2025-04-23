import { Pool as V4Pool } from '@uniswap/v4-sdk'
import { Pair } from '@uniswap/v2-sdk'
import { Pool as V3Pool } from '@tentou-tech/uniswap-v3-sdk'
import { Pool as V3S1Pool } from '@tentou-tech/uniswap-v3s1-sdk'

export type TPool = Pair | V3Pool | V3S1Pool | V4Pool
