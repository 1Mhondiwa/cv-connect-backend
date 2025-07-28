// services/cvParser.js
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const nlp = require('compromise');
const mammoth = require('mammoth'); 

class CVParser {
// Enhanced extractText method with improved DOCX/DOC support
async extractText(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }
    const extension = path.extname(filePath).toLowerCase();
    let text = '';
   
    if (extension === '.pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer, {
          // Simplified PDF parsing options
          max: 0, // No page limit
          version: 'v1.10.100'
        });
        text = pdfData.text || '';
       
        // Enhanced PDF text cleaning
        text = this.cleanPdfText(text);
       
        // Debug: Log extracted text length
        console.log(`PDF text extracted: ${text.length} characters`);
        console.log(`First 500 characters: ${text.substring(0, 500)}`);
       
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError);
        throw new Error("PDF parsing failed. Please check the file format.");
      }
    } else if (extension === '.txt') {
      text = fs.readFileSync(filePath, 'utf8');
      
      // Clean TXT text similar to other formats
      text = this.cleanTxtText(text);
      
      // Debug: Log extracted text length
      console.log(`TXT text extracted: ${text.length} characters`);
      console.log(`First 500 characters: ${text.substring(0, 500)}`);
      
    } else if (extension === '.docx') {
      try {
        const dataBuffer = fs.readFileSync(filePath);
        
        // Try mammoth first with better options
        const result = await mammoth.extractRawText({ 
          buffer: dataBuffer,
          // Better options for preserving structure
          convertImage: mammoth.images.ignoreElement,
          styleMap: []
        });
        
        text = result.value || '';
        
        // Enhanced DOCX text cleaning
        text = this.cleanDocxText(text);
        
        // Debug: Log extracted text length
        console.log(`DOCX text extracted: ${text.length} characters`);
        console.log(`First 500 characters: ${text.substring(0, 500)}`);
        
        // Log any messages from mammoth (warnings, etc.)
        if (result.messages && result.messages.length > 0) {
          console.log('Mammoth messages:', result.messages);
        }
        
      } catch (docxError) {
        console.error('DOCX parsing error:', docxError);
        throw new Error("DOCX parsing failed. Please check the file format.");
      }
    } else if (extension === '.doc') {
      // Add DOC support using textract or antiword
      try {
        // Option 1: Using textract (requires installation: npm install textract)
        const textract = require('textract');
        text = await new Promise((resolve, reject) => {
          textract.fromFileWithPath(filePath, (error, extractedText) => {
            if (error) {
              reject(error);
            } else {
              resolve(extractedText || '');
            }
          });
        });
        
        // Clean DOC text
        text = this.cleanDocText(text);
        
        console.log(`DOC text extracted: ${text.length} characters`);
        console.log(`First 500 characters: ${text.substring(0, 500)}`);
        
      } catch (docError) {
        console.error('DOC parsing error:', docError);
        throw new Error("DOC parsing failed. Please install textract or convert to DOCX format.");
      }
    } else {
      throw new Error("Unsupported file format. Please upload a PDF, DOCX, DOC, or TXT file.");
    }
   
    if (!text || text.trim().length === 0) {
      throw new Error("No text content could be extracted from the file.");
    }
   
    return text;
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}

// Enhanced cleanPdfText method
cleanPdfText(text) {
  if (!text) return '';
  // PDF text often has scattered formatting, so we need aggressive cleaning
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  // Remove page numbers and common headers/footers
  text = text.replace(/\n?Page \d+( of \d+)?\n?/gi, '\n');
  text = text.replace(/\n?Curriculum Vitae\n?/gi, '\n');
  // Normalize bullet points and numbered lists
  text = text.replace(/[•\*\u2022\u25AA\u25CF\u25CB\u25A0\u25B2\u25B6\u25C6\u25C7\u25A1\u25B3\u25B7\u25C7\u25A3\u25A4\u25A5\u25A6\u25A7\u25A8\u25A9\u25AA\u25AB\u25AC\u25AD\u25AE\u25AF\u25B0\u25B1\u25B2\u25B3\u25B4\u25B5\u25B6\u25B7\u25B8\u25B9\u25BA\u25BB\u25BC\u25BD\u25BE\u25BF\u25C0\u25C1\u25C2\u25C3\u25C4\u25C5\u25C6\u25C7\u25C8\u25C9\u25CA\u25CB\u25CC\u25CD\u25CE\u25CF\u25D0\u25D1\u25D2\u25D3\u25D4\u25D5\u25D6\u25D7\u25D8\u25D9\u25DA\u25DB\u25DC\u25DD\u25DE\u25DF\u25E0\u25E1\u25E2\u25E3\u25E4\u25E5\u25E6\u25E7\u25E8\u25E9\u25EA\u25EB\u25EC\u25ED\u25EE\u25EF]/g, '•');
  text = text.replace(/\n\s*\d+\./g, '\n•');
  // Remove excessive newlines but preserve paragraph breaks
  text = text.replace(/\n{3,}/g, '\n\n');
  // Clean up each line
  text = text.split('\n').map(line => {
    line = line.trim();
    if (line.length <= 1 || /^[^\w\s]*$/.test(line)) {
      return '';
    }
    return line;
  }).join('\n');
  text = text.replace(/^\n+/, '').replace(/\n+$/, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text;
}

// Enhanced cleanTxtText method
cleanTxtText(text) {
  if (!text) return '';
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n?Page \d+( of \d+)?\n?/gi, '\n');
  text = text.replace(/\n?Curriculum Vitae\n?/gi, '\n');
  text = text.replace(/[•\*]/g, '•');
  text = text.replace(/\n\s*\d+\./g, '\n•');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.split('\n').map(line => line.trim()).join('\n');
  text = text.trim();
  return text;
}

// Enhanced cleanDocxText method
cleanDocxText(text) {
  if (!text) return '';
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n?Page \d+( of \d+)?\n?/gi, '\n');
  text = text.replace(/\n?Curriculum Vitae\n?/gi, '\n');
  text = text.replace(/[•\*]/g, '•');
  text = text.replace(/\n\s*\d+\./g, '\n•');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.split('\n').map(line => line.trim()).join('\n');
  text = text.trim();
  return text;
}

// Enhanced cleanDocText method
cleanDocText(text) {
  if (!text) return '';
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n?Page \d+( of \d+)?\n?/gi, '\n');
  text = text.replace(/\n?Curriculum Vitae\n?/gi, '\n');
  text = text.replace(/[•\*]/g, '•');
  text = text.replace(/\n\s*\d+\./g, '\n•');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.split('\n').map(line => line.trim()).join('\n');
  text = text.trim();
  return text;
}

  // Extract contact information with improved regex patterns
  extractContactInfo(text) {
    if (!text || typeof text !== 'string') {
      return {
        email: null,
        phone: null,
        linkedin_url: null,
        github_url: null
      };
    }

    const contactInfo = {};
    
    // Extract email - more flexible pattern
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex);
    contactInfo.email = emails && emails.length > 0 ? emails[0] : null;
    
    // Extract phone numbers - more comprehensive patterns
    const phonePatterns = [
      /\+?[\d\s\-\(\)]{10,}/g,
      /\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}/g,
      /\d{3}[\s\-]\d{3}[\s\-]\d{4}/g,
      /\d{10}/g
    ];
    
    for (const pattern of phonePatterns) {
      const phones = text.match(pattern);
      if (phones && phones.length > 0) {
        // Clean up the phone number
        const phone = phones[0].replace(/[^\d\+]/g, '');
        if (phone.length >= 10) {
          contactInfo.phone = phones[0];
          break;
        }
      }
    }
    
    // Extract LinkedIn URL - more flexible
    const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in\/|profile\/view\?id=)[a-zA-Z0-9_-]+/gi;
    const linkedin = text.match(linkedinRegex);
    if (linkedin && linkedin.length > 0) {
      contactInfo.linkedin_url = linkedin[0].startsWith('http') ? linkedin[0] : 'https://' + linkedin[0];
    }
    
    // Extract GitHub URL - more flexible
    const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/gi;
    const github = text.match(githubRegex);
    if (github && github.length > 0) {
      contactInfo.github_url = github[0].startsWith('http') ? github[0] : 'https://' + github[0];
    }
    
    return contactInfo;
  }

  // Extract skills with more comprehensive matching
  extractSkills(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
  
    const skills = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Find skills section - expanded keywords
    let skillsStartIndex = -1;
    let skillsEndIndex = lines.length;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      // Updated skills section detection - more comprehensive keywords
const skillsKeywords = [
  'skills', 'technical skills', 'technologies', 'technical expertise',
  'competencies', 'expertise', 'proficiencies', 'technical knowledge',
  'programming languages', 'languages', 'tools', 'software',
  'technical abilities', 'capabilities', 'qualifications',
  // Added non-IT keywords
  'core competencies', 'professional skills', 'key skills',
  'specialized skills', 'trade skills', 'clinical skills',
  'medical skills', 'surgical skills', 'diagnostic skills',
  'construction skills', 'electrical skills', 'plumbing skills',
  'mechanical skills', 'engineering skills', 'design skills',
  'management skills', 'leadership skills', 'communication skills',
  'analytical skills', 'problem-solving skills', 'organizational skills',
  'areas of expertise', 'specializations', 'core strengths',
  'professional competencies', 'technical competencies',
  'skill set', 'skillset', 'abilities', 'knowledge areas'
];
      
      if (skillsKeywords.some(keyword => line.includes(keyword))) {
        skillsStartIndex = i;
        break;
      }
    }
    
    // Find where skills section ends - expanded end sections
    if (skillsStartIndex !== -1) {
      const endSections = [
        'education', 'academic', 'qualification', 'work experience', 
        'experience', 'employment', 'projects', 'certifications',
        'awards', 'achievements', 'interests', 'hobbies', 'languages',
        'references', 'contact', 'personal', 'volunteer', 'activities'
      ];
      for (let i = skillsStartIndex + 1; i < lines.length; i++) {
        const line = lines[i].toLowerCase().trim();
        if (endSections.some(section => line.includes(section))) {
          skillsEndIndex = i;
          break;
        }
      }
    }
    
    if (skillsStartIndex === -1) {
      // Fallback: Try keyword-based extraction throughout the document
      return this.extractSkillsFallback(text);
    }
    
    const skillsLines = lines.slice(skillsStartIndex + 1, skillsEndIndex);
    
    // Parse skills from the actual CV format - multiple patterns
    for (const line of skillsLines) {
      const trimmedLine = line.trim();
      
      // Skip separator lines
      if (trimmedLine.includes('---') || trimmedLine.includes('===') || trimmedLine.length === 0) {
        continue;
      }
      
      // Pattern 1: "JavaScript - Expert - 6 years"
      const skillPattern1 = /^([A-Za-z\s\.#\+\-]+?)\s*-\s*(Expert|Advanced|Intermediate|Beginner)\s*-\s*(\d+)\s*years?/i;
      const match1 = trimmedLine.match(skillPattern1);
      
      if (match1) {
        const skillName = match1[1].trim();
        const proficiency = match1[2];
        const years = parseInt(match1[3]);
        
        skills.push({
          name: skillName,
          proficiency: proficiency,
          years_experience: years
        });
        continue;
      }
      
      // Pattern 2: "JavaScript, React, Node.js" (comma-separated)
      const skillPattern2 = /^([A-Za-z\s\.#\+\-]+(?:,\s*[A-Za-z\s\.#\+\-]+)*)$/i;
      const match2 = trimmedLine.match(skillPattern2);
      
      if (match2) {
        const skillNames = match2[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
        skillNames.forEach(skillName => {
          if (skillName.length > 1) {
            skills.push({
              name: skillName,
              proficiency: 'Intermediate',
              years_experience: 1
            });
          }
        });
        continue;
      }
      
      // Pattern 3: "• JavaScript • React • Node.js" (bullet-separated)
      const skillPattern3 = /^[•\-\*]\s*([A-Za-z\s\.#\+\-]+)(?:\s*[•\-\*]\s*[A-Za-z\s\.#\+\-]+)*$/i;
      const match3 = trimmedLine.match(skillPattern3);
      
      if (match3) {
        const skillNames = trimmedLine.split(/[•\-\*]/).map(s => s.trim()).filter(s => s.length > 0);
        skillNames.forEach(skillName => {
          if (skillName.length > 1) {
            skills.push({
              name: skillName,
              proficiency: 'Intermediate',
              years_experience: 1
            });
          }
        });
        continue;
      }
      
      // Pattern 4: Single skill on a line
      const skillPattern4 = /^([A-Za-z\s\.#\+\-]{2,50})$/i;
      const match4 = trimmedLine.match(skillPattern4);
      
      if (match4 && !trimmedLine.toLowerCase().includes('years') && !trimmedLine.toLowerCase().includes('experience')) {
        skills.push({
          name: trimmedLine,
          proficiency: 'Intermediate',
          years_experience: 1
        });
      }
    }
    
    // If no skills found in section, try fallback
    if (skills.length === 0) {
      return this.extractSkillsFallback(text);
    }
    
    return skills;
  }

  // Fallback skills extraction using keyword matching throughout the document
  extractSkillsFallback(text) {
    const skills = [];
    const commonSkills = [
      // Programming Languages
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'TypeScript',
      'HTML', 'CSS', 'SQL', 'R', 'MATLAB', 'Scala', 'Perl', 'Shell', 'Bash', 'PowerShell',
      // Frameworks & Libraries
      'React', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Django', 'Flask', 'Spring', 'Laravel', 'ASP.NET',
      'Bootstrap', 'jQuery', 'Redux', 'Vuex', 'GraphQL', 'REST API', 'MongoDB', 'MySQL', 'PostgreSQL',
      // Tools & Technologies
      'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'Jenkins', 'Jira', 'Confluence',
      'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Sketch', 'InVision', 'Zeplin',
      // Methodologies
      'Agile', 'Scrum', 'Kanban', 'DevOps', 'CI/CD', 'TDD', 'BDD', 'Waterfall',
      // Other Technical Skills
      'Machine Learning', 'Data Analysis', 'Statistics', 'Excel', 'Power BI', 'Tableau', 'SAS', 'SPSS'
    ];
    
    const lowerText = text.toLowerCase();
    
    for (const skill of commonSkills) {
      if (lowerText.includes(skill.toLowerCase())) {
        skills.push({
          name: skill,
          proficiency: 'Intermediate',
          years_experience: 1
        });
      }
    }
    
    return skills;
  }

  // Helper to extract context around a keyword
  extractContext(text, keyword, windowSize = 200) {
    if (!text || !keyword || typeof text !== 'string' || typeof keyword !== 'string') {
      return '';
    }

    const index = text.indexOf(keyword);
    if (index === -1) return '';
    
    const start = Math.max(0, index - windowSize);
    const end = Math.min(text.length, index + keyword.length + windowSize);
    
    return text.substring(start, end);
  }

  // Estimate years of experience for a skill
  estimateYearsExperience(context) {
    if (!context || typeof context !== 'string') {
      return 1;
    }

    const yearPatterns = [
      /(\d+)[\s\-\+]*(?:years?|yrs?)/gi,
      /(?:years?|yrs?)[\s\-\+]*(\d+)/gi,
      /(\d+)[\s\-\+]*(?:year|yr)\b/gi
    ];

    for (const pattern of yearPatterns) {
      const matches = [...context.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const years = parseInt(match[1]);
          if (years > 0 && years <= 30) {
            return years;
          }
        }
      }
    }
    
    return 1;
  }

// Enhanced extractName method with better pattern matching
extractName(text) {
  if (!text || typeof text !== 'string') {
    return { firstName: '', lastName: '' };
  }

  // Split into lines and clean them
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // Debug: Log first few lines to see what we're working with
  console.log('First 10 lines for name extraction:');
  lines.slice(0, 10).forEach((line, i) => console.log(`Line ${i}: "${line}"`));
  
  // Try first few lines for name (increased to 20 lines for PDFs)
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line.length === 0) continue;
    
    // More lenient exclusion patterns for PDFs and TXT files
    const exclusionPatterns = [
      /@/,                    // Email addresses
      /http[s]?:\/\//,        // URLs
      /www\./,                // Web addresses
      /\.(com|org|net|edu|gov|pdf|doc|docx|txt)/i, // Domain extensions and file extensions
      /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, // Phone numbers
      /^\d+$/, // Lines with only numbers
      /^(cv|resume|curriculum|vitae|portfolio)$/i, // CV/Resume headers
      /^(page\s*\d+|page\s*\d+\s*of\s*\d+)$/i, // Page numbers
      /^[-=_*#]{3,}$/, // Separator lines
      /^\s*$/, // Empty or whitespace only
      /^(summary|objective|profile|about|skills|education|experience|work|projects|certifications|languages|references|contact|personal|achievements|awards|publications|interests|hobbies|employment|career|professional|technical|additional|volunteer|activities|memberships)$/i,
      /^(phone|email|linkedin|github|address|location|mobile|tel|website|portfolio|city|state|country|zip|postal)$/i,
    ];
    
    const shouldSkip = exclusionPatterns.some(pattern => pattern.test(line));
    if (shouldSkip) {
      console.log(`Skipping line (exclusion pattern): "${line}"`);
      continue;
    }
    
    // Skip if line is too long (likely a paragraph) but be more lenient
    if (line.length > 100) {
      console.log(`Skipping line (too long): "${line}"`);
      continue;
    }
    
    // More lenient job title filtering - only skip if it's obviously a job title
    const obviousJobTitlePatterns = [
      /^(senior|junior|principal|lead|chief|head|vice|assistant|associate)\s+/i,
      /\b(developer|engineer|manager|analyst|designer|architect|consultant|specialist|coordinator|administrator|technician|programmer|scientist|director|supervisor)\b/i,
      /^(software|web|frontend|backend|fullstack|full-stack|data|cloud|devops|mobile|system|network|security|qa|test|project|product|technical|marketing|sales|operations|hr|finance|business|digital|it|information)\s+/i,
      /\b(intern|trainee|apprentice|contractor|freelance|consultant|employee|worker|professional|expert|specialist)$/i
    ];
    
    const lowerLine = line.toLowerCase();
    const isObviousJobTitle = obviousJobTitlePatterns.some(pattern => pattern.test(lowerLine));
    
    if (isObviousJobTitle) {
      console.log(`Skipping obvious job title: "${line}"`);
      continue;
    }
    
    // Enhanced name pattern matching
    const nameResult = this.extractNameFromLine(line);
    if (nameResult.firstName && nameResult.lastName) {
      console.log(`Found name on line ${i}: "${line}" -> First: "${nameResult.firstName}", Last: "${nameResult.lastName}"`);
      return nameResult;
    }
  }
  
  console.log('No name found in standard extraction, trying alternative methods...');
  
  // Alternative method: Look for patterns in the entire text
  const alternativeResult = this.extractNameAlternative(text);
  if (alternativeResult.firstName && alternativeResult.lastName) {
    return alternativeResult;
  }
  
  // Last resort: Try to find any two-word combination that looks like a name
  const lastResortResult = this.extractNameLastResort(text);
  if (lastResortResult.firstName && lastResortResult.lastName) {
    return lastResortResult;
  }
  
  console.log('No name found with any method');
  return { firstName: '', lastName: '' };
}

// Helper method to extract name from a single line
extractNameFromLine(line) {
  // Clean the line more aggressively
  let cleanLine = line.replace(/[^\w\s\-'\.]/g, ' ').trim();
  
  // Remove multiple spaces
  cleanLine = cleanLine.replace(/\s+/g, ' ');
  
  // Enhanced name patterns with more flexibility
  const namePatterns = [
    // All caps name (JOHN SMITH, JOHN A. SMITH)
    /^([A-Z]{2,}(?:\s+[A-Z]\.?\s*)?(?:\s+[A-Z]{2,})+)\s*$/,
    // Proper case name (John Smith, John A. Smith, John A Smith)
    /^([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?(?:\s+[A-Z][a-z]+)+)\s*$/,
    // Mixed case with common variations (more flexible)
    /^([A-Za-z]{2,}(?:\s+[A-Za-z]\.?\s*)?(?:\s+[A-Za-z]{2,})+)\s*$/,
    // Handle names with hyphens or apostrophes (O'Connor, Mary-Jane)
    /^([A-Za-z]{2,}(?:[-']?[A-Za-z]+)*(?:\s+[A-Za-z]\.?\s*)?(?:\s+[A-Za-z]{2,}(?:[-']?[A-Za-z]+)*)+)\s*$/,
    // Handle names that might have numbers or special chars mixed in (from PDF extraction issues)
    /([A-Za-z]{2,}(?:\s+[A-Za-z]\.?\s*)?(?:\s+[A-Za-z]{2,})+)/
  ];
  
  for (const pattern of namePatterns) {
    const match = cleanLine.match(pattern);
    if (match) {
      const fullName = match[1].trim();
      
      // More lenient validation for name length and structure
      if (fullName.length >= 3 && fullName.length <= 80) {
        const nameParts = fullName.split(/\s+/).filter(part => part.length > 0);
        
        // Should have at least 2 parts
        if (nameParts.length >= 2) {
          // Additional validation: check if it looks like a real name
          const tooManyNumbers = (fullName.match(/\d/g) || []).length > 2;
          const tooManySpecialChars = (fullName.match(/[^a-zA-Z\s\-'\.]/g) || []).length > 2;
          
          if (!tooManyNumbers && !tooManySpecialChars) {
            // Convert to proper case
            const properCaseName = nameParts.map(part => {
              if (part.length <= 2 && part.endsWith('.')) {
                // Handle initials (A., B.)
                return part.toUpperCase();
              } else if (part.length === 1) {
                // Handle single letter initials
                return part.toUpperCase();
              } else {
                // Handle regular names, preserving hyphens and apostrophes
                return part.replace(/\b\w/g, char => char.toUpperCase())
                          .replace(/\b\w+/g, word => 
                            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                          );
              }
            });
            
            return {
              firstName: properCaseName[0],
              lastName: properCaseName.slice(1).join(' ')
            };
          }
        }
      }
    }
  }
  
  return { firstName: '', lastName: '' };
}

// Alternative extraction method using regex on entire text
extractNameAlternative(text) {
  // Look for common name patterns in the document
  const fullText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  // Pattern to find "Name: John Smith" or similar
  const nameFieldPatterns = [
    /(?:name|full\s*name|candidate|applicant|person|individual):\s*([A-Za-z\s\.'-]{3,60})/i,
    /^([A-Z][a-z]+\s+[A-Z][a-z]+)/m, // First occurrence of proper case name
    /(?:^|\n)\s*([A-Z][A-Z\s]+[A-Z])\s*(?:\n|$)/m, // All caps name on its own line
    /(?:^|\n)\s*([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?(?:\s+[A-Z][a-z]+)+)\s*(?:\n|$)/m, // Proper case name on its own line
  ];
  
  for (const pattern of nameFieldPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      const nameCandidate = match[1].trim();
      const nameResult = this.extractNameFromLine(nameCandidate);
      if (nameResult.firstName && nameResult.lastName) {
        console.log(`Alternative extraction found: "${nameCandidate}"`);
        return nameResult;
      }
    }
  }
  
  return { firstName: '', lastName: '' };
}

// Last resort extraction method
extractNameLastResort(text) {
  console.log('Attempting last resort name extraction...');
  
  // Split text into words and look for potential name combinations
  const words = text.split(/\s+/)
    .map(word => word.replace(/[^\w\-']/g, '').trim())
    .filter(word => word.length >= 2 && word.length <= 30)
    .filter(word => /^[A-Za-z]/.test(word)); // Must start with a letter
  
  // Look for two consecutive words that could be names
  for (let i = 0; i < words.length - 1; i++) {
    const word1 = words[i];
    const word2 = words[i + 1];
    
    // Check if both words look like names
    if (this.looksLikeName(word1) && this.looksLikeName(word2)) {
      // Make sure they're not common words that appear in resumes
      const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'under', 'over', 'upon', 'across', 'around', 'behind', 'beside', 'beyond', 'inside', 'outside', 'throughout', 'underneath', 'work', 'experience', 'education', 'skills', 'summary', 'contact', 'phone', 'email', 'address', 'city', 'state', 'country', 'years', 'months', 'days', 'time', 'company', 'job', 'position', 'role', 'project', 'team', 'management', 'development', 'software', 'technical', 'business', 'professional', 'career', 'employment'];
      
      if (!commonWords.includes(word1.toLowerCase()) && !commonWords.includes(word2.toLowerCase())) {
        console.log(`Last resort found potential name: "${word1} ${word2}"`);
        return {
          firstName: word1.charAt(0).toUpperCase() + word1.slice(1).toLowerCase(),
          lastName: word2.charAt(0).toUpperCase() + word2.slice(1).toLowerCase()
        };
      }
    }
  }
  
  return { firstName: '', lastName: '' };
}

// Helper method to check if a word looks like a name
looksLikeName(word) {
  // Should be 2-30 characters, start with capital, contain only letters, hyphens, and apostrophes
  return word.length >= 2 && 
         word.length <= 30 && 
         /^[A-Z][a-zA-Z\-']*$/.test(word) &&
         !/^\d/.test(word); // Shouldn't start with a number
}

  // Extract education with improved parsing
  extractEducation(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
  
    const education = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Find education section - expanded keywords
    let educationStartIndex = -1;
    let educationEndIndex = lines.length;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const educationKeywords = [
        'education', 'academic', 'qualification', 'school', 'university',
        'college', 'institute', 'degree', 'certificate', 'diploma',
        'masters', 'phd', 'doctorate', 'mba', 'bachelor', 'associate',
        'high school', 'secondary school', 'elementary school'
      ];
      
      if (educationKeywords.some(keyword => line.includes(keyword))) {
        educationStartIndex = i;
        break;
      }
    }
    
    // Find where education section ends - expanded end sections
    if (educationStartIndex !== -1) {
      const endSections = [
        'work experience', 'experience', 'employment', 'projects', 'skills',
        'certifications', 'awards', 'interests', 'hobbies', 'languages',
        'references', 'contact', 'personal', 'volunteer', 'activities'
      ];
      for (let i = educationStartIndex + 1; i < lines.length; i++) {
        const line = lines[i].toLowerCase().trim();
        if (endSections.some(section => line.includes(section))) {
          educationEndIndex = i;
          break;
        }
      }
    }
    
    if (educationStartIndex === -1) {
      // Fallback: Try keyword-based extraction throughout the document
      return this.extractEducationFallback(text);
    }
    
    const educationLines = lines.slice(educationStartIndex + 1, educationEndIndex);
    
    let currentEducation = null;
    
    for (const line of educationLines) {
      const trimmedLine = line.trim();
      
      // Skip separator lines
      if (trimmedLine.includes('---') || trimmedLine.includes('===') || trimmedLine.length === 0) {
        continue;
      }
      
      // Check if this line is a degree - expanded patterns
      const degreePatterns = [
        // Standard US/UK degrees
        /^(Bachelor|B\.?A\.?|B\.?S\.?|B\.?Sc\.?|B\.?Tech\.?|B\.?E\.?|B\.?Eng\.?|B\.?Comm\.?|B\.?Bus\.?|B\.?Admin\.?)\s+(?:of\s+|in\s+)?(.+)$/i,
        /^(Master|M\.?A\.?|M\.?S\.?|M\.?Sc\.?|M\.?Tech\.?|M\.?E\.?|M\.?Eng\.?|M\.?Comm\.?|M\.?Bus\.?|M\.?Admin\.?)\s+(?:of\s+|in\s+)?(.+)$/i,
        /^(MBA|M\.?B\.?A\.?|Master\s+of\s+Business\s+Administration)\s+(?:in\s+)?(.+)?$/i,
        /^(Ph\.?D\.?|PhD|Doctorate|Doctor|D\.?Phil\.?)\s+(?:in\s+)?(.+)?$/i,
        /^(Associate|A\.?A\.?|A\.?S\.?|A\.?Sc\.?|A\.?Tech\.?|A\.?E\.?)\s+(?:of\s+|in\s+)?(.+)$/i,
        // International degrees
        /^(BSc|BA|BEng|BTech|MSc|MA|MEng|MTech|Diploma|Certificate|Certification)\s+(?:in\s+)?(.+)?$/i,
        // Diploma and certificate patterns
        /^(Diploma|Certificate|Certification|Advanced\s+Diploma|Postgraduate\s+Diploma)\s+(?:in\s+)?(.+)$/i,
        // High school and secondary education
        /^(High\s+School|Secondary\s+School|Secondary\s+Education|GED|GCSE|A-Level|IB|International\s+Baccalaureate)\s+(?:in\s+)?(.+)?$/i,
        // Professional certifications
        /^(Professional\s+Certification|Professional\s+Certificate|Industry\s+Certification)\s+(?:in\s+)?(.+)$/i,
        // Generic degree patterns
        /^([A-Z][a-z]+)\s+(?:Degree|Program|Course)\s+(?:in\s+)?(.+)$/i
      ];
      
      for (const pattern of degreePatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          // Save previous education if exists
          if (currentEducation) {
            education.push(currentEducation);
          }
          
          // Start new education entry
          currentEducation = {
            degree: match[0].trim(),
            field: match[2] ? match[2].trim() : '',
            institution: null,
            year: null
          };
          break;
        }
      }
      
      // If we have a current education entry, look for institution and year
      if (currentEducation) {
        // Check if this line is an institution
        const institutionPatterns = [
          /^([A-Z][^-\d]*(?:University|College|Institute|School|Academy)[^-\d]*)\s*-?\s*(\d{4})?$/i,
          /^([A-Z][A-Za-z\s&,.-]+)\s*-?\s*(\d{4})?$/
        ];
        
        for (const pattern of institutionPatterns) {
          const match = trimmedLine.match(pattern);
          if (match && !currentEducation.institution) {
            currentEducation.institution = match[1].trim();
            if (match[2]) {
              currentEducation.year = parseInt(match[2]);
            }
            break;
          }
        }
        
        // Look for standalone year
        if (!currentEducation.year) {
          const yearMatch = trimmedLine.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            currentEducation.year = parseInt(yearMatch[0]);
          }
        }
      }
    }
    
    // Add the last education entry
    if (currentEducation) {
      education.push(currentEducation);
    }
    
    // If no education found in section, try fallback
    if (education.length === 0) {
      return this.extractEducationFallback(text);
    }
    
    return education;
  }

  // Fallback education extraction using keyword matching throughout the document
  extractEducationFallback(text) {
    const education = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Look for degree patterns throughout the document
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for degree patterns
      const degreePatterns = [
        /(Bachelor|B\.?A\.?|B\.?S\.?|B\.?Sc\.?|B\.?Tech\.?|B\.?E\.?|B\.?Eng\.?|B\.?Comm\.?|B\.?Bus\.?|B\.?Admin\.?)\s+(?:of\s+|in\s+)?([A-Za-z\s]+)/i,
        /(Master|M\.?A\.?|M\.?S\.?|M\.?Sc\.?|M\.?Tech\.?|M\.?E\.?|M\.?Eng\.?|M\.?Comm\.?|M\.?Bus\.?|M\.?Admin\.?)\s+(?:of\s+|in\s+)?([A-Za-z\s]+)/i,
        /(MBA|M\.?B\.?A\.?|Master\s+of\s+Business\s+Administration)/i,
        /(Ph\.?D\.?|PhD|Doctorate|Doctor|D\.?Phil\.?)/i,
        /(Associate|A\.?A\.?|A\.?S\.?|A\.?Sc\.?|A\.?Tech\.?|A\.?E\.?)\s+(?:of\s+|in\s+)?([A-Za-z\s]+)/i,
        /(BSc|BA|BEng|BTech|MSc|MA|MEng|MTech|Diploma|Certificate|Certification)/i,
        /(High\s+School|Secondary\s+School|Secondary\s+Education|GED|GCSE|A-Level|IB|International\s+Baccalaureate)/i
      ];
      
      for (const pattern of degreePatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          const degree = match[0].trim();
          const field = match[2] ? match[2].trim() : '';
          
          // Look for institution in nearby lines
          let institution = null;
          const lineIndex = lines.indexOf(line);
          for (let i = Math.max(0, lineIndex - 2); i <= Math.min(lines.length - 1, lineIndex + 2); i++) {
            const nearbyLine = lines[i].trim();
            if (nearbyLine.includes('University') || nearbyLine.includes('College') || nearbyLine.includes('Institute') || nearbyLine.includes('School')) {
              institution = nearbyLine;
              break;
            }
          }
          
          // Look for year
          let year = null;
          const yearMatch = trimmedLine.match(/\b(19|20)\d{2}\b/);
          if (yearMatch) {
            year = parseInt(yearMatch[0]);
          }
          
          education.push({
            degree: degree,
            field: field,
            institution: institution,
            year: year
          });
          break;
        }
      }
    }
    
    return education;
  }


  // Find section end
  findSectionEnd(text, startIndex) {
    const sectionKeywords = ['experience', 'work', 'employment', 'skills', 'projects', 'certifications', 'references'];
    let minIndex = text.length;
    
    for (const keyword of sectionKeywords) {
      const index = text.indexOf(keyword, startIndex + 50);
      if (index !== -1 && index < minIndex) {
        minIndex = index;
      }
    }
    
    return minIndex;
  }

  // Find institution name
  findInstitution(text, index) {
    if (!text || typeof index !== 'number') {
      return null;
    }

    const nearbyText = text.substring(Math.max(0, index - 150), Math.min(text.length, index + 300));
    const lines = nearbyText.split('\n');
    
    const institutionPatterns = [
      /(?:University|College|Institute|School|Academy)\s+of\s+([^,\n\r]+)/gi,
      /([^,\n\r]*)\s+(?:University|College|Institute|School|Academy)/gi,
      /([A-Z][^,\n\r]*(?:University|College|Institute|School|Academy)[^,\n\r]*)/gi
    ];
    
    for (const line of lines) {
      for (const pattern of institutionPatterns) {
        const match = line.match(pattern);
        if (match && match[0] && match[0].length > 5 && match[0].length < 100) {
          return match[0].trim();
        }
      }
    }
    
    return null;
  }

  // Find year with improved pattern
  findYear(text, index) {
    if (!text || typeof index !== 'number') {
      return null;
    }

    const nearbyText = text.substring(Math.max(0, index - 100), Math.min(text.length, index + 200));
    const currentYear = new Date().getFullYear();
    
    // Look for 4-digit years
    const yearMatches = nearbyText.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches) {
      const years = yearMatches
        .map(year => parseInt(year))
        .filter(year => year >= 1950 && year <= currentYear)
        .sort((a, b) => b - a);
      
      return years.length > 0 ? years[0] : null;
    }
    
    return null;
  }

  // Extract work experience
  extractWorkExperience(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
  
    const experiences = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Find the work experience section - expanded keywords
    let experienceStartIndex = -1;
    let experienceEndIndex = lines.length;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const experienceKeywords = [
        'work experience', 'experience', 'employment', 'job history',
        'professional experience', 'career history', 'employment history',
        'previous experience', 'past experience', 'previous employment'
      ];
      
      if (experienceKeywords.some(keyword => line.includes(keyword))) {
        experienceStartIndex = i;
        break;
      }
    }
    
    // Find where experience section ends - expanded end sections
    if (experienceStartIndex !== -1) {
      const endSections = [
        'projects', 'certifications', 'references', 'awards', 'interests',
        'hobbies', 'languages', 'contact', 'personal', 'volunteer', 'activities'
      ];
      for (let i = experienceStartIndex + 1; i < lines.length; i++) {
        const line = lines[i].toLowerCase().trim();
        if (endSections.some(section => line.includes(section))) {
          experienceEndIndex = i;
          break;
        }
      }
    }
    
    // If no experience section found, try fallback
    if (experienceStartIndex === -1) {
      return this.extractWorkExperienceFallback(text);
    }
    
    // Extract experience entries
    const experienceLines = lines.slice(experienceStartIndex + 1, experienceEndIndex);
    
    let currentExperience = null;
    let descriptionLines = [];
    
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      
      // Skip separator lines
      if (line.includes('---') || line.includes('===') || line.length === 0) {
        continue;
      }
      
      // Check if this line looks like a job title - expanded patterns
      const jobTitlePatterns = [
        // Technical roles
        /^(Senior|Lead|Principal|Junior|Associate|Staff|Chief)?\s*(Software|Web|Frontend|Backend|Full-stack|Data|Cloud|DevOps|Mobile|System|Network|Security|QA|Test)?\s*(Engineer|Developer|Architect|Designer|Analyst|Scientist|Manager|Consultant|Administrator|Specialist|Programmer|Technician)\s*$/i,
        /^(Project|Product|Technical|Engineering|Development|Marketing|Sales|Operations|HR|Finance)\s+(Manager|Director|Lead|Coordinator|Specialist)\s*$/i,
        // Business roles
        /^(Business|Marketing|Sales|Customer|Client|Account|Product|Project|Program|Operations|HR|Human\s*Resources|Finance|Financial|Administrative|Executive|Senior|Junior|Associate|Assistant)\s+(Manager|Director|Lead|Coordinator|Specialist|Analyst|Representative|Consultant|Advisor|Officer|Supervisor|Coordinator)\s*$/i,
        // Creative roles
        /^(Creative|Graphic|UI|UX|Visual|Digital|Content|Social\s*Media|Brand|Marketing|Communication)\s+(Designer|Manager|Specialist|Coordinator|Director|Lead|Consultant)\s*$/i,
        // Generic professional titles
        /^(Manager|Director|Lead|Coordinator|Specialist|Analyst|Representative|Consultant|Advisor|Officer|Supervisor|Coordinator|Assistant|Associate|Senior|Junior|Principal|Chief|Head|Vice)\s*$/i,
        // Industry-specific roles
        /^(Sales|Marketing|Business|Financial|Administrative|Executive|Creative|Technical|Professional|Senior|Junior|Associate|Assistant)\s+(Representative|Manager|Director|Analyst|Specialist|Coordinator|Consultant|Advisor|Officer|Supervisor)\s*$/i
      ];
      
      const isJobTitle = jobTitlePatterns.some(pattern => pattern.test(line));
      
      if (isJobTitle) {
        // Save previous experience if exists
        if (currentExperience) {
          currentExperience.description = descriptionLines.join(' ').trim();
          experiences.push(currentExperience);
        }
        
        // Start new experience
        currentExperience = {
          title: line,
          company: null,
          start_date: null,
          end_date: null,
          description: ''
        };
        descriptionLines = [];
      } else if (currentExperience) {
        // Check if this line is a company name (usually comes after job title)
        if (!currentExperience.company && i < experienceLines.length - 1) {
          // Look for company patterns
          const companyPatterns = [
            /^([A-Z][A-Za-z\s&,.-]+(?:Inc|LLC|Corp|Ltd|Company|Group|Solutions|Technologies|Systems|Services|Studios)?)\s*$/,
            /^([A-Za-z\s&,.-]{3,50})\s*$/
          ];
          
          const isCompany = companyPatterns.some(pattern => pattern.test(line));
          
          if (isCompany && !line.toLowerCase().includes('present') && !line.match(/\d{4}/)) {
            currentExperience.company = line;
            continue;
          }
        }
        
        // Check if this line contains dates
        const datePattern = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})\s*[-–—]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}|Present|Current)\b/i;
        const dateMatch = line.match(datePattern);
        
        if (dateMatch) {
          currentExperience.start_date = dateMatch[1];
          currentExperience.end_date = dateMatch[2];
          continue;
        }
        
        // Otherwise, treat as description
        if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
          descriptionLines.push(line);
        } else if (line.length > 10) {
          descriptionLines.push(line);
        }
      }
    }
    
    // Add the last experience
    if (currentExperience) {
      currentExperience.description = descriptionLines.join(' ').trim();
      experiences.push(currentExperience);
    }
    
    // If no experience found in section, try fallback
    if (experiences.length === 0) {
      return this.extractWorkExperienceFallback(text);
    }
    
    return experiences;
  }

  // Fallback work experience extraction using keyword matching throughout the document
  extractWorkExperienceFallback(text) {
    const experiences = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Look for job title patterns throughout the document
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for job title patterns
      const jobTitlePatterns = [
        /^(Senior|Lead|Principal|Junior|Associate|Staff|Chief)?\s*(Software|Web|Frontend|Backend|Full-stack|Data|Cloud|DevOps|Mobile|System|Network|Security|QA|Test)?\s*(Engineer|Developer|Architect|Designer|Analyst|Scientist|Manager|Consultant|Administrator|Specialist|Programmer|Technician)\s*$/i,
        /^(Business|Marketing|Sales|Customer|Client|Account|Product|Project|Program|Operations|HR|Human\s*Resources|Finance|Financial|Administrative|Executive|Senior|Junior|Associate|Assistant)\s+(Manager|Director|Lead|Coordinator|Specialist|Analyst|Representative|Consultant|Advisor|Officer|Supervisor|Coordinator)\s*$/i,
        /^(Creative|Graphic|UI|UX|Visual|Digital|Content|Social\s*Media|Brand|Marketing|Communication)\s+(Designer|Manager|Specialist|Coordinator|Director|Lead|Consultant)\s*$/i,
        /^(Manager|Director|Lead|Coordinator|Specialist|Analyst|Representative|Consultant|Advisor|Officer|Supervisor|Coordinator|Assistant|Associate|Senior|Junior|Principal|Chief|Head|Vice)\s*$/i
      ];
      
      const isJobTitle = jobTitlePatterns.some(pattern => pattern.test(line));
      
      if (isJobTitle) {
        // Look for company name in nearby lines
        let company = null;
        for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
          const nearbyLine = lines[j].trim();
          if (nearbyLine.includes('Inc') || nearbyLine.includes('LLC') || nearbyLine.includes('Corp') || nearbyLine.includes('Ltd') || nearbyLine.includes('Company') || nearbyLine.includes('Group')) {
            company = nearbyLine;
            break;
          }
        }
        
        // Look for dates in nearby lines
        let startDate = null;
        let endDate = null;
        for (let j = i - 1; j <= Math.min(lines.length - 1, i + 3); j++) {
          if (j >= 0) {
            const nearbyLine = lines[j].trim();
            const datePattern = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4})\s*[-–—]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|\d{4}|Present|Current)\b/i;
            const dateMatch = nearbyLine.match(datePattern);
            if (dateMatch) {
              startDate = dateMatch[1];
              endDate = dateMatch[2];
              break;
            }
          }
        }
        
        experiences.push({
          title: line,
          company: company,
          start_date: startDate,
          end_date: endDate,
          description: ''
        });
      }
    }
    
    return experiences;
  }

  // Calculate total years of experience
  calculateTotalExperience(workExperience) {
    if (!Array.isArray(workExperience) || workExperience.length === 0) {
      return 0;
    }
    
    let totalYears = 0;
    const currentYear = new Date().getFullYear();
    
    for (const exp of workExperience) {
      if (exp.start_date) {
        const startYear = this.extractYearFromDate(exp.start_date);
        const endYear = exp.end_date === "Present" || exp.end_date === "Current" ? 
          currentYear : this.extractYearFromDate(exp.end_date);
        
        if (startYear && endYear && endYear >= startYear) {
          totalYears += (endYear - startYear);
        }
      }
    }
    
    return Math.max(0, totalYears);
  }

  // Helper to extract year from date string
  extractYearFromDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }

  // Generate summary
  generateSummary(text, skills, experience) {
    if (!text || typeof text !== 'string') {
      return 'Professional with technical experience.';
    }

    // Look for existing summary
    const summaryKeywords = ['summary', 'profile', 'objective', 'about', 'overview'];
    const lowerText = text.toLowerCase();
    
    for (const keyword of summaryKeywords) {
      const index = lowerText.indexOf(keyword);
      if (index !== -1) {
        const sectionEnd = this.findSectionEnd(lowerText, index);
        const summaryText = text.substring(index, sectionEnd);
        
        // Extract the actual summary content
        const lines = summaryText.split('\n').filter(line => line.trim().length > 0);
        if (lines.length > 1) {
          const summary = lines.slice(1).join(' ').trim();
          if (summary.length > 20) {
            return summary.substring(0, 500);
          }
        }
      }
    }
    
    // Generate summary based on extracted data
    const topSkills = Array.isArray(skills) && skills.length > 0 
      ? skills.slice(0, 5).map(s => s.name).join(', ')
      : 'various technical skills';
    
    return `Professional with ${experience || 0} years of experience specializing in ${topSkills}.`;
  }

  // Main parsing method
  async parseCV(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      console.error('Invalid file path provided to parseCV');
      return {
        parsing_error: 'Invalid file path',
        parsed_at: new Date().toISOString()
      };
    }

    try {
      console.log('Starting CV parsing for:', filePath);
      
      const text = await this.extractText(filePath);
      console.log('Text extracted successfully, length:', text.length);
      
      if (!text || text.trim().length === 0) {
        return {
          parsing_error: 'No text content extracted from file',
          parsed_at: new Date().toISOString()
        };
      }

      // Extract name
      const { firstName, lastName } = this.extractName(text);
      
      // Extract contact info
      const contactInfo = this.extractContactInfo(text);
      
      // Extract skills
      const skills = this.extractSkills(text);
      
      // Extract education
      const education = this.extractEducation(text);
      
      // Extract work experience
      const workExperience = this.extractWorkExperience(text);
      
      // Calculate total experience
      const totalExperience = this.calculateTotalExperience(workExperience);
      
      // Generate summary
      const summary = this.generateSummary(text, skills, totalExperience);
      
      console.log('Parsing completed successfully');
      console.log('Extracted data:', {
        name: `${firstName} ${lastName}`,
        email: contactInfo.email,
        phone: contactInfo.phone,
        skillsCount: skills.length,
        educationCount: education.length,
        workExperienceCount: workExperience.length,
        totalExperience
      });

      return {
        first_name: firstName,
        last_name: lastName,
        phone: contactInfo.phone || '',
        email: contactInfo.email || '',
        linkedin_url: contactInfo.linkedin_url || '',
        github_url: contactInfo.github_url || '',
        skills: skills,
        education: education,
        work_experience: workExperience,
        years_experience: totalExperience,
        summary: summary,
        parsed_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('CV parsing error:', error);
      return {
        parsing_error: `Failed to parse CV: ${error.message}`,
        parsed_at: new Date().toISOString()
      };
    }
  }
}

module.exports = new CVParser();