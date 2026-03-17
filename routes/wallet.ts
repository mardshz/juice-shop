/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import * as utils from '../lib/utils'
import { WalletModel } from '../models/wallet'
import { CardModel } from '../models/card'

export function getWalletBalance () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = utils.sanitizeInteger(req.body.UserId)
    if (userId == null) {
      return res.status(400).json({ status: 'error' })
    }
    const wallet = await WalletModel.findOne({ where: { UserId: userId } })
    if (wallet != null) {
      res.status(200).json({ status: 'success', data: wallet.balance })
    } else {
      res.status(404).json({ status: 'error' })
    }
  }
}

export function addWalletBalance () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cardId = utils.sanitizeInteger(req.body.paymentId)
    const userId = utils.sanitizeInteger(req.body.UserId)
    const balance = Number(req.body.balance)
    if (userId == null || Number.isNaN(balance) || balance <= 0) {
      return res.status(400).json({ status: 'error' })
    }

    const card = cardId ? await CardModel.findOne({ where: { id: cardId, UserId: userId } }) : null
    if (card != null) {
      try {
        await WalletModel.increment({ balance }, { where: { UserId: userId } })
        res.status(200).json({ status: 'success', data: balance })
      } catch {
        res.status(404).json({ status: 'error' })
      }
    } else {
      res.status(402).json({ status: 'error', message: 'Payment not accepted.' })
    }
  }
}
