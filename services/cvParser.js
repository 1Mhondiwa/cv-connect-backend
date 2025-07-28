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

// Updated extractSkillsFallback method with comprehensive skill categories
extractSkillsFallback(text) {
  const skills = [];
  const commonSkills = [
    // Programming Languages (existing)
    'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'TypeScript',
    'HTML', 'CSS', 'SQL', 'R', 'MATLAB', 'Scala', 'Perl', 'Shell', 'Bash', 'PowerShell',
    
    // Medical & Healthcare Skills
    'Patient Care', 'Medical Diagnosis', 'Surgery', 'Anesthesia', 'Radiology', 'Cardiology', 
    'Pediatrics', 'Emergency Medicine', 'Clinical Research', 'Medical Records', 'CPR', 'First Aid',
    'Nursing', 'Physical Therapy', 'Occupational Therapy', 'Medical Imaging', 'Laboratory Testing',
    'Pharmacology', 'Medical Equipment', 'Sterilization', 'Infection Control', 'Medical Coding',
    
    // Construction & Trades
    'Carpentry', 'Plumbing', 'Electrical Work', 'HVAC', 'Welding', 'Masonry', 'Roofing',
    'Painting', 'Flooring', 'Drywall', 'Concrete', 'Blueprint Reading', 'Safety Protocols',
    'Construction Management', 'Project Planning', 'Quality Control', 'Equipment Operation',
    'Crane Operation', 'Excavation', 'Site Preparation', 'Building Codes', 'Permits',
    
    // Engineering (Non-Software)
    'Mechanical Engineering', 'Civil Engineering', 'Electrical Engineering', 'Chemical Engineering',
    'Structural Engineering', 'AutoCAD', 'SolidWorks', 'CAD Design', '3D Modeling', 'Technical Drawing',
    'Project Management', 'Quality Assurance', 'Process Improvement', 'Manufacturing', 'Production',
    'Materials Science', 'Thermodynamics', 'Fluid Mechanics', 'Structural Analysis',
    
    // Business & Management
    'Project Management', 'Team Leadership', 'Strategic Planning', 'Budget Management',
    'Business Analysis', 'Marketing', 'Sales', 'Customer Service', 'Human Resources',
    'Operations Management', 'Supply Chain', 'Inventory Management', 'Financial Analysis',
    'Risk Management', 'Compliance', 'Negotiation', 'Presentation Skills', 'Public Speaking',
    
    // Legal & Finance
    'Legal Research', 'Contract Law', 'Corporate Law', 'Criminal Law', 'Family Law',
    'Litigation', 'Legal Writing', 'Court Procedures', 'Client Counseling', 'Mediation',
    'Financial Planning', 'Investment Analysis', 'Accounting', 'Auditing', 'Tax Preparation',
    'Banking', 'Insurance', 'Real Estate', 'Wealth Management', 'Financial Reporting',
    
    // Education & Training
    'Curriculum Development', 'Lesson Planning', 'Classroom Management', 'Student Assessment',
    'Educational Technology', 'Special Education', 'Adult Learning', 'Training Design',
    'Instructional Design', 'E-Learning', 'Workshop Facilitation', 'Mentoring', 'Coaching',
    
    // Creative & Design
    'Graphic Design', 'Web Design', 'Photography', 'Video Editing', 'Animation',
    'Illustration', 'Branding', 'Typography', 'Color Theory', 'Layout Design',
    'Adobe Creative Suite', 'Photoshop', 'Illustrator', 'InDesign', 'After Effects',
    
    // Hospitality & Service
    'Customer Service', 'Food Service', 'Hotel Management', 'Event Planning',
    'Restaurant Management', 'Catering', 'Bartending', 'Housekeeping', 'Front Desk',
    'Travel Planning', 'Tourism', 'Guest Relations', 'Reservation Management',
    
    // Transportation & Logistics
    'Driving', 'Commercial Driving', 'CDL', 'Logistics', 'Warehouse Management',
    'Inventory Control', 'Shipping', 'Receiving', 'Fleet Management', 'Route Planning',
    'Forklift Operation', 'Loading', 'Unloading', 'Distribution', 'Supply Chain',
    
    // Agriculture & Environmental
    'Farming', 'Crop Management', 'Livestock', 'Agricultural Equipment', 'Irrigation',
    'Pest Control', 'Soil Analysis', 'Environmental Science', 'Sustainability',
    'Waste Management', 'Water Treatment', 'Environmental Compliance',
    
    // Technical & IT (existing expanded)
    'React', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Django', 'Flask', 'Spring', 'Laravel', 'ASP.NET',
    'Bootstrap', 'jQuery', 'Redux', 'Vuex', 'GraphQL', 'REST API', 'MongoDB', 'MySQL', 'PostgreSQL',
    'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'Jenkins', 'Jira', 'Confluence',
    'Machine Learning', 'Data Analysis', 'Statistics', 'Excel', 'Power BI', 'Tableau', 'SAS', 'SPSS',
    
    // Methodologies & Soft Skills
    'Agile', 'Scrum', 'Kanban', 'DevOps', 'CI/CD', 'TDD', 'BDD', 'Waterfall',
    'Communication', 'Leadership', 'Problem Solving', 'Critical Thinking', 'Time Management',
    'Organization', 'Multitasking', 'Attention to Detail', 'Teamwork', 'Adaptability',
    'Creativity', 'Innovation', 'Decision Making', 'Conflict Resolution', 'Stress Management'
  ];
  
  const lowerText = text.toLowerCase();
  
  for (const skill of commonSkills) {
    // More flexible matching - check for skill as whole word or part of phrase
    const skillRegex = new RegExp(`\\b${skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (skillRegex.test(lowerText)) {
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
     // Updated education section detection keywords
const educationKeywords = [
  'education', 'academic', 'qualification', 'school', 'university',
  'college', 'institute', 'degree', 'certificate', 'diploma',
  'masters', 'phd', 'doctorate', 'mba', 'bachelor', 'associate',
  'high school', 'secondary school', 'elementary school',
  // Added comprehensive education keywords
  'educational background', 'academic background', 'academic qualifications',
  'educational qualifications', 'training', 'coursework', 'studies',
  'academic achievements', 'academic history', 'educational history',
  'certifications', 'licenses', 'professional development',
  'continuing education', 'professional training', 'technical training',
  'vocational training', 'trade school', 'apprenticeship',
  'professional certifications', 'industry certifications',
  'medical school', 'law school', 'graduate school', 'undergraduate',
  'postgraduate', 'doctoral', 'fellowship', 'residency',
  'internship', 'clinical training', 'medical training',
  'legal education', 'engineering education', 'business school',
  'nursing school', 'dental school', 'veterinary school',
  'education and training', 'qualifications and certifications',
  'academic credentials', 'professional credentials'
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
      
// Updated degree patterns to cover all fields and professions
const degreePatterns = [
  // Medical degrees
  /(Doctor\s+of\s+Medicine|M\.?D\.?|Medical\s+Doctor|Doctor\s+of\s+Osteopathic\s+Medicine|D\.?O\.?|Doctor\s+of\s+Dental\s+Surgery|D\.?D\.?S\.?|Doctor\s+of\s+Dental\s+Medicine|D\.?M\.?D\.?|Doctor\s+of\s+Veterinary\s+Medicine|D\.?V\.?M\.?|Doctor\s+of\s+Pharmacy|Pharm\.?D\.?|Doctor\s+of\s+Physical\s+Therapy|D\.?P\.?T\.?|Doctor\s+of\s+Nursing\s+Practice|D\.?N\.?P\.?)\s*(?:in\s+)?(.+)?$/i,
  
  // Legal degrees
  /(Juris\s+Doctor|J\.?D\.?|Doctor\s+of\s+Jurisprudence|Bachelor\s+of\s+Laws|LL\.?B\.?|Master\s+of\s+Laws|LL\.?M\.?|Doctor\s+of\s+Juridical\s+Science|S\.?J\.?D\.?)\s*(?:in\s+)?(.+)?$/i,
  
  // Standard academic degrees
  /(Bachelor|B\.?A\.?|B\.?S\.?|B\.?Sc\.?|B\.?Tech\.?|B\.?E\.?|B\.?Eng\.?|B\.?Comm\.?|B\.?Bus\.?|B\.?Admin\.?|B\.?F\.?A\.?|B\.?Ed\.?|B\.?N\.?|B\.?S\.?N\.?)\s+(?:of\s+|in\s+)?(.+)$/i,
  /(Master|M\.?A\.?|M\.?S\.?|M\.?Sc\.?|M\.?Tech\.?|M\.?E\.?|M\.?Eng\.?|M\.?Comm\.?|M\.?Bus\.?|M\.?Admin\.?|M\.?F\.?A\.?|M\.?Ed\.?|M\.?N\.?|M\.?S\.?N\.?|M\.?P\.?H\.?|M\.?S\.?W\.?)\s+(?:of\s+|in\s+)?(.+)$/i,
  /(MBA|M\.?B\.?A\.?|Master\s+of\s+Business\s+Administration)\s+(?:in\s+)?(.+)?$/i,
  /(Ph\.?D\.?|PhD|Doctorate|Doctor|D\.?Phil\.?|Ed\.?D\.?|Psy\.?D\.?|D\.?B\.?A\.?|D\.?Sc\.?|D\.?Eng\.?)\s+(?:in\s+)?(.+)?$/i,
  /(Associate|A\.?A\.?|A\.?S\.?|A\.?Sc\.?|A\.?Tech\.?|A\.?E\.?|A\.?A\.?S\.?|A\.?D\.?N\.?)\s+(?:of\s+|in\s+)?(.+)$/i,
  
  // International and alternative degrees
  /(BSc|BA|BEng|BTech|MSc|MA|MEng|MTech)\s+(?:in\s+)?(.+)?$/i,
  
  // Certificates and diplomas
  /(Diploma|Certificate|Certification|Advanced\s+Diploma|Postgraduate\s+Diploma|Graduate\s+Diploma|Professional\s+Diploma|National\s+Diploma|Higher\s+National\s+Diploma|HND)\s+(?:in\s+)?(.+)$/i,
  
  // Trade and vocational certifications
  /(Trade\s+Certificate|Vocational\s+Certificate|Technical\s+Certificate|Apprenticeship\s+Certificate|Journey\s*man\s+License|Master\s+License|Professional\s+License|Occupational\s+License)\s+(?:in\s+)?(.+)$/i,
  
  // Professional certifications by field
  /(Certified\s+Public\s+Accountant|CPA|Certified\s+Management\s+Accountant|CMA|Chartered\s+Accountant|CA|Certified\s+Financial\s+Planner|CFP|Chartered\s+Financial\s+Analyst|CFA|Project\s+Management\s+Professional|PMP|Certified\s+Project\s+Manager|CPM)\s*(?:in\s+)?(.+)?$/i,
  
  // Medical licenses and certifications
  /(Medical\s+License|Nursing\s+License|RN|LPN|Licensed\s+Practical\s+Nurse|Registered\s+Nurse|Certified\s+Nursing\s+Assistant|CNA|Emergency\s+Medical\s+Technician|EMT|Paramedic\s+License|Pharmacy\s+License|Physical\s+Therapy\s+License|Occupational\s+Therapy\s+License)\s*(?:in\s+)?(.+)?$/i,
  
  // Engineering and technical certifications
  /(Professional\s+Engineer|P\.?E\.?|Certified\s+Engineer|Licensed\s+Engineer|Engineering\s+License|FE|EIT|Engineer\s+in\s+Training|Fundamentals\s+of\s+Engineering)\s*(?:in\s+)?(.+)?$/i,
  
  // Trade licenses
  /(Electrical\s+License|Electrician\s+License|Plumbing\s+License|Plumber\s+License|HVAC\s+License|Contractor\s+License|General\s+Contractor\s+License|Master\s+Electrician|Master\s+Plumber|Journeyman\s+Electrician|Journeyman\s+Plumber)\s*(?:in\s+)?(.+)?$/i,
  
  // High school and secondary education
  /(High\s+School|Secondary\s+School|Secondary\s+Education|GED|General\s+Educational\s+Development|GCSE|General\s+Certificate\s+of\s+Secondary\s+Education|A-Level|Advanced\s+Level|IB|International\s+Baccalaureate|High\s+School\s+Diploma|Secondary\s+School\s+Diploma)\s+(?:in\s+)?(.+)?$/i,
  
  // Professional development and continuing education
  /(Professional\s+Certification|Professional\s+Certificate|Industry\s+Certification|Continuing\s+Education\s+Units|CEU|Professional\s+Development\s+Certificate|Training\s+Certificate|Workshop\s+Certificate|Seminar\s+Certificate)\s+(?:in\s+)?(.+)$/i,
  
  // Generic degree patterns (more flexible)
  /([A-Z][a-z]+)\s+(?:Degree|Program|Course|Training|Certification|License)\s+(?:in\s+)?(.+)$/i,
  
  // Catch-all for any remaining degree-like patterns
  /(Associate|Bachelor|Master|Doctorate|Doctor|Certificate|Diploma|License|Certification)\s+(.+)$/i
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

  // Added this method to make the section detection more flexible
findSectionBoundaries(text, sectionKeywords, endSectionKeywords) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  let startIndex = -1;
  let endIndex = lines.length;
  
  // Find section start with fuzzy matching
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase().trim();
    
    // Remove special characters for better matching
    const cleanLine = line.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Check if line contains any section keyword
    const matchesKeyword = sectionKeywords.some(keyword => {
      const cleanKeyword = keyword.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      return cleanLine.includes(cleanKeyword) || 
             line.includes(keyword.toLowerCase()) ||
             // Fuzzy matching - check if most words match
             this.calculateSimilarity(cleanLine, cleanKeyword) > 0.7;
    });
    
    if (matchesKeyword) {
      startIndex = i;
      break;
    }
  }
  
  // Find section end
  if (startIndex !== -1) {
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      const cleanLine = line.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      
      const matchesEndKeyword = endSectionKeywords.some(keyword => {
        const cleanKeyword = keyword.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        return cleanLine.includes(cleanKeyword) || 
               line.includes(keyword.toLowerCase()) ||
               this.calculateSimilarity(cleanLine, cleanKeyword) > 0.7;
      });
      
      if (matchesEndKeyword) {
        endIndex = i;
        break;
      }
    }
  }
  
  return { startIndex, endIndex, lines };
}


  // Updated findSectionEnd function with comprehensive keywords
findSectionEnd(text, startIndex) {
  // Comprehensive section keywords that could end any section
  const sectionKeywords = [
    // Work & Employment
    'experience', 'work', 'employment', 'career', 'professional experience',
    'work experience', 'employment history', 'job history', 'positions',
    'roles', 'responsibilities', 'professional background',
    
    // Education & Training
    'education', 'academic', 'qualifications', 'training', 'academic background',
    'educational background', 'academic qualifications', 'educational qualifications',
    'degrees', 'certifications', 'licenses', 'professional development',
    'continuing education', 'professional training', 'technical training',
    
    // Skills & Competencies
    'skills', 'competencies', 'abilities', 'expertise', 'technical skills',
    'professional skills', 'core competencies', 'key skills', 'specialized skills',
    'trade skills', 'clinical skills', 'technical competencies', 'skill set',
    
    // Projects & Achievements
    'projects', 'achievements', 'awards', 'honors', 'accomplishments',
    'recognition', 'publications', 'presentations', 'research', 'portfolio',
    
    // Additional Sections
    'certifications', 'licenses', 'professional certifications', 'industry certifications',
    'references', 'contact', 'personal', 'additional', 'other', 'miscellaneous',
    'volunteer', 'community service', 'activities', 'interests', 'hobbies',
    'languages', 'language skills', 'memberships', 'affiliations', 'associations',
    'leadership', 'extracurricular', 'military', 'service', 'security clearance',
    
    // Professional Development
    'professional development', 'continuing education', 'workshops', 'seminars',
    'conferences', 'training programs', 'course work', 'specialized training',
    
    // Contact & Personal
    'contact information', 'personal information', 'personal details',
    'additional information', 'other information', 'summary', 'objective',
    'profile', 'about', 'overview', 'biography'
  ];
  
  let minIndex = text.length;
  
  // Look for section keywords starting from a reasonable offset
  for (const keyword of sectionKeywords) {
    // Use case-insensitive search
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // Find the keyword starting from the offset
    const index = lowerText.indexOf(lowerKeyword, startIndex + 50);
    if (index !== -1 && index < minIndex) {
      // Additional validation: make sure it's likely a section header
      // Check if the keyword appears at the beginning of a line or after newline
      const beforeKeyword = text.substring(Math.max(0, index - 5), index);
      const afterKeyword = text.substring(index + keyword.length, Math.min(text.length, index + keyword.length + 10));
      
      // More likely to be a section header if:
      // 1. Preceded by newline or start of text
      // 2. Followed by colon, newline, or end of line
      const isLikelyHeader = 
        /[\n\r]/.test(beforeKeyword) || index < 10 || // At start or after newline
        /[\n\r:]/.test(afterKeyword) || // Followed by newline or colon
        afterKeyword.trim().length === 0; // At end of line
      
      if (isLikelyHeader) {
        minIndex = index;
      }
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
      
     // Updated job title patterns to cover all industries
const jobTitlePatterns = [
  // Medical & Healthcare
  /^(Doctor|Dr\.?|Physician|Surgeon|Nurse|Registered\s+Nurse|RN|Licensed\s+Practical\s+Nurse|LPN|Medical\s+Assistant|Pharmacist|Therapist|Physical\s+Therapist|Occupational\s+Therapist|Radiologist|Cardiologist|Pediatrician|Anesthesiologist|Emergency\s+Medicine|Family\s+Medicine|Internal\s+Medicine|Psychiatrist|Psychologist|Dentist|Dental\s+Hygienist|Veterinarian|Medical\s+Technician|Lab\s+Technician|X-Ray\s+Technician|Ultrasound\s+Technician|Paramedic|EMT|Healthcare\s+Administrator|Medical\s+Receptionist|Medical\s+Secretary|Clinical\s+Coordinator|Patient\s+Care\s+Coordinator)\s*$/i,
  
  // Construction & Trades
  /^(Plumber|Electrician|Carpenter|Mason|Bricklayer|Roofer|Painter|Welder|HVAC\s+Technician|Construction\s+Worker|Construction\s+Manager|Project\s+Manager|Site\s+Supervisor|Foreman|General\s+Contractor|Contractor|Subcontractor|Heavy\s+Equipment\s+Operator|Crane\s+Operator|Excavator\s+Operator|Concrete\s+Finisher|Drywall\s+Installer|Flooring\s+Installer|Tile\s+Setter|Glazier|Insulation\s+Worker|Landscaper|Tree\s+Trimmer|Groundskeeper)\s*$/i,
  
  // Engineering (Non-Software)
  /^(Civil\s+Engineer|Mechanical\s+Engineer|Electrical\s+Engineer|Chemical\s+Engineer|Environmental\s+Engineer|Structural\s+Engineer|Aerospace\s+Engineer|Biomedical\s+Engineer|Industrial\s+Engineer|Materials\s+Engineer|Petroleum\s+Engineer|Mining\s+Engineer|Nuclear\s+Engineer|Marine\s+Engineer|Agricultural\s+Engineer|Engineering\s+Technician|CAD\s+Designer|Design\s+Engineer|Quality\s+Engineer|Process\s+Engineer|Manufacturing\s+Engineer|Production\s+Engineer|Plant\s+Engineer|Maintenance\s+Engineer|Project\s+Engineer)\s*$/i,
  
  // Legal & Finance
  /^(Lawyer|Attorney|Paralegal|Legal\s+Assistant|Legal\s+Secretary|Judge|Magistrate|Court\s+Reporter|Bailiff|Legal\s+Counsel|Corporate\s+Counsel|Public\s+Defender|District\s+Attorney|Prosecutor|Legal\s+Advisor|Compliance\s+Officer|Accountant|CPA|Certified\s+Public\s+Accountant|Bookkeeper|Financial\s+Analyst|Financial\s+Advisor|Investment\s+Advisor|Tax\s+Preparer|Auditor|Controller|CFO|Treasurer|Banking\s+Associate|Loan\s+Officer|Insurance\s+Agent|Insurance\s+Adjuster|Real\s+Estate\s+Agent|Realtor|Mortgage\s+Broker)\s*$/i,
  
  // Education & Training
  /^(Teacher|Professor|Instructor|Educator|Principal|Vice\s+Principal|Assistant\s+Principal|School\s+Administrator|Curriculum\s+Coordinator|Academic\s+Advisor|Counselor|School\s+Counselor|Librarian|Teaching\s+Assistant|Substitute\s+Teacher|Tutor|Coach|Athletic\s+Director|Special\s+Education\s+Teacher|ESL\s+Teacher|Preschool\s+Teacher|Elementary\s+Teacher|Middle\s+School\s+Teacher|High\s+School\s+Teacher|College\s+Professor|University\s+Professor|Research\s+Assistant|Graduate\s+Assistant|Training\s+Coordinator|Corporate\s+Trainer)\s*$/i,
  
  // Transportation & Logistics
  /^(Driver|Truck\s+Driver|Bus\s+Driver|Taxi\s+Driver|Delivery\s+Driver|CDL\s+Driver|Commercial\s+Driver|Forklift\s+Operator|Warehouse\s+Worker|Warehouse\s+Manager|Logistics\s+Coordinator|Supply\s+Chain\s+Manager|Shipping\s+Clerk|Receiving\s+Clerk|Inventory\s+Specialist|Material\s+Handler|Dock\s+Worker|Freight\s+Handler|Dispatcher|Fleet\s+Manager|Transportation\s+Manager|Pilot|Flight\s+Attendant|Air\s+Traffic\s+Controller|Ship\s+Captain|Maritime\s+Officer|Train\s+Engineer|Conductor)\s*$/i,
  
  // Hospitality & Service
  /^(Server|Waiter|Waitress|Bartender|Chef|Cook|Line\s+Cook|Prep\s+Cook|Kitchen\s+Manager|Restaurant\s+Manager|Food\s+Service\s+Manager|Hotel\s+Manager|Front\s+Desk\s+Clerk|Concierge|Housekeeper|Housekeeping\s+Supervisor|Maintenance\s+Worker|Event\s+Coordinator|Event\s+Planner|Wedding\s+Planner|Catering\s+Manager|Banquet\s+Manager|Travel\s+Agent|Tour\s+Guide|Recreation\s+Coordinator|Activities\s+Director|Fitness\s+Instructor|Personal\s+Trainer|Lifeguard|Security\s+Guard|Bouncer)\s*$/i,
  
  // Retail & Sales
  /^(Sales\s+Associate|Sales\s+Representative|Sales\s+Manager|Regional\s+Sales\s+Manager|Account\s+Manager|Key\s+Account\s+Manager|Business\s+Development\s+Manager|Sales\s+Director|Retail\s+Manager|Store\s+Manager|Assistant\s+Manager|Cashier|Customer\s+Service\s+Representative|Customer\s+Service\s+Manager|Call\s+Center\s+Representative|Telemarketer|Real\s+Estate\s+Sales\s+Agent|Insurance\s+Sales\s+Agent|Car\s+Salesperson|Retail\s+Associate|Merchandiser|Visual\s+Merchandiser|Stock\s+Clerk|Inventory\s+Associate)\s*$/i,
  
  // Agriculture & Environmental
  /^(Farmer|Rancher|Agricultural\s+Worker|Farm\s+Manager|Ranch\s+Manager|Livestock\s+Manager|Crop\s+Manager|Agricultural\s+Technician|Veterinary\s+Technician|Animal\s+Care\s+Worker|Groundskeeper|Landscaper|Arborist|Tree\s+Trimmer|Pest\s+Control\s+Technician|Environmental\s+Scientist|Environmental\s+Technician|Park\s+Ranger|Forest\s+Ranger|Wildlife\s+Biologist|Conservation\s+Officer|Waste\s+Management\s+Worker|Recycling\s+Coordinator|Water\s+Treatment\s+Operator|Environmental\s+Compliance\s+Officer)\s*$/i,
  
  // Manufacturing & Production
  /^(Machine\s+Operator|Production\s+Worker|Assembly\s+Worker|Quality\s+Control\s+Inspector|Quality\s+Assurance\s+Technician|Manufacturing\s+Engineer|Production\s+Manager|Plant\s+Manager|Shift\s+Supervisor|Line\s+Supervisor|Maintenance\s+Technician|Industrial\s+Mechanic|Tool\s+and\s+Die\s+Maker|Machinist|CNC\s+Operator|Welder|Fabricator|Safety\s+Coordinator|Safety\s+Manager|Production\s+Planner|Scheduler|Inventory\s+Control\s+Specialist)\s*$/i,
  
  // Creative & Media
  /^(Graphic\s+Designer|Web\s+Designer|UI\s+Designer|UX\s+Designer|Art\s+Director|Creative\s+Director|Photographer|Videographer|Video\s+Editor|Film\s+Editor|Sound\s+Engineer|Music\s+Producer|Artist|Illustrator|Animator|Motion\s+Graphics\s+Designer|Social\s+Media\s+Manager|Content\s+Creator|Content\s+Writer|Copywriter|Technical\s+Writer|Journalist|Reporter|Editor|Proofreader|Marketing\s+Coordinator|Marketing\s+Manager|Brand\s+Manager|Public\s+Relations\s+Specialist|Communications\s+Manager)\s*$/i,
  
  // Technology & IT (existing patterns but more comprehensive)
  /^(Senior|Lead|Principal|Junior|Associate|Staff|Chief)?\s*(Software|Web|Frontend|Front-end|Backend|Back-end|Full-stack|Fullstack|Data|Cloud|DevOps|Mobile|System|Network|Security|QA|Quality\s+Assurance|Test|Testing|Database|Infrastructure|Platform|Solutions|Applications?)?\s*(Engineer|Developer|Architect|Designer|Analyst|Scientist|Manager|Consultant|Administrator|Specialist|Programmer|Technician|Director|Coordinator|Lead)\s*$/i,
  
  // General Business & Administrative
  /^(Manager|Director|Vice\s+President|VP|President|CEO|Chief\s+Executive\s+Officer|COO|Chief\s+Operating\s+Officer|CFO|Chief\s+Financial\s+Officer|CTO|Chief\s+Technology\s+Officer|Executive\s+Assistant|Administrative\s+Assistant|Secretary|Receptionist|Office\s+Manager|Operations\s+Manager|Human\s+Resources\s+Manager|HR\s+Manager|Recruiter|Training\s+Manager|Business\s+Analyst|Data\s+Analyst|Research\s+Analyst|Market\s+Research\s+Analyst|Consultant|Management\s+Consultant|Project\s+Coordinator|Program\s+Manager|Account\s+Executive|Client\s+Manager|Relationship\s+Manager)\s*$/i,
  
  // Public Service & Government
  /^(Police\s+Officer|Detective|Sheriff|Deputy|Firefighter|Fire\s+Captain|Fire\s+Chief|Emergency\s+Medical\s+Technician|Paramedic|Social\s+Worker|Case\s+Worker|Probation\s+Officer|Parole\s+Officer|Corrections\s+Officer|Border\s+Patrol\s+Agent|Customs\s+Officer|Immigration\s+Officer|Government\s+Administrator|City\s+Manager|Mayor|Council\s+Member|Public\s+Health\s+Officer|Building\s+Inspector|Code\s+Enforcement\s+Officer|Tax\s+Assessor|Court\s+Clerk|DMV\s+Clerk|Postal\s+Worker|Mail\s+Carrier)\s*$/i,
  
  // Generic professional titles (keep existing)
  /^(Manager|Director|Lead|Coordinator|Specialist|Analyst|Representative|Consultant|Advisor|Officer|Supervisor|Coordinator|Assistant|Associate|Senior|Junior|Principal|Chief|Head|Vice|Executive|Professional|Technician|Worker|Operator|Inspector|Administrator|Clerk|Agent)\s*$/i
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