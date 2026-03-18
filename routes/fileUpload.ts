/*
 * Copyright (c) 2014-2026 
 * SPDX-License-Identifier: MIT
 */

import os from 'node:os'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import yaml from 'js-yaml'
import libxml from 'libxmljs2'
import unzipper from 'unzipper'
import { randomUUID } from 'node:crypto'
import { type NextFunction, type Request, type Response } from 'express'

import * as challengeUtils from '../lib/challengeUtils'
import { challenges } from '../data/datacache'
import * as utils from '../lib/utils'

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

function ensureFileIsPassed ({ file }: Request, res: Response, next: NextFunction) {
  if (file) {
    next()
    return
  }

  res.status(400)
  res.json({ error: 'File is not passed' })
}

/* -------------------------------------------------------------------------- */
/*                              ZIP FILE HANDLER                               */
/* -------------------------------------------------------------------------- */

function handleZipFileUpload ({ file }: Request, res: Response, next: NextFunction) {
  try {
    if (!file || !utils.endsWith(file.originalname.toLowerCase(), '.zip')) {
      next()
      return
    }

    if (!file.buffer || !utils.isChallengeEnabled(challenges.fileWriteChallenge)) {
      res.status(204).end()
      return
    }

    const tempZipPath = path.join(os.tmpdir(), `${randomUUID()}.zip`)

    fs.writeFile(tempZipPath, file.buffer, err => {
      if (err) { next(err); return }

      fs.createReadStream(tempZipPath)
        .pipe(unzipper.Parse())
        .on('entry', (entry: any) => {
          try {
            const filename = path.basename(entry.path)
            const baseDir = path.resolve('uploads/complaints/')
            const safePath = path.join(baseDir, filename)
            const normalized = path.normalize(safePath)

            if (!normalized.startsWith(baseDir)) {
              entry.autodrain()
              return
            }

            challengeUtils.solveIf(
              challenges.fileWriteChallenge,
              () => normalized === path.resolve('ftp/legal.md')
            )

            const stream = fs.createWriteStream(normalized)
            stream.on('error', err => { next(err) })
            entry.pipe(stream)
          } catch (err) {
            next(err)
          }
        })
        .on('error', err => { next(err) })
        .on('close', () => {
          res.status(204).end()
        })
    })
  } catch (err) {
    next(err)
  }
}

/* -------------------------------------------------------------------------- */
/*                                 SIZE CHECK                                 */
/* -------------------------------------------------------------------------- */

function checkUploadSize ({ file }: Request, res: Response, next: NextFunction) {
  if (file) {
    challengeUtils.solveIf(
      challenges.uploadSizeChallenge,
      () => file.size > 100000
    )
  }
  next()
}

/* -------------------------------------------------------------------------- */
/*                             FILE TYPE CHECKER                              */
/* -------------------------------------------------------------------------- */

function checkFileType ({ file }: Request, res: Response, next: NextFunction) {
  const fileType = file?.originalname
    .substring(file.originalname.lastIndexOf('.') + 1)
    .toLowerCase()

  challengeUtils.solveIf(
    challenges.uploadTypeChallenge,
    () => !(fileType === 'pdf' || fileType === 'xml' || fileType === 'zip' || fileType === 'yml' || fileType === 'yaml')
  )

  next()
}

/* -------------------------------------------------------------------------- */
/*                                 XML HANDLER                                 */
/* -------------------------------------------------------------------------- */
/* Full‑secure version: XXE disabled (Option A) */

function handleXmlUpload ({ file }: Request, res: Response, next: NextFunction) {
  if (!utils.endsWith(file?.originalname.toLowerCase(), '.xml')) {
    next()
    return
  }

  challengeUtils.solveIf(challenges.deprecatedInterfaceChallenge, () => true)

  if (!file?.buffer || !utils.isChallengeEnabled(challenges.deprecatedInterfaceChallenge)) {
    res.status(410)
    next(new Error('B2B customer complaints via file upload have been deprecated for security reasons (' + file?.originalname + ')'))
    return
  }

  const data = file.buffer.toString()

  try {
    const sandbox = { libxml, data }
    vm.createContext(sandbox)

    // secure: no external entity expansion
    const xmlDoc = vm.runInContext(
      'libxml.parseXml(data, { noblanks: true, nocdata: true })',
      sandbox,
      { timeout: 2000 }
    )

    const xmlString = xmlDoc.toString(false)

    challengeUtils.solveIf(
      challenges.xxeFileDisclosureChallenge,
      () => false // Disabled because XXE is fully prevented
    )

    res.status(410)
    next(
      new Error(
        'B2B customer complaints via file upload have been deprecated for security reasons: ' +
        utils.trunc(xmlString, 400) + ' (' + file.originalname + ')'
      )
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)

    if (utils.contains(msg, 'Script execution timed out')) {
      if (challengeUtils.notSolved(challenges.xxeDosChallenge)) {
        challengeUtils.solve(challenges.xxeDosChallenge)
      }
      res.status(503)
      next(new Error('Sorry, we are temporarily not available! Please try again later.'))
      return
    }

    res.status(410)
    next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + msg + ' (' + file.originalname + ')'))
  }
}

/* -------------------------------------------------------------------------- */
/*                                YAML HANDLER                                 */
/* -------------------------------------------------------------------------- */

function handleYamlUpload ({ file }: Request, res: Response, next: NextFunction) {
  if (
    !utils.endsWith(file?.originalname.toLowerCase(), '.yml') &&
    !utils.endsWith(file?.originalname.toLowerCase(), '.yaml')
  ) {
    res.status(204).end()
    return
  }

  challengeUtils.solveIf(challenges.deprecatedInterfaceChallenge, () => true)

  if (!file?.buffer || !utils.isChallengeEnabled(challenges.deprecatedInterfaceChallenge)) {
    res.status(410)
    next(new Error('B2B customer complaints via file upload have been deprecated for security reasons (' + file?.originalname + ')'))
    return
  }

  const data = file.buffer.toString()

  try {
    const sandbox = { yaml, data }
    vm.createContext(sandbox)

    const yamlString = vm.runInContext(
      'JSON.stringify(yaml.load(data))',
      sandbox,
      { timeout: 2000 }
    )

    res.status(410)
    next(
      new Error(
        'B2B customer complaints via file upload have been deprecated for security reasons: ' +
        utils.trunc(yamlString, 400) + ' (' + file.originalname + ')'
      )
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)

    if (
      utils.contains(msg, 'Invalid string length') ||
      utils.contains(msg, 'Script execution timed out')
    ) {
      if (challengeUtils.notSolved(challenges.yamlBombChallenge)) {
        challengeUtils.solve(challenges.yamlBombChallenge)
      }
      res.status(503)
      next(new Error('Sorry, we are temporarily not available! Please try again later.'))
      return
    }

    res.status(410)
    next(
      new Error(
        'B2B customer complaints via file upload have been deprecated for security reasons: ' +
        msg + ' (' + file.originalname + ')'
      )
    )
  }
}

/* -------------------------------------------------------------------------- */
/*                                  EXPORTS                                    */
/* -------------------------------------------------------------------------- */

export {
  ensureFileIsPassed,
  handleZipFileUpload,
  checkUploadSize,
  checkFileType,
  handleXmlUpload,
  handleYamlUpload
}