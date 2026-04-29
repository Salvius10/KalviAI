const fs = require('fs')
const path = require('path')
const Course = require('../models/Course.model')

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/materials')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}


const extractFilePaths = (files = []) => {
  const filePaths = {}

  if (Array.isArray(files)) {
    files.forEach((file) => {
      const field = file?.fieldname || ''
      if (field.startsWith('material_') && field.endsWith('_file')) {
        const index = field.split('_')[1]
        if (typeof index !== 'undefined') {
          filePaths[index] = file.path
        }
      }
    })
    return filePaths
  }

  Object.keys(files || {}).forEach((key) => {
    if (key.startsWith('material_') && key.endsWith('_file') && Array.isArray(files[key]) && files[key][0]?.path) {
      const index = key.split('_')[1]
      filePaths[index] = files[key][0].path
    }
  })
  return filePaths
}

const parseMaterialsFromBody = (body = {}) => {
  if (typeof body.materialsMetadata === 'string' && body.materialsMetadata.trim()) {
    return JSON.parse(body.materialsMetadata)
  }

  if (Array.isArray(body.materials)) {
    return body.materials
  }

  return null
}

/**
 * Clean up orphaned files after update (files no longer referenced)
 */
const cleanupOldFiles = (oldMaterials = [], newMaterials = []) => {
  const newFiles = newMaterials
    .filter((m) => m.fileUrl)
    .map((m) => m.fileUrl)

  oldMaterials.forEach((m) => {
    if (m.fileUrl && !newFiles.includes(m.fileUrl)) {
      const filePath = path.join(__dirname, '../', m.fileUrl)
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
          console.log(`Deleted orphaned file: ${filePath}`)
        } catch (err) {
          console.error(`Failed to delete file ${filePath}:`, err)
        }
      }
    }
  })
}

/**
 * CREATE course handler
 */
const createCourse = async (req, res) => {
  try {
    const { title, description, isPublished } = req.body
    const filePaths = extractFilePaths(req.files)

    // Parse materials metadata
    let materials = []
    const parsedMaterials = parseMaterialsFromBody(req.body)
    if (Array.isArray(parsedMaterials)) {
      materials = parsedMaterials.map((m, index) => {
        const filePath = filePaths[index]
        return {
          title: m?.title || '',
          type: m?.type || 'text',
          url: m?.url || '',
          content: m?.content || '',
          fileUrl: filePath ? `/uploads/materials/${path.basename(filePath)}` : '',
        }
      })
    }

    const course = await Course.create({
      title,
      description,
      isPublished: isPublished === 'true',
      materials,
      teacher: req.user.id,
    })

    res.status(201).json(course)
  } catch (err) {
    console.error('Create course error:', err)
    res.status(400).json({ message: err.message })
  }
}

/**
 * UPDATE course handler
 */
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params
    const filePaths = extractFilePaths(req.files)

    // Get current course to clean up old files
    const currentCourse = await Course.findById(id)
    if (!currentCourse) {
      return res.status(404).json({ message: 'Course not found' })
    }

    const updateDoc = {}

    if (typeof req.body.title !== 'undefined') {
      updateDoc.title = req.body.title
    }
    if (typeof req.body.description !== 'undefined') {
      updateDoc.description = req.body.description
    }
    if (typeof req.body.isPublished !== 'undefined') {
      updateDoc.isPublished =
        req.body.isPublished === true || req.body.isPublished === 'true'
    }

    const parsedMaterials = parseMaterialsFromBody(req.body)
    if (Array.isArray(parsedMaterials)) {
      const oldMaterials = currentCourse.materials || []
      const materials = parsedMaterials.map((m, index) => {
        const filePath = filePaths[index]
        const existing = oldMaterials[index]

        return {
          title: m?.title || '',
          type: m?.type || 'text',
          url: m?.url || '',
          content: m?.content || '',
          fileUrl:
            filePath
              ? `/uploads/materials/${path.basename(filePath)}`
              : (m?.fileUrl || existing?.fileUrl || ''),
        }
      })

      // Clean up files that are no longer referenced
      cleanupOldFiles(oldMaterials, materials)
      updateDoc.materials = materials
    }

    const course = await Course.findByIdAndUpdate(id, updateDoc, { new: true })

    res.json(course)
  } catch (err) {
    console.error('Update course error:', err)
    res.status(400).json({ message: err.message })
  }
}

module.exports = {
  createCourse,
  updateCourse,
}
