/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { BasketItemModel } from '../models/basketitem'
import { QuantityModel } from '../models/quantity'
import * as challengeUtils from '../lib/challengeUtils'

import * as utils from '../lib/utils'
import { challenges } from '../data/datacache'
import * as security from '../lib/insecurity'

interface RequestWithRawBody extends Request {
  rawBody: string
}

export function addBasketItem () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = utils.parseJsonCustom((req as RequestWithRawBody).rawBody)
    const productIds = []
    const basketIds = []
    const quantities = []

    for (let i = 0; i < result.length; i++) {
      if (result[i].key === 'ProductId') {
        productIds.push(result[i].value)
      } else if (result[i].key === 'BasketId') {
        basketIds.push(result[i].value)
      } else if (result[i].key === 'quantity') {
        quantities.push(result[i].value)
      }
    }

    const user = security.authenticatedUsers.from(req)
    if (user && basketIds[0] && basketIds[0] !== 'undefined' && Number(user.bid) != Number(basketIds[0])) { // eslint-disable-line eqeqeq
      res.status(401).send('{\'error\' : \'Invalid BasketId\'}')
    } else {
      const productId = utils.sanitizeInteger(productIds[productIds.length - 1])
      const basketId = utils.sanitizeInteger(basketIds[basketIds.length - 1])
      const quantity = utils.sanitizeInteger(quantities[quantities.length - 1])

      if (productId == null || basketId == null || quantity == null) {
        res.status(400).send('{\'error\' : \'Invalid input\'}')
        return
      }

      const basketItem = {
        ProductId: productId,
        BasketId: basketId,
        quantity
      }
      challengeUtils.solveIf(challenges.basketManipulateChallenge, () => {
        const bid = user ? Number(user.bid) : NaN
        return user && basketItem.BasketId != null && !Number.isNaN(bid) && bid !== basketItem.BasketId
      }) // eslint-disable-line eqeqeq

      const basketItemInstance = BasketItemModel.build(basketItem)
      try {
        const addedBasketItem = await basketItemInstance.save()
        res.json({ status: 'success', data: addedBasketItem })
      } catch (error) {
        next(error)
      }
    }
  }
}

export function quantityCheckBeforeBasketItemAddition () {
  return (req: Request, res: Response, next: NextFunction) => {
    const productId = utils.sanitizeInteger(req.body.ProductId)
    const quantity = utils.sanitizeInteger(req.body.quantity)
    void quantityCheck(req, res, next, productId, quantity).catch((error: Error) => {
      next(error)
    })
  }
}
export function quantityCheckBeforeBasketItemUpdate () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const itemId = utils.sanitizeInteger(req.params.id)
      const item = itemId ? await BasketItemModel.findOne({ where: { id: itemId } }) : null
      const user = security.authenticatedUsers.from(req)
      const basketId = utils.sanitizeInteger(req.body.BasketId)
      challengeUtils.solveIf(challenges.basketManipulateChallenge, () => { return user && basketId != null && user.bid != basketId }) // eslint-disable-line eqeqeq
      const quantity = utils.sanitizeInteger(req.body.quantity)
      if (quantity != null) {
        if (item == null) {
          throw new Error('No such item found!')
        }
        void quantityCheck(req, res, next, item.ProductId, quantity)
      } else {
        next()
      }
    } catch (error) {
      next(error)
    }
  }
}

async function quantityCheck (req: Request, res: Response, next: NextFunction, id: number | null, quantity: number | null) {
  if (id == null || quantity == null) {
    throw new Error('Invalid parameters')
  }
  const product = await QuantityModel.findOne({ where: { ProductId: id } })
  if (product == null) {
    throw new Error('No such product found!')
  }

  // is product limited per user and order, except if user is deluxe?
  if (!product.limitPerUser || (product.limitPerUser && product.limitPerUser >= quantity) || security.isDeluxe(req)) {
    if (product.quantity >= quantity) { // enough in stock?
      next()
    } else {
      res.status(400).json({ error: res.__('We are out of stock! Sorry for the inconvenience.') })
    }
  } else {
    res.status(400).json({ error: res.__('You can order only up to {{quantity}} items of this product.', { quantity: product.limitPerUser.toString() }) })
  }
}
