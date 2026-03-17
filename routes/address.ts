/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import { AddressModel } from '../models/address'
import * as utils from '../lib/utils'

export function getAddress () {
  return async (req: Request, res: Response) => {
    const userId = utils.sanitizeInteger(req.body.UserId)
    if (userId == null) {
      return res.status(400).json({ status: 'error', data: 'Invalid user id' })
    }
    const addresses = await AddressModel.findAll({ where: { UserId: userId } })
    res.status(200).json({ status: 'success', data: addresses })
  }
}

export function getAddressById () {
  return async (req: Request, res: Response) => {
    const addressId = utils.sanitizeInteger(req.params.id)
    const userId = utils.sanitizeInteger(req.body.UserId)
    if (addressId == null || userId == null) {
      return res.status(400).json({ status: 'error', data: 'Invalid parameters.' })
    }
    const address = await AddressModel.findOne({ where: { id: addressId, UserId: userId } })
    if (address != null) {
      res.status(200).json({ status: 'success', data: address })
    } else {
      res.status(400).json({ status: 'error', data: 'Malicious activity detected.' })
    }
  }
}

export function delAddressById () {
  return async (req: Request, res: Response) => {
    const addressId = utils.sanitizeInteger(req.params.id)
    const userId = utils.sanitizeInteger(req.body.UserId)
    if (addressId == null || userId == null) {
      return res.status(400).json({ status: 'error', data: 'Invalid parameters.' })
    }
    const address = await AddressModel.destroy({ where: { id: addressId, UserId: userId } })
    if (address) {
      res.status(200).json({ status: 'success', data: 'Address deleted successfully.' })
    } else {
      res.status(400).json({ status: 'error', data: 'Malicious activity detected.' })
    }
  }
}
