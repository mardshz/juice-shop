/*
 * Copyright ...
 * SPDX-License-Identifier: MIT
 */

'use strict'

module.exports = function (grunt) {
  const os = grunt.option('os') || process.env.PCKG_OS_NAME || ''
  const platform = grunt.option('platform') || process.env.PCKG_CPU_ARCH || ''
  const node = grunt.option('node') || process.env.nodejs_version || process.env.PCKG_NODE_VERSION || ''

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    replace_json: {
      manifest: {
        src: 'package.json',
        changes: {
          'engines.node': (node || '<%= pkg.engines.node %>'),
          os: (os ? [os] : '<%= pkg.os %>'),
          cpu: (platform ? [platform] : '<%= pkg.cpu %>')
        }
      }
    },

    compress: {
      pckg: {
        options: {
          mode: os === 'linux' ? 'tgz' : 'zip',
          archive:
            'dist/<%= pkg.name %>-<%= pkg.version %>' +
            (node ? ('_node' + node) : '') +
            (os ? ('_' + os) : '') +
            (platform ? ('_' + platform) : '') +
            (os === 'linux' ? '.tgz' : '.zip')
        },
        files: [
          {
            src: [
              '.well-known/**',
              'LICENSE',
              '*.md',
              'package.json',
              'ctf.key',
              'swagger.yml',
              'server.ts',
              'config.schema.yml',
              'build/**',
              '!build/reports/**',
              'bom.json',
              'bom.xml',
              'config/*.yml',
              'data/*.ts',
              'data/static/**',
              'data/chatbot/.gitkeep',
              'encryptionkeys/**',
              'frontend/dist/frontend/**',
              'frontend/dist/bom/**',
              'frontend/src/**/*.ts',
              'ftp/**',
              'i18n/.gitkeep',
              'lib/**',
              'models/*.ts',
              'node_modules/**',
              'routes/*.ts',
              'uploads/complaints/.gitkeep',
              'views/**'
            ],
            dest: 'juice-shop_<%= pkg.version %>/'
          }
        ]
      }
    }
  })

  /*
   * SECURE CHECKSUM TASK
   * - Sanitizes filenames
   * - Normalizes full paths
   * - Verifies distDir boundary
   * - Fully Codacy-compliant
   */

  grunt.registerTask('checksum', 'Create .md5 checksum files', function () {
    const fs = require('node:fs')
    const crypto = require('node:crypto')
    const path = require('node:path')

    const distDir = path.resolve('dist')

    fs.readdirSync(distDir).forEach((file) => {
      // Sanitize the filename (prevents accidental traversal)
      const safeFilename = path.basename(file)

      // Construct target file path safely
      const filePath = path.join(distDir, safeFilename)
      const normalizedFilePath = path.normalize(filePath)

      // Ensure this is STILL inside dist/
      if (!normalizedFilePath.startsWith(distDir)) {
        grunt.log.warn(`Skipping invalid path: ${normalizedFilePath}`)
        return
      }

      const buffer = fs.readFileSync(normalizedFilePath)
      const md5Hash = crypto.createHash('md5').update(buffer).digest('hex')

      // Construct .md5 filename safely
      const md5SafeName = safeFilename + '.md5'
      const md5FilePath = path.join(distDir, md5SafeName)
      const normalizedMd5FilePath = path.normalize(md5FilePath)

      if (!normalizedMd5FilePath.startsWith(distDir)) {
        grunt.log.warn(`Skipping invalid output path: ${normalizedMd5FilePath}`)
        return
      }

      grunt.file.write(normalizedMd5FilePath, md5Hash)

      grunt.log
        .write(`Checksum ${md5Hash} written to file ${normalizedMd5FilePath}.`)
        .verbose.write('...')
        .ok()

      grunt.log.writeln()
    })
  })

  grunt.loadNpmTasks('grunt-replace-json')
  grunt.loadNpmTasks('grunt-contrib-compress')
  grunt.registerTask('package', ['replace_json:manifest', 'compress:pckg', 'checksum'])
}