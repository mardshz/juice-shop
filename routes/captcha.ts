/*
 * Copyright …
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import { CaptchaModel } from '../models/captcha'
import * as utils from '../lib/utils'
import { randomInt } from 'node:crypto'

function safeMathEval (expr: string): number {
  const tokens = expr.match(/\d+|[+\-*]/g)
  if (!tokens) return NaN

  let result = Number(tokens[0])
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i]
    const num = Number(tokens[i + 1])

    switch (op) {
      case '+': result += num; break
      case '-': result -= num; break
      case '*': result *= num; break
      default: return NaN
    }
  }
  return result
}

export function captchas () {
  return async (req: Request, res: Response) => {
    const captchaId = req.app.locals.captchaId++
    const operators = ['*', '+', '-']

    // 🔐 Secure RNG replacements
    const firstTerm = randomInt(1, 11)       // 1–10
    const secondTerm = randomInt(1, 11)
    const thirdTerm = randomInt(1, 11)

    const firstOperator = operators[randomInt(0, 3)]   // indexes 0–2
    const secondOperator = operators[randomInt(0, 3)]

    const expression =
      firstTerm.toString() +
      firstOperator +
      secondTerm.toString() +
      secondOperator +
      thirdTerm.toString()

    const answer = safeMathEval(expression).toString()

    const captcha = { captchaId, captcha: expression, answer }
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

        if (typeof rawCaptchaId !== 'string' && typeof rawCaptchaId !== 'number') {
          res.status(400).send(res.__('Wrong answer to CAPTCHA. Please try again.'))
          return
        }

        const captchaId = utils.sanitizeInteger(rawCaptchaId)

        if (captchaId == null || Number.isNaN(captchaId)) {
          res.status(400).send(res.__('Wrong answer to CAPTCHA. Please try again.'))
          return
        }

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