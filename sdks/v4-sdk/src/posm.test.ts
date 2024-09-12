import { Percent, Token, CurrencyAmount, Ether } from '@uniswap/sdk-core'
import { FeeAmount, MIN_SLIPPAGE_DECREASE, TICK_SPACINGS } from './internalConstants'
import { Pool } from './entities/pool'
import { Position } from './entities/position'
import { V4PositionManager } from './PositionManager'
import { Multicall } from './multicall'
import { encodeSqrtRatioX96 } from '@uniswap/v3-sdk'
import { Actions, V4Planner } from './utils'

describe('POSM', () => {
  const token0 = new Token(1, '0x0000000000000000000000000000000000000001', 18, 't0', 'token0')
  const token1 = new Token(1, '0x0000000000000000000000000000000000000002', 18, 't1', 'token1')

  const fee = FeeAmount.MEDIUM
  const tickSpacing = 60 // for MEDIUM

  const pool_0_1 = new Pool(
    token0,
    token1,
    fee,
    tickSpacing,
    '0x0000000000000000000000000000000000000000',
    encodeSqrtRatioX96(1, 1).toString(),
    0,
    0,
    []
  )
  // const pool_1_weth = new Pool(
  //   token1,
  //   WETH9[1],
  //   fee,
  //   tickSpacing,
  //   '0x0000000000000000000000000000000000000000',
  //   encodeSqrtRatioX96(1, 1).toString(),
  //   0,
  //   0,
  //   []
  // )

  const recipient = '0x0000000000000000000000000000000000000003'
  const sender = '0x0000000000000000000000000000000000000004'
  const tokenId = 1
  const slippageTolerance = new Percent(1, 100)
  const deadline = 123

  let planner: V4Planner;

  beforeEach(() => {
    planner = new V4Planner()
  })

  describe('#createCallParameters', () => {
    it('succeeds', () => {
      const { calldata, value } = V4PositionManager.createCallParameters(pool_0_1.poolKey, 0)

      /**
       * 1) "initializePool((address,address,uint24,int24,address),uint160,bytes)"
            (0x0000000000000000000000000000000000000001, 0x0000000000000000000000000000000000000002, 3000, 60, 0x0000000000000000000000000000000000000000)
            0
            0x00
       */
      expect(calldata).toEqual(
        '0x3b1fda97000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000000000000000000000000000000000000000003c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000000'
      )
      expect(value).toEqual('0x00')
    })
  })

  describe('#addCallParameters', () => {
    it('throws if liquidity is 0', () => {
      expect(() =>
        V4PositionManager.addCallParameters(
          new Position({
            pool: pool_0_1,
            tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
            tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
            liquidity: 0,
          }),
          { recipient, slippageTolerance, deadline }
        )
      ).toThrow('ZERO_LIQUIDITY')
    })

    // TODO: throws if pool involves ETH but useNative is not used

    it('succeeds for mint', () => {
      const { calldata, value } = V4PositionManager.addCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1,
        }),
        { recipient, slippageTolerance, deadline }
      )

      const calldatas = Multicall.decodeMulticall(calldata)
      // Expect mint position to be called correctly
      planner.addAction(Actions.MINT_POSITION, [
        pool_0_1.poolKey,
        -TICK_SPACINGS[FeeAmount.MEDIUM],
        TICK_SPACINGS[FeeAmount.MEDIUM],
        1,
        0,
        0,
        recipient,
        '0x',
      ])
      // Expect there to be a settle pair call afterwards
      planner.addAction(Actions.SETTLE_PAIR, [pool_0_1.token0.wrapped.address, pool_0_1.token1.wrapped.address])
      expect(calldatas[0]).toEqual(planner.finalize())
      expect(value).toEqual('0x00')
    })
    it('succeeds for mint', () => {
      const { calldata, value } = V4PositionManager.addCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1,
        }),
        { recipient, slippageTolerance, deadline }
      )

      const calldatas = Multicall.decodeMulticall(calldata)
      const planner = new V4Planner()
      // Expect mint position to be called correctly
      planner.addAction(Actions.MINT_POSITION, [
        pool_0_1.poolKey,
        -TICK_SPACINGS[FeeAmount.MEDIUM],
        TICK_SPACINGS[FeeAmount.MEDIUM],
        '1',
        '0',
        '0',
        recipient,
        '0x',
      ])
      // Expect there to be a settle pair call afterwards
      planner.addAction(Actions.SETTLE_PAIR, [pool_0_1.token0.wrapped.address, pool_0_1.token1.wrapped.address])
      expect(calldatas[0]).toEqual(planner.finalize())
      expect(value).toEqual('0x00')
    })

    it('succeeds for increase', () => {
      const { calldata, value } = V4PositionManager.addCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1,
        }),
        { tokenId, slippageTolerance, deadline }
      )

      const calldatas = Multicall.decodeMulticall(calldata)
      const planner = new V4Planner()
      // Expect increase liquidity to be called correctly
      planner.addAction(Actions.INCREASE_LIQUIDITY, [tokenId.toString(), '1', '0', '0', '0x'])
      // Expect there to be a settle pair call afterwards
      planner.addAction(Actions.SETTLE_PAIR, [pool_0_1.token0.wrapped.address, pool_0_1.token1.wrapped.address])
      expect(calldatas[0]).toEqual(planner.finalize())
      expect(value).toEqual('0x00')
    })

    it('createPool initializes pool if does not exist', () => {
      const { calldata, value } = V4PositionManager.addCallParameters(
        new Position({
          pool: pool_0_1,
          tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
          tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
          liquidity: 1,
        }),
        { recipient, slippageTolerance, deadline, createPool: true, sqrtPriceX96: 0 }
      )

      const calldatas = Multicall.decodeMulticall(calldata)
      // Expect initializePool to be called correctly
      expect(calldatas[0]).toEqual(
        V4PositionManager.INTERFACE.encodeFunctionData('initializePool', [pool_0_1.poolKey, '0', '0x'])
      )
      const planner = new V4Planner()
      // Expect position to be minted correctly
      planner.addAction(Actions.MINT_POSITION, [
        pool_0_1.poolKey,
        -TICK_SPACINGS[FeeAmount.MEDIUM],
        TICK_SPACINGS[FeeAmount.MEDIUM],
        '1',
        '0',
        '0',
        recipient,
        '0x',
      ])
      planner.addAction(Actions.SETTLE_PAIR, [pool_0_1.token0.wrapped.address, pool_0_1.token1.wrapped.address])
      expect(calldatas[1]).toEqual(planner.finalize())
      expect(value).toEqual('0x00')
    })
  })

  describe('#removeCallParameters', () => {
    const position = new Position({
      pool: pool_0_1,
      tickLower: -TICK_SPACINGS[FeeAmount.MEDIUM],
      tickUpper: TICK_SPACINGS[FeeAmount.MEDIUM],
      liquidity: 100,
    })

    const commonOptions = {
      tokenId,
      liquidityPercentage: new Percent(1),
      slippageTolerance,
      deadline,
      collectOptions: {
        expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 0),
        expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 0),
        recipient,
      },
    }

    it('throws for 0 liquidity', () => {
      const zeroLiquidityPosition = new Position({
        ...position,
        liquidity: 0,
      })

      expect(() =>
        V4PositionManager.removeCallParameters(zeroLiquidityPosition, commonOptions)
      ).toThrow('ZERO_LIQUIDITY')
    })

    it('removes liquidity', () => {
      const { calldata, value } = V4PositionManager.removeCallParameters(position, commonOptions)

      const calldatas = Multicall.decodeMulticall(calldata)
      const planner = new V4Planner()

      planner.addAction(Actions.DECREASE_LIQUIDITY, [tokenId.toString(), '100', '0', '0', '0x'])
      planner.addAction(Actions.TAKE_PAIR, [token0.address, token1.address, recipient])
      planner.addAction(Actions.BURN_POSITION, [tokenId.toString(), '0', '0', '0x'])

      expect(calldatas[0]).toEqual(planner.finalize())
      expect(value).toEqual('0x00')
    })

    it('removes partial liquidity', () => {
      const partialOptions = {
        ...commonOptions,
        liquidityPercentage: new Percent(1, 2), // 50%
      }

      const { calldata, value } = V4PositionManager.removeCallParameters(position, partialOptions)

      const calldatas = Multicall.decodeMulticall(calldata)
      const planner = new V4Planner()

      planner.addAction(Actions.DECREASE_LIQUIDITY, [tokenId.toString(), '50', '0', '0', '0x'])
      planner.addAction(Actions.TAKE_PAIR, [token0.address, token1.address, recipient])

      expect(calldatas[0]).toEqual(planner.finalize())
      expect(value).toEqual('0x00')
    })
  })

  describe('#collectCallParameters', () => {
    const commonOptions = {
      tokenId,
      expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(token0, 10),
      expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(token1, 20),
      recipient,
      slippageTolerance
    }

    it('collects fees', () => {
      const { calldata, value } = V4PositionManager.collectCallParameters(commonOptions)

      const calldatas = Multicall.decodeMulticall(calldata)
      const planner = new V4Planner()

      planner.addAction(Actions.DECREASE_LIQUIDITY, [tokenId.toString(), '0', MIN_SLIPPAGE_DECREASE, MIN_SLIPPAGE_DECREASE, '0x'])
      planner.addAction(Actions.TAKE_PAIR, [token0.address, token1.address, recipient])

      expect(calldatas[0]).toEqual(planner.finalize())
      expect(value).toEqual('0x00')
    })

    it('handles native ETH', () => {
      const nativeOptions = {
        ...commonOptions,
        expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(Ether.onChain(1), 10),
        slippageTolerance
      }

      const { calldata, value } = V4PositionManager.collectCallParameters(nativeOptions)

      const calldatas = Multicall.decodeMulticall(calldata)
      const planner = new V4Planner()

      planner.addAction(Actions.DECREASE_LIQUIDITY, [tokenId.toString(), '0', MIN_SLIPPAGE_DECREASE, MIN_SLIPPAGE_DECREASE, '0x'])
      planner.addAction(Actions.TAKE_PAIR, [token0.wrapped.address, token1.address, recipient])

      expect(calldatas[0]).toEqual(planner.finalize())
      expect(value).toEqual('0x00')
    })
  })

  describe('#transferFromParams', () => {
    it('succeeds', () => {
      const options = {
        sender,
        recipient,
        tokenId,
      }
      const { calldata, value } = V4PositionManager.transferFromParameters(options)

      expect(calldata).toEqual(
        '0x23b872dd000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000001'
      )
      expect(value).toEqual('0x00')
    })
  })
})
