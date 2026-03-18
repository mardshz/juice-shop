/*
 * Copyright ...
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { CaptchaModel } from '../models/captcha'
import * as utils from '../lib/utils'

export function captchas () {
  return async (req: Request, res: Response) => {
    const captchaId = req.app.locals.captchaId++
    const operators = ['*', '+', '-']

    const firstTerm = Math.floor((Math.random() * 10) + 1)
    const secondTerm = Math.floor((Math.random() * 10) + 1)
    const thirdTerm = Math.floor((Math.random() * 10) + 1)

    const firstOperator = operators[Math.floor((Math.random() * 3))]
    const secondOperator = operators[Math.floor((Math.random() * 3))]

    const expression =
      firstTerm.toString() +
      firstOperator +
      secondTerm.toString() +
      secondOperator +
      thirdTerm.toString()

    const answer = eval(expression).toString() // eslint-disable-line no-eval

    const captcha = {
      captchaId,
      captcha: expression,
      answer
    }

    const captchaInstance = CaptchaModel.build(captcha)
    await captchaInstance.save()
    res.json(captcha)
  }
}

export const verifyCaptcha =
  () =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const rawCaptchaId = req.body?.captchaId

        // 1️⃣ Ensure the input is actually a number (not object, array, etc.)
        if (typeof rawCaptchaId !== 'string' && typeof rawCaptchaId !== 'number') {
          res.status(400).send(res.__('Wrong answer to CAPTCHA. Please try again.'))
          return
        }

        // 2️⃣ Convert to number safely
        const captchaId = utils.sanitizeInteger(rawCaptchaId)

        // 3️⃣ Reject null, NaN, undefined, or non‑numbers
        if (captchaId == null || Number.isNaN(captchaId)) {
          res.status(400).send(res.__('Wrong answer to CAPTCHA. Please try again.'))
          return
        }

        // 4️⃣ Safe ORM lookup
        const captcha = await CaptchaModel.findOne({ where: { captchaId } })

        if (captcha != null && req.body.captcha === captcha.answer) {
          next()
        } else {
          res.status(401).send(res.__('Wrong answer to CAPTCHA. Please try again.'))
        }
      } catch (error) {
        next(error)
      }
    }
    