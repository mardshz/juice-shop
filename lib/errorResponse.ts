import { Response } from 'express'

export const sendError = (res: Response, status: number, message: string) => {
  return res.status(status).json({ status: 'error', message })
}