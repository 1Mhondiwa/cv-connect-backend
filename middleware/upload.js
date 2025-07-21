// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Ensure directories exist
fs.ensureDirSync('./uploads/cvs');
fs.ensureDirSync('./uploads/profile_images');

// Configure storage for CV uploads
const cvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/cvs');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'cv-' + uniqueSuffix + extension);
  }
});

// Configure storage for profile image uploads
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/profile_images');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + extension);
  }
});

// Filter for CV file types
const cvFileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.docx', '.doc', '.txt'];
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOCX, DOC, and TXT files are allowed.'), false);
  }
};

// Filter for image file types
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png'];
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, and PNG files are allowed.'), false);
  }
};

// Create multer instances
const uploadCV = multer({
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024 // Default 5MB
  }
});

const uploadProfileImage = multer({
  storage: profileImageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  }
});

module.exports = {
  uploadCV,
  uploadProfileImage
};