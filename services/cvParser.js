// services/cvParser.js
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const nlp = require('compromise');
const mammoth = require('mammoth');

class CVParser {
  
    // Dynamic section end detection - more flexible approach
    static getDynamicEndSections(sectionType) {
      const commonEndSections = [
        'references', 'contact', 'personal', 'additional', 'other', 'miscellaneous'
      ];
      
      switch (sectionType) {
        case 'work':
          return ['education', 'academic', 'qualifications', 'skills', 'projects', ...commonEndSections];
        case 'education':
          return ['work experience', 'experience', 'employment', 'skills', 'projects', ...commonEndSections];
        case 'skills':
          return ['education', 'work experience', 'experience', 'projects', ...commonEndSections];
        default:
          return commonEndSections;
      }
    }
}