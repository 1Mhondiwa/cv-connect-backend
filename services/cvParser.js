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

  // Enhanced text extraction with better error handling
  async extractText(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist at path: ${filePath}`);
      }
      
      const extension = path.extname(filePath).toLowerCase();
      let text = '';
     
      if (extension === '.pdf') {
        text = await this.extractPdfText(filePath);
      } else if (extension === '.txt') {
        text = await this.extractTxtText(filePath);
      } else if (extension === '.docx') {
        text = await this.extractDocxText(filePath);
      } else if (extension === '.doc') {
        text = await this.extractDocText(filePath);
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

  async extractPdfText(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer, {
        max: 0,
        version: 'v1.10.100'
      });
      
      let text = pdfData.text || '';
      text = this.cleanExtractedText(text, 'pdf');
      
      console.log(`PDF text extracted: ${text.length} characters`);
      return text;
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error("PDF parsing failed. Please check the file format.");
    }
  }

  async extractTxtText(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const cleanedText = this.cleanExtractedText(text, 'txt');
    console.log(`TXT text extracted: ${cleanedText.length} characters`);
    return cleanedText;
  }

  async extractDocxText(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({
        buffer: dataBuffer,
        convertImage: mammoth.images.ignoreElement,
        styleMap: []
      });
      
      let text = result.value || '';
      text = this.cleanExtractedText(text, 'docx');
      
      console.log(`DOCX text extracted: ${text.length} characters`);
      return text;
    } catch (error) {
      console.error('DOCX parsing error:', error);
      throw new Error("DOCX parsing failed. Please check the file format.");
    }
  }

  async extractDocText(filePath) {
    try {
      const textract = require('textract');
      const text = await new Promise((resolve, reject) => {
        textract.fromFileWithPath(filePath, (error, extractedText) => {
          if (error) reject(error);
          else resolve(extractedText || '');
        });
      });
      
      const cleanedText = this.cleanExtractedText(text, 'doc');
      console.log(`DOC text extracted: ${cleanedText.length} characters`);
      return cleanedText;
    } catch (error) {
      console.error('DOC parsing error:', error);
      throw new Error("DOC parsing failed. Please install textract or convert to DOCX format.");
    }
  }

  // Unified text cleaning method
  cleanExtractedText(text, sourceType) {
    if (!text) return '';
    
    // Normalize line endings
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Normalize whitespace
    text = text.replace(/[ \t]+/g, ' ');
    
    // Remove common headers/footers
    text = text.replace(/\n?Page \d+( of \d+)?\n?/gi, '\n');
    text = text.replace(/\n?(Curriculum Vitae|Resume|CV)\n?/gi, '\n');
    
    // Normalize bullet points
    text = text.replace(/[•\*\u2022\u25AA\u25CF\u25CB\u25A0]/g, '•');
    text = text.replace(/\n\s*\d+\./g, '\n•');
    
    // Clean up excessive newlines
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // Remove empty lines and trim
    text = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !/^[^\w\s]*$/.test(line))
      .join('\n');
    
    return text.trim();
  }

  // Enhanced contact information extraction
  extractContactInfo(text) {
    if (!text || typeof text !== 'string') {
      return { email: null, phone: null, linkedin_url: null, github_url: null };
    }

    const contactInfo = {};
    
    // Email extraction with validation
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) {
      // Filter out common false positives
      const validEmails = emails.filter(email => {
        const domain = email.split('@')[1];
        return domain && !domain.includes('example.com') && domain.length > 3;
      });
      contactInfo.email = validEmails.length > 0 ? validEmails[0] : null;
    }
    
    // Phone number extraction with better patterns
    const phonePatterns = [
      /\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, // US format
      /\+?[0-9]{1,4}[-.\s]?\(?[0-9]{2,4}\)?[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}\b/g, // International
      /\b[0-9]{10,15}\b/g // Basic numeric
    ];
    
    for (const pattern of phonePatterns) {
      const phones = text.match(pattern);
      if (phones && phones.length > 0) {
        const cleanPhone = phones[0].replace(/[^\d\+]/g, '');
        if (cleanPhone.length >= 10 && cleanPhone.length <= 15) {
          contactInfo.phone = phones[0].trim();
          break;
        }
      }
    }
    
    // LinkedIn URL extraction
    const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in\/|profile\/view\?id=)[a-zA-Z0-9_-]+/gi;
    const linkedin = text.match(linkedinRegex);
    if (linkedin && linkedin.length > 0) {
      contactInfo.linkedin_url = linkedin[0].startsWith('http') ? linkedin[0] : 'https://' + linkedin[0];
    }
    
    // GitHub URL extraction
    const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/gi;
    const github = text.match(githubRegex);
    if (github && github.length > 0) {
      contactInfo.github_url = github[0].startsWith('http') ? github[0] : 'https://' + github[0];
    }
    
    return contactInfo;
  }

  // Improved name extraction with better validation
  extractName(text) {
    if (!text || typeof text !== 'string') {
      return { firstName: '', lastName: '' };
    }

    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('Extracting name from first 10 lines:');
    lines.slice(0, 10).forEach((line, i) => console.log(`Line ${i}: "${line}"`));
    
    // Try extracting from the first meaningful lines
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i].trim();
      
      if (this.shouldSkipLineForName(line)) {
        continue;
      }
      
      const nameResult = this.extractNameFromLine(line);
      if (nameResult.firstName && nameResult.lastName) {
        console.log(`Found name on line ${i}: "${nameResult.firstName} ${nameResult.lastName}"`);
        return nameResult;
      }
    }
    
    // Fallback methods
    return this.extractNameFallback(text);
  }

  shouldSkipLineForName(line) {
    const exclusionPatterns = [
      /@/,
      /http[s]?:\/\//,
      /www\./,
      /\.(com|org|net|edu|gov|pdf|doc|docx|txt)/i,
      /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
      /^\d+$/,
      /^(cv|resume|curriculum|vitae|portfolio)$/i,
      /^(page\s*\d+|page\s*\d+\s*of\s*\d+)$/i,
      /^[-=_*#]{3,}$/,
      /^(summary|objective|profile|about|skills|education|experience|work|projects|certifications|languages|references|contact|personal|achievements|awards|publications|interests|hobbies)$/i
    ];
    
    return exclusionPatterns.some(pattern => pattern.test(line)) || line.length > 100;
  }

  extractNameFromLine(line) {
    const cleanLine = line.replace(/[^\w\s\-'\.]/g, ' ').trim().replace(/\s+/g, ' ');
    
    const namePatterns = [
      /^([A-Z][a-z]{1,25}(?:\s+[A-Z]\.?)?)\s+([A-Z][a-z]{1,25}(?:\s+[A-Z][a-z]{1,25})*)$/,
      /^([A-Z][a-z]*(?:[-'][A-Z][a-z]*)*)\s+([A-Z][a-z]*(?:[-'][A-Z][a-z]*)*)$/,
      /^([A-Z]{2,25})\s+([A-Z]{2,25})$/,
      /([A-Z][a-z]{1,25})\s+([A-Z][a-z]{1,25})/
    ];
    
    for (const pattern of namePatterns) {
      const match = cleanLine.match(pattern);
      if (match && this.isValidName(match[1], match[2])) {
        return {
          firstName: this.formatName(match[1]),
          lastName: this.formatName(match[2])
        };
      }
    }
    
    return { firstName: '', lastName: '' };
  }

  isValidName(firstName, lastName) {
    if (!firstName || !lastName || firstName.length < 2 || lastName.length < 2) {
      return false;
    }
    
    if (firstName.length > 30 || lastName.length > 40) {
      return false;
    }
    
    const nonNameWords = [
      'summary', 'objective', 'profile', 'contact', 'phone', 'email', 'address',
      'skills', 'experience', 'education', 'work', 'employment', 'career',
      'professional', 'personal', 'references', 'languages', 'interests',
      'present', 'current', 'former', 'years', 'months', 'company'
    ];
    
    const firstLower = firstName.toLowerCase();
    const lastLower = lastName.toLowerCase();
    
    if (nonNameWords.includes(firstLower) || nonNameWords.includes(lastLower)) {
      return false;
    }
    
    // Check if it contains mostly alphabetic characters
    const combinedName = `${firstName} ${lastName}`;
    const alphaRatio = (combinedName.match(/[a-zA-Z]/g) || []).length / combinedName.length;
    
    return alphaRatio >= 0.8;
  }

  formatName(name) {
    if (!name) return '';
    
    return name.split(/[\s\-']/).map(part => {
      if (part.length <= 2 && part.endsWith('.')) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(name.includes('-') ? '-' : name.includes("'") ? "'" : ' ');
  }

  extractNameFallback(text) {
    // Try alternative patterns in the entire text
    const patterns = [
      /(?:name|candidate|applicant):\s*([A-Za-z\s\.'-]{3,50})/i,
      /^([A-Z][a-z]+\s+[A-Z][a-z]+)/m
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const nameResult = this.extractNameFromLine(match[1]);
        if (nameResult.firstName && nameResult.lastName) {
          return nameResult;
        }
      }
    }
    
    return { firstName: '', lastName: '' };
  }

  // Enhanced skills extraction with dynamic detection
  extractSkills(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0);
    let skills = [];
    
    // Primary method: Find dedicated skills section
    const skillsSection = this.findSection(lines, this.getSkillsKeywords());
    
    if (skillsSection.found) {
      const sectionSkills = this.parseSkillsFromSection(skillsSection.content);
      if (sectionSkills.length > 0) {
        skills = sectionSkills;
      }
    }
    
    // Secondary method: Look for skills patterns throughout the document
    if (skills.length === 0) {
      skills = this.extractSkillsFromEntireDocument(lines);
    }
    
    // Tertiary method: Use fallback with known skills database
    if (skills.length === 0) {
      skills = this.extractSkillsFallback(text);
    }
    
    // Limit to reasonable number and deduplicate
    return this.deduplicateSkills(skills).slice(0, 20);
  }

  getSkillsKeywords() {
    return [
      'skills', 'technical skills', 'technologies', 'expertise', 'competencies',
      'proficiencies', 'abilities', 'qualifications', 'programming languages',
      'tools', 'software', 'frameworks', 'platforms', 'core competencies',
      'professional skills', 'key skills', 'specialized skills', 'skill set',
      'core skills', 'technical competencies', 'technical expertise'
    ];
  }

  // New method: Extract skills from entire document using multiple strategies
  extractSkillsFromEntireDocument(lines) {
    const allSkills = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip if line is too short or too long
      if (line.length < 3 || line.length > 200) continue;
      
      // Check if line contains skill indicators
      if (this.lineContainsSkillIndicators(line)) {
        const skillsFromLine = this.extractSkillsFromLine(line);
        allSkills.push(...skillsFromLine);
      }
      
      // Look for bullet points or lists that might contain skills
      if (this.looksLikeSkillsList(line)) {
        const skillsFromLine = this.extractSkillsFromLine(line);
        allSkills.push(...skillsFromLine);
      }
    }
    
    return this.deduplicateSkills(allSkills);
  }

  lineContainsSkillIndicators(line) {
    const skillIndicators = [
      'proficient in', 'experienced with', 'skilled in', 'knowledge of',
      'familiar with', 'expertise in', 'competent in', 'specializing in',
      'technologies:', 'tools:', 'languages:', 'frameworks:', 'software:'
    ];
    
    const lowerLine = line.toLowerCase();
    return skillIndicators.some(indicator => lowerLine.includes(indicator));
  }

  looksLikeSkillsList(line) {
    // Check for common list patterns
    const listPatterns = [
      /^[•\-\*\+]\s+/, // Bullet points
      /^\d+\.\s+/, // Numbered lists
      /^[a-zA-Z\s\+\#\.]+[,;]\s*[a-zA-Z]/, // Comma/semicolon separated
      /\b(HTML|CSS|JavaScript|Python|Java|C\+\+|SQL|React|Angular|Node\.js|PHP|Ruby|Go|Rust|Swift|Kotlin|TypeScript)\b/i // Common tech skills
    ];
    
    return listPatterns.some(pattern => pattern.test(line));
  }

  findSection(lines, keywords) {
    let startIndex = -1;
    let endIndex = lines.length;
    
    // Find section start
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (keywords.some(keyword => line.includes(keyword.toLowerCase()))) {
        startIndex = i;
        break;
      }
    }
    
    if (startIndex === -1) {
      return { found: false, content: [] };
    }
    
    // Find section end
    const endKeywords = this.getCommonSectionHeaders();
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      if (endKeywords.some(keyword => line.includes(keyword) && line.length < 50)) {
        endIndex = i;
        break;
      }
    }
    
    return {
      found: true,
      content: lines.slice(startIndex + 1, endIndex),
      startIndex,
      endIndex
    };
  }

  getCommonSectionHeaders() {
    return [
      'experience', 'work', 'employment', 'education', 'academic',
      'projects', 'achievements', 'awards', 'certifications', 'languages',
      'references', 'contact', 'personal', 'interests', 'hobbies'
    ];
  }

  parseSkillsFromSection(lines) {
    const skills = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (this.isSkillLine(trimmedLine)) {
        const extractedSkills = this.extractSkillsFromLine(trimmedLine);
        skills.push(...extractedSkills);
      }
    }
    
    return this.deduplicateSkills(skills);
  }

  isSkillLine(line) {
    // Skip separator lines and headers
    if (line.includes('---') || line.includes('===') || line.length === 0) {
      return false;
    }
    
    // Skip lines that look like section headers
    if (line.length < 50 && this.getCommonSectionHeaders().some(header => 
      line.toLowerCase().includes(header))) {
      return false;
    }
    
    return true;
  }

  extractSkillsFromLine(line) {
    const skills = [];
    
    // Remove common prefixes and clean the line
    let cleanLine = line.replace(/^[•\-\*\+\d\.]\s*/, '').trim();
    cleanLine = cleanLine.replace(/^(Skills?|Technologies?|Tools?|Software|Frameworks?|Languages?):\s*/i, '').trim();
    
    // Pattern 1: "JavaScript - Expert - 6 years"
    const expertisePattern = /([A-Za-z\s\.#\+\-]+?)\s*[-–]\s*(Expert|Advanced|Intermediate|Beginner|Proficient|Experienced?)\s*(?:[-–]\s*(\d+)\s*years?)?/gi;
    let match;
    
    while ((match = expertisePattern.exec(cleanLine)) !== null) {
      const skillName = this.cleanSkillName(match[1]);
      if (skillName && this.looksLikeSkill(skillName)) {
        skills.push({
          name: skillName,
          proficiency: match[2] || 'Intermediate',
          years_experience: match[3] ? parseInt(match[3]) : null
        });
      }
    }
    
    if (skills.length > 0) {
      return skills;
    }
    
    // Pattern 2: Multiple separators (comma, semicolon, pipe, bullet)
    const separators = [',', ';', '|', '•', '▪', '○', '→'];
    for (const sep of separators) {
      if (cleanLine.includes(sep)) {
        const skillNames = cleanLine.split(sep)
          .map(s => this.cleanSkillName(s))
          .filter(s => s && s.length > 1 && s.length < 50)
          .filter(s => this.looksLikeSkill(s));
        
        if (skillNames.length > 0) {
          return skillNames.map(name => ({
            name: name,
            proficiency: 'Intermediate',
            years_experience: null
          }));
        }
      }
    }
    
    // Pattern 3: Space-separated skills (for lines with multiple skills)
    if (this.looksLikeMultipleSkills(cleanLine)) {
      const skillNames = this.extractSpaceSeparatedSkills(cleanLine);
      if (skillNames.length > 1) {
        return skillNames.map(name => ({
          name: name,
          proficiency: 'Intermediate',
          years_experience: null
        }));
      }
    }
    
    // Pattern 4: Single skill on a line
    const singleSkill = this.cleanSkillName(cleanLine);
    if (singleSkill && this.looksLikeSkill(singleSkill)) {
      return [{
        name: singleSkill,
        proficiency: 'Intermediate',
        years_experience: null
      }];
    }
    
    return [];
  }

  cleanSkillName(skill) {
    if (!skill) return '';
    
    return skill
      .replace(/[()[\]{}]/g, '') // Remove brackets
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/^[-•\*\+\s]+|[-•\*\+\s]+$/g, '') // Remove leading/trailing symbols
      .trim();
  }

  looksLikeMultipleSkills(line) {
    // Check if line contains multiple potential skills separated by spaces
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 10) return false;
    
    // Count words that look like skills
    const skillLikeWords = words.filter(word => 
      word.length > 2 && 
      /^[A-Za-z\+\#\.]+$/.test(word) &&
      !['and', 'or', 'with', 'the', 'for', 'in', 'on', 'at', 'by'].includes(word.toLowerCase())
    );
    
    return skillLikeWords.length >= 2;
  }

  extractSpaceSeparatedSkills(line) {
    const words = line.split(/\s+/);
    const skills = [];
    
    for (const word of words) {
      const cleanWord = this.cleanSkillName(word);
      if (cleanWord && this.looksLikeSkill(cleanWord)) {
        skills.push(cleanWord);
      }
    }
    
    return skills;
  }

  looksLikeSkill(text) {
    if (!text || text.length < 2 || text.length > 50) {
      return false;
    }
    
    // Should contain mostly letters (allow + # . for tech skills)
    const validChars = (text.match(/[a-zA-Z\+\#\.]/g) || []).length;
    if (validChars / text.length < 0.6) {
      return false;
    }
    
    // Exclude common non-skill phrases
    const excludePatterns = [
      /^(and|or|the|with|for|in|on|at|by|from|to|as|is|are|was|were|have|has|had)$/i,
      /^(years?|months?|days?)$/i,
      /^(experience|level|proficiency|knowledge|ability)$/i,
      /^(including|such|like|also|plus|etc)$/i,
      /^\d+$/,
      /^[^a-zA-Z]*$/,
      /\b(page|pages|resume|cv|curriculum|vitae)\b/i
    ];
    
    if (excludePatterns.some(pattern => pattern.test(text))) {
      return false;
    }
    
    // Positive indicators for skills
    const skillIndicators = [
      /^[A-Z][a-z]+(\.[A-Z][a-z]+)*$/, // CamelCase or dotted names (e.g., Node.js)
      /^[A-Z]+$/, // Acronyms (HTML, CSS, SQL)
      /^[A-Za-z]+[\+\#]$/, // C++, C#
      /^[A-Za-z\+\#\.]+$/, // General tech pattern
    ];
    
    // If it matches skill indicators, it's likely a skill
    if (skillIndicators.some(pattern => pattern.test(text))) {
      return true;
    }
    
    // Check against common skills database for additional validation
    const commonSkills = this.getCommonSkillsList();
    return commonSkills.some(skill => 
      skill.toLowerCase() === text.toLowerCase() ||
      text.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(text.toLowerCase())
    );
  }

  getCommonSkillsList() {
    return [
      // Programming languages
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'TypeScript',
      'HTML', 'CSS', 'SQL', 'R', 'MATLAB', 'Scala', 'Perl', 'Shell', 'Bash', 'PowerShell', 'VB.NET',
      
      // Frameworks and libraries
      'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel', 'ASP.NET',
      'Bootstrap', 'jQuery', 'Redux', 'GraphQL', 'REST', 'API', 'MongoDB', 'MySQL', 'PostgreSQL',
      
      // Tools and technologies
      'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Jenkins', 'Linux', 'Windows', 'MacOS',
      'Photoshop', 'Illustrator', 'Figma', 'Sketch', 'AutoCAD', 'SolidWorks', 'Excel', 'Word', 'PowerPoint',
      
      // Professional skills
      'Leadership', 'Management', 'Communication', 'Teamwork', 'Problem', 'Solving', 'Analysis',
      'Marketing', 'Sales', 'Accounting', 'Finance', 'HR', 'Operations', 'Strategy', 'Planning',
      
      // Industry specific
      'Machine Learning', 'AI', 'Data Science', 'Cybersecurity', 'DevOps', 'Agile', 'Scrum',
      'SEO', 'SEM', 'Social Media', 'Content', 'Writing', 'Editing', 'Translation',
      'Teaching', 'Training', 'Consulting', 'Research', 'Healthcare', 'Nursing', 'Medicine'
    ];
  }

  extractSkillsFallback(text) {
    // Use a curated list of common skills across industries
    const skillsDatabase = this.getSkillsDatabase();
    const foundSkills = [];
    const lowerText = text.toLowerCase();
    
    for (const skill of skillsDatabase) {
      const skillRegex = new RegExp(`\\b${skill.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (skillRegex.test(lowerText)) {
        foundSkills.push({
          name: skill,
          proficiency: 'Intermediate',
          years_experience: null
        });
      }
    }
    
    return this.deduplicateSkills(foundSkills);
  }

  getSkillsDatabase() {
    return [
      // Programming Languages
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin', 'TypeScript',
      'HTML', 'CSS', 'SQL', 'R', 'MATLAB', 'Scala', 'Perl', 'Shell', 'Bash', 'PowerShell',
      
      // Frameworks & Technologies
      'React', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Django', 'Flask', 'Spring', 'Laravel', 'ASP.NET',
      'Bootstrap', 'jQuery', 'Redux', 'GraphQL', 'REST API', 'MongoDB', 'MySQL', 'PostgreSQL',
      'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud', 'Jenkins',
      
      // Professional Skills
      'Project Management', 'Team Leadership', 'Communication', 'Problem Solving', 'Critical Thinking',
      'Data Analysis', 'Business Analysis', 'Marketing', 'Sales', 'Customer Service',
      'Financial Analysis', 'Budget Management', 'Strategic Planning', 'Process Improvement',
      
      // Industry-Specific Skills
      'Machine Learning', 'Data Science', 'Artificial Intelligence', 'Cybersecurity', 'Network Administration',
      'Database Administration', 'System Administration', 'Cloud Computing', 'DevOps',
      'Digital Marketing', 'SEO', 'Social Media Marketing', 'Content Marketing',
      'Accounting', 'Financial Planning', 'Risk Management', 'Compliance',
      'Medical Procedures', 'Patient Care', 'Clinical Research', 'Healthcare Administration',
      'Legal Research', 'Contract Management', 'Litigation', 'Corporate Law',
      'Construction Management', 'Electrical Systems', 'Mechanical Systems', 'HVAC',
      'Quality Assurance', 'Manufacturing', 'Supply Chain Management', 'Logistics'
    ];
  }

  deduplicateSkills(skills) {
    const seen = new Set();
    return skills.filter(skill => {
      const key = skill.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Enhanced education extraction
  extractEducation(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const educationSection = this.findSection(lines, this.getEducationKeywords());
    
    if (educationSection.found) {
      const education = this.parseEducationFromSection(educationSection.content);
      if (education.length > 0) {
        return education;
      }
    }
    
    return this.extractEducationFallback(text);
  }

  getEducationKeywords() {
    return [
      'education', 'academic', 'qualification', 'degree', 'university', 'college',
      'school', 'institute', 'training', 'certification', 'diploma',
      'educational background', 'academic background', 'academic qualifications'
    ];
  }

  parseEducationFromSection(lines) {
    const education = [];
    let currentEntry = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.length === 0 || trimmedLine.includes('---')) {
        continue;
      }
      
      const degreeMatch = this.extractDegreeFromLine(trimmedLine);
      if (degreeMatch) {
        if (currentEntry) {
          education.push(currentEntry);
        }
        currentEntry = degreeMatch;
      } else if (currentEntry) {
        // Try to extract institution or year
        const institution = this.extractInstitutionFromLine(trimmedLine);
        const year = this.extractYearFromLine(trimmedLine);
        
        if (institution && !currentEntry.institution) {
          currentEntry.institution = institution;
        }
        if (year && !currentEntry.year) {
          currentEntry.year = year;
        }
      }
    }
    
    if (currentEntry) {
      education.push(currentEntry);
    }
    
    return education;
  }

  extractDegreeFromLine(line) {
    const degreePatterns = [
      // Standard degrees
      /(Bachelor|B\.?A\.?|B\.?S\.?|B\.?Sc\.?|B\.?Tech\.?|B\.?E\.?|B\.?Eng\.?)\s*(?:of\s+|in\s+)?(.+)/i,
      /(Master|M\.?A\.?|M\.?S\.?|M\.?Sc\.?|M\.?Tech\.?|M\.?E\.?|M\.?Eng\.?)\s*(?:of\s+|in\s+)?(.+)/i,
      /(MBA|M\.?B\.?A\.?|Master\s+of\s+Business\s+Administration)\s*(?:in\s+)?(.+)?/i,
      /(Ph\.?D\.?|PhD|Doctorate|Doctor)\s*(?:in\s+)?(.+)?/i,
      /(Associate|A\.?A\.?|A\.?S\.?)\s*(?:of\s+|in\s+)?(.+)/i,
      /(Diploma|Certificate)\s*(?:in\s+)?(.+)/i,
      /(High\s+School|Secondary\s+School|GED)/i
    ];
    
    for (const pattern of degreePatterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          degree: match[0].trim(),
          field: match[2] ? match[2].trim() : '',
          institution: null,
          year: null
        };
      }
    }
    
    return null;
  }

  extractInstitutionFromLine(line) {
    const institutionPatterns = [
      /^(.+(?:University|College|Institute|School|Academy).*)$/i,
      /^([A-Z][A-Za-z\s&,.-]{5,80})$/
    ];
    
    for (const pattern of institutionPatterns) {
      const match = line.match(pattern);
      if (match && !match[1].match(/\d{4}/) && match[1].length < 100) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  extractYearFromLine(line) {
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      const currentYear = new Date().getFullYear();
      if (year >= 1950 && year <= currentYear + 5) {
        return year;
      }
    }
    return null;
  }

  extractEducationFallback(text) {
    const education = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const degreeMatch = this.extractDegreeFromLine(line.trim());
      if (degreeMatch) {
        // Look for institution and year in nearby lines
        const lineIndex = lines.indexOf(line);
        for (let i = Math.max(0, lineIndex - 2); i <= Math.min(lines.length - 1, lineIndex + 2); i++) {
          const nearbyLine = lines[i].trim();
          if (!degreeMatch.institution) {
            degreeMatch.institution = this.extractInstitutionFromLine(nearbyLine);
          }
          if (!degreeMatch.year) {
            degreeMatch.year = this.extractYearFromLine(nearbyLine);
          }
        }
        education.push(degreeMatch);
      }
    }
    
    return education;
  }

  // Enhanced work experience extraction
  extractWorkExperience(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const experienceSection = this.findSection(lines, this.getExperienceKeywords());
    
    if (experienceSection.found) {
      const experience = this.parseExperienceFromSection(experienceSection.content);
      if (experience.length > 0) {
        return experience;
      }
    }
    
    return this.extractWorkExperienceFallback(text);
  }

  getExperienceKeywords() {
    return [
      'work experience', 'experience', 'employment', 'job history',
      'professional experience', 'career history', 'employment history',
      'work history', 'professional background', 'career background'
    ];
  }

  parseExperienceFromSection(lines) {
    const experiences = [];
    let currentExp = null;
    let descriptionLines = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.length === 0 || trimmedLine.includes('---')) {
        continue;
      }
      
      const jobTitle = this.extractJobTitleFromLine(trimmedLine);
      if (jobTitle) {
        if (currentExp) {
          currentExp.description = descriptionLines.join(' ').trim();
          experiences.push(currentExp);
        }
        
        currentExp = {
          title: jobTitle,
          company: null,
          start_date: null,
          end_date: null,
          description: ''
        };
        descriptionLines = [];
      } else if (currentExp) {
        // Try to extract company, dates, or description
        if (!currentExp.company) {
          const company = this.extractCompanyFromLine(trimmedLine);
          if (company) {
            currentExp.company = company;
            continue;
          }
        }
        
        const dates = this.extractDatesFromLine(trimmedLine);
        if (dates && !currentExp.start_date) {
          currentExp.start_date = dates.start;
          currentExp.end_date = dates.end;
          continue;
        }
        
        // Treat as description
        if (trimmedLine.length > 10) {
          descriptionLines.push(trimmedLine);
        }
      }
    }
    
    if (currentExp) {
      currentExp.description = descriptionLines.join(' ').trim();
      experiences.push(currentExp);
    }
    
    return experiences;
  }

  extractJobTitleFromLine(line) {
    // More focused job title patterns - avoid overly broad matching
    const jobTitleIndicators = [
      // Common job title prefixes
      /^(Senior|Lead|Principal|Junior|Associate|Staff|Chief|Head|Vice|Assistant|Deputy)\s+(.+)$/i,
      // Common job title suffixes
      /^(.+)\s+(Manager|Director|Supervisor|Coordinator|Specialist|Analyst|Engineer|Developer|Designer|Consultant|Administrator|Assistant|Representative|Officer|Technician)$/i,
      // Specific professional titles
      /^(Software|Web|Data|Product|Project|Marketing|Sales|HR|Finance|Operations|Business|Technical|System|Network|Database|Security|Quality|Customer|Account)\s+(Engineer|Developer|Manager|Analyst|Specialist|Coordinator|Director|Consultant|Administrator)$/i
    ];
    
    // Check if line looks like a job title
    for (const pattern of jobTitleIndicators) {
      if (pattern.test(line)) {
        // Additional validation
        if (this.isValidJobTitle(line)) {
          return line;
        }
      }
    }
    
    return null;
  }

  isValidJobTitle(title) {
    // Should be reasonable length
    if (title.length < 5 || title.length > 80) {
      return false;
    }
    
    // Shouldn't contain obvious non-title indicators
    const invalidIndicators = [
      /@/, // Email
      /http/, // URL
      /\d{4}/, // Years (likely dates)
      /^\d+$/, // Only numbers
      /^[A-Z]{3,}$/, // All caps acronyms only
      /\b(years|months|present|current|from|to|at|in|on|the|and|or|but|with|for|by)\b/i
    ];
    
    return !invalidIndicators.some(pattern => pattern.test(title));
  }

  extractCompanyFromLine(line) {
    // Company name patterns
    const companyIndicators = [
      /^(.+(?:Inc|LLC|Corp|Ltd|Company|Group|Solutions|Technologies|Systems|Services|Studios|Consulting|Partners|Associates|Enterprises|Industries))\.?$/i,
      /^([A-Z][A-Za-z\s&,.-]{3,60})$/ // General capitalized text
    ];
    
    for (const pattern of companyIndicators) {
      const match = line.match(pattern);
      if (match && this.isValidCompanyName(match[1] || match[0])) {
        return match[1] || match[0];
      }
    }
    
    return null;
  }

  isValidCompanyName(name) {
    // Should be reasonable length
    if (name.length < 3 || name.length > 100) {
      return false;
    }
    
    // Shouldn't contain date patterns or obvious non-company indicators
    const invalidPatterns = [
      /\b(19|20)\d{2}\b/, // Years
      /\b(present|current|from|to|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
      /@/, // Email
      /http/, // URL
      /^(and|or|the|with|for|in|on|at|by|from|to|years|months|present|current)$/i
    ];
    
    return !invalidPatterns.some(pattern => pattern.test(name));
  }

  extractDatesFromLine(line) {
    // Date patterns for work experience
    const datePatterns = [
      // "January 2020 - Present"
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s*[-–—]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present|Current)\b/i,
      // "2020 - 2023"
      /\b(\d{4})\s*[-–—]\s*(\d{4}|Present|Current)\b/i,
      // "Jan 2020 - Dec 2023"
      /\b([A-Za-z]{3}\s+\d{4})\s*[-–—]\s*([A-Za-z]{3}\s+\d{4}|Present|Current)\b/i
    ];
    
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          start: match[1],
          end: match[2]
        };
      }
    }
    
    return null;
  }

  extractWorkExperienceFallback(text) {
    const experiences = [];
    const lines = text.split('\n');
    
    // Look for job titles throughout the document
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const jobTitle = this.extractJobTitleFromLine(line);
      
      if (jobTitle) {
        const experience = {
          title: jobTitle,
          company: null,
          start_date: null,
          end_date: null,
          description: ''
        };
        
        // Look for company and dates in nearby lines
        for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
          const nearbyLine = lines[j].trim();
          
          if (!experience.company) {
            experience.company = this.extractCompanyFromLine(nearbyLine);
          }
          
          if (!experience.start_date) {
            const dates = this.extractDatesFromLine(nearbyLine);
            if (dates) {
              experience.start_date = dates.start;
              experience.end_date = dates.end;
            }
          }
        }
        
        experiences.push(experience);
      }
    }
    
    return experiences;
  }

  // Calculate years of experience
  calculateTotalExperience(workExperience) {
    if (!Array.isArray(workExperience) || workExperience.length === 0) {
      return 0;
    }
    
    let totalYears = 0;
    const currentYear = new Date().getFullYear();
    
    for (const exp of workExperience) {
      if (exp.start_date) {
        const startYear = this.extractYearFromDate(exp.start_date);
        let endYear = currentYear;
        
        if (exp.end_date && !['Present', 'Current'].includes(exp.end_date)) {
          endYear = this.extractYearFromDate(exp.end_date);
        }
        
        if (startYear && endYear && endYear >= startYear) {
          totalYears += (endYear - startYear);
        }
      }
    }
    
    return Math.max(0, totalYears);
  }

  extractYearFromDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }

  // Generate summary from extracted information
  generateSummary(text, extractedData) {
    // Try to find existing summary first
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const summarySection = this.findSection(lines, ['summary', 'profile', 'objective', 'about', 'overview']);
    
    if (summarySection.found && summarySection.content.length > 0) {
      const summaryText = summarySection.content.join(' ').trim();
      if (summaryText.length > 20 && summaryText.length < 500) {
        return summaryText;
      }
    }
    
    // Generate summary from extracted data
    const { skills, work_experience, years_experience } = extractedData;
    
    let summary = 'Professional';
    
    if (years_experience > 0) {
      summary += ` with ${years_experience} years of experience`;
    }
    
    if (skills && skills.length > 0) {
      const topSkills = skills.slice(0, 3).map(s => s.name).join(', ');
      summary += ` skilled in ${topSkills}`;
    }
    
    if (work_experience && work_experience.length > 0) {
      const recentRole = work_experience[0];
      if (recentRole.title) {
        summary += `. Most recently worked as ${recentRole.title}`;
        if (recentRole.company) {
          summary += ` at ${recentRole.company}`;
        }
      }
    }
    
    summary += '.';
    
    return summary;
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

      // Extract all information
      const { firstName, lastName } = this.extractName(text);
      const contactInfo = this.extractContactInfo(text);
      const skills = this.extractSkills(text);
      const education = this.extractEducation(text);
      const workExperience = this.extractWorkExperience(text);
      const totalExperience = this.calculateTotalExperience(workExperience);
      
      const extractedData = {
        skills,
        work_experience: workExperience,
        years_experience: totalExperience
      };
      
      const summary = this.generateSummary(text, extractedData);
      
      console.log('Parsing completed successfully');
      console.log('Extracted data summary:', {
        name: `${firstName} ${lastName}`,
        email: contactInfo.email,
        phone: contactInfo.phone,
        skillsCount: skills.length,
        educationCount: education.length,
        workExperienceCount: workExperience.length,
        totalExperience
      });

      return {
        first_name: firstName || '',
        last_name: lastName || '',
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
module.exports = new CVParser();