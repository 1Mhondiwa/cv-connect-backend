// services/cvParser.js
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const nlp = require('compromise');
const mammoth = require('mammoth');
const logger = require('../utils/logger');

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
      logger.error('Error extracting text:', error);
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
      
      logger.cv(`PDF text extracted: ${text.length} characters`);
      return text;
    } catch (error) {
      logger.error('PDF parsing error:', error);
      throw new Error("PDF parsing failed. Please check the file format.");
    }
  }

  async extractTxtText(filePath) {
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      const cleanedText = this.cleanExtractedText(text, 'txt');
      logger.cv(`TXT text extracted: ${cleanedText.length} characters`);
      return cleanedText;
    } catch (error) {
      logger.error('TXT parsing error:', error);
      throw new Error("TXT parsing failed. Please check the file format.");
    }
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
      
      logger.cv(`DOCX text extracted: ${text.length} characters`);
      return text;
    } catch (error) {
      logger.error('DOCX parsing error:', error);
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
    
    // Clean up excessive newlines that are not between paragraphs
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
      return { email: null, phone: null, linkedin_url: null, github_url: null, address: null };
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
    
    // Address extraction
    const address = this.extractAddressFromText(text);
    if (address) {
      contactInfo.address = address;
    }
    
    return contactInfo;
  }

  // Extract address from CV text
  extractAddressFromText(text) {
    console.log('Extracting address from CV text...');
    
    if (!text || typeof text !== 'string') {
      console.log('No text provided for address extraction');
      return null;
    }

    const lines = text.split('\n');
    
    // Look for explicit address patterns
    const addressPatterns = [
      // "Address: [address content]"
      /^(?:Address|Location|Residence|Home):\s*(.+)$/i,
      // Line starting with address indicators
      /^(?:Address|Location|Residence|Home)\s*[:\-]?\s*(.+)$/i
    ];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check explicit address patterns
      for (const pattern of addressPatterns) {
        const match = trimmedLine.match(pattern);
        if (match && match[1]) {
          const address = match[1].trim();
          if (this.looksLikeAddress(address)) {
            console.log(`Found address with pattern: "${address}"`);
            return address;
          }
        }
      }
    }

    // Look for address-like patterns in contact sections
    const contactSectionKeywords = ['contact', 'personal', 'information', 'details'];
    const contactLines = [];
    let inContactSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();
      
      // Check if we're entering a contact section
      if (contactSectionKeywords.some(keyword => line.includes(keyword))) {
        inContactSection = true;
        continue;
      }
      
      // Check if we're leaving the contact section
      if (inContactSection && this.looksLikeSectionHeader(lines[i])) {
        break;
      }
      
      if (inContactSection) {
        contactLines.push(lines[i].trim());
      }
    }

    // Look for address-like content in contact section
    for (const line of contactLines) {
      if (this.looksLikeAddress(line) && !line.includes('@') && !line.includes('http')) {
        console.log(`Found address in contact section: "${line}"`);
        return line;
      }
    }

    console.log('No address found in CV text');
    return null;
  }

  // Check if a line looks like an address
  looksLikeAddress(line) {
    if (!line || line.length < 10 || line.length > 200) {
      return false;
    }

    // Address indicators
    const addressIndicators = [
      // Common address components
      /\b(street|avenue|road|drive|lane|boulevard|ave|st|rd|dr|ln|blvd)\b/i,
      /\b(apartment|apt|unit|suite|ste|floor|fl)\b/i,
      // Postal codes and zip codes
      /\b\d{5}(-\d{4})?\b/, // US ZIP codes
      /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/, // Canadian postal codes
      /\b\d{4,6}\b/, // Generic postal codes
      // Countries and common city patterns
      /\b(south africa|usa|canada|uk|united states|united kingdom)\b/i,
      /\b(johannesburg|cape town|durban|pretoria|new york|london|toronto)\b/i,
      // Address structure patterns
      /\d+\s+[A-Za-z]/i, // Number followed by street name
      /,\s*[A-Za-z]+\s*,/, // City, State/Province, pattern
      /,\s*\d{4,6}/, // Ends with postal code
    ];

    // Exclusion patterns (things that are NOT addresses)
    const exclusionPatterns = [
      /^(email|phone|linkedin|github|website|url):/i,
      /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // Email addresses
      /^https?:\/\//, // URLs
      /^[\d\s\-\+\(\)]+$/, // Only numbers and phone symbols
      /^[A-Z\s]{3,30}$/, // All caps headers
    ];

    // Check exclusions first
    if (exclusionPatterns.some(pattern => pattern.test(line))) {
      return false;
    }

    // Check for address indicators
    return addressIndicators.some(pattern => pattern.test(line));
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
    
    console.log('Starting skills extraction...');
    
    // Primary method: Find dedicated skills section
    const skillsSection = this.findSection(lines, this.getSkillsKeywords());
    
    if (skillsSection.found) {
      console.log('Found skills section, extracting from section only...');
      skills = this.parseSkillsFromSection(skillsSection.content);
      console.log(`Extracted ${skills.length} skills from section`);
      
      // If we found a skills section, ONLY use skills from that section
      // Do not fall back to other methods to avoid contamination
      return this.deduplicateSkills(skills).slice(0, 20);
    }
    
    console.log('No skills section found, trying document-wide extraction...');
    // Only use broader extraction if NO skills section was found
    skills = this.extractSkillsFromEntireDocument(lines);
    
    // Final fallback: Use known skills database only if still no skills found
    if (skills.length === 0) {
      console.log('No skills found, using fallback database...');
      skills = this.extractSkillsFallback(text);
    }
    
    console.log(`Final skills count: ${skills.length}`);
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
    
    // Identify sections to avoid extracting skills from
    const sectionsToAvoid = this.identifyNonSkillsSections(lines);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip if line is too short or too long
      if (line.length < 3 || line.length > 200) continue;
      
      // Skip if we're in a section where skills shouldn't be extracted
      if (this.isInAvoidedSection(i, sectionsToAvoid)) {
        continue;
      }
      
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

  identifyNonSkillsSections(lines) {
    const sections = [];
    const avoidSectionKeywords = [
      'work experience', 'experience', 'employment', 'job history', 'career history',
      'education', 'academic', 'qualifications', 'degree', 'university', 'college',
      'professional summary', 'summary', 'objective', 'profile', 'about',
      'references', 'contact', 'personal information', 'contact information'
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase().trim();
      
      // Check if this line is a section header we should avoid
      if (this.looksLikeSectionHeader(lines[i])) {
        for (const keyword of avoidSectionKeywords) {
          if (this.matchesSectionKeyword(line, keyword)) {
            // Find the end of this section
            let endIndex = lines.length;
            for (let j = i + 1; j < lines.length; j++) {
              if (this.looksLikeSectionHeader(lines[j])) {
                endIndex = j;
                break;
              }
            }
            
            sections.push({
              keyword: keyword,
              start: i,
              end: endIndex
            });
            break;
          }
        }
      }
    }
    
    return sections;
  }

  isInAvoidedSection(lineIndex, sectionsToAvoid) {
    return sectionsToAvoid.some(section => 
      lineIndex > section.start && lineIndex < section.end
    );
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
    
    console.log('Looking for section with keywords:', keywords);
    
    // Find section start - be more precise about section headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lowerLine = line.toLowerCase();
      
      console.log(`Checking line ${i}: "${line}"`);
      
      // Check if this line is a section header (short line, likely all caps or title case)
      if (this.looksLikeSectionHeader(line)) {
        // Check if it matches our keywords
        if (keywords.some(keyword => this.matchesSectionKeyword(lowerLine, keyword.toLowerCase()))) {
          startIndex = i;
          console.log(`Found section header at line ${i}: "${line}"`);
          break;
        }
      }
    }
    
    if (startIndex === -1) {
      console.log('Section not found');
      return { found: false, content: [] };
    }
    
    // Find section end - look for ANY section header after the start
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Any line that looks like a section header should end the current section
      if (this.looksLikeSectionHeader(line)) {
        endIndex = i;
        console.log(`Found section end at line ${i}: "${line}"`);
        break;
      }
    }
    
    const content = lines.slice(startIndex + 1, endIndex);
    console.log(`Section content has ${content.length} lines`);
    
    return {
      found: true,
      content: content,
      startIndex,
      endIndex
    };
  }

  // More precise section keyword matching
  matchesSectionKeyword(lineLower, keyword) {
    // Exact match
    if (lineLower === keyword) return true;
    
    // Match with colon
    if (lineLower === keyword + ':') return true;
    
    // Match at start with colon
    if (lineLower.startsWith(keyword + ':')) return true;
    
    // For multi-word keywords, check if the line contains the exact phrase
    if (keyword.includes(' ')) {
      return lineLower.includes(keyword);
    }
    
    // For single words, be more strict
    return lineLower === keyword || lineLower === keyword + ':';
  }

  getCommonSectionHeaders() {
    return [
      'work experience', 'experience', 'work', 'employment', 'job history', 'career history',
      'education', 'academic', 'qualifications', 'degrees',
      'projects', 'achievements', 'awards', 'certifications', 'licenses',
      'languages', 'language skills',
      'references', 'contact', 'personal', 'interests', 'hobbies',
      'summary', 'objective', 'profile', 'about'
    ];
  }

  parseSkillsFromSection(lines) {
    const skills = [];
    
    console.log('Parsing skills from section with', lines.length, 'lines');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      console.log(`Processing skills line: "${trimmedLine}"`);
      
      if (this.isSkillLine(trimmedLine)) {
        const extractedSkills = this.extractSkillsFromLine(trimmedLine);
        console.log(`Extracted skills from line: ${extractedSkills.map(s => s.name).join(', ')}`);
        
        // Additional validation: filter out obvious non-skills
        const validSkills = extractedSkills.filter(skill => this.isValidSkillInSkillsSection(skill.name));
        skills.push(...validSkills);
      } else {
        console.log('Line not considered a skill line');
      }
    }
    
    console.log('Final skills from section:', skills.map(s => s.name));
    return this.deduplicateSkills(skills);
  }

  // Additional validation for skills found in skills section
  isValidSkillInSkillsSection(skillName) {
    if (!skillName || skillName.length < 2) {
      return false;
    }
    
    // Exclude things that are clearly not skills
    const nonSkillPatterns = [
      // Job titles
      /^(Lead|Senior|Junior|Assistant|Apprentice|Manager|Director|Supervisor|Coordinator)$/i,
      
      // Company related
      /^(Rainbow|Coatings|Artisan|Fresh|Coat|Decorators|Services|Company|Inc|Ltd|Corp)$/i,
      
      // Locations
      /^(Johannesburg|Pretoria|Cape Town|Durban|Port Elizabeth|Bloemfontein|East London|Polokwane|Kimberley|Nelspruit)$/i,
      
      // Dates and time
      /^(January|February|March|April|May|June|July|August|September|October|November|December|Present|Current|Years?|Months?|Days?)$/i,
      
      // Common words that aren't skills
      /^(Experience|Expert|Advanced|Intermediate|Beginner|Proficient|Knowledge|Ability|Years)$/i,
      
      // Single letters or very short words
      /^[a-zA-Z]$/,
      
      // Numbers only
      /^\d+$/
    ];
    
    const isNonSkill = nonSkillPatterns.some(pattern => pattern.test(skillName));
    
    if (isNonSkill) {
      console.log(`Filtering out non-skill: "${skillName}"`);
      return false;
    }
    
    return true;
  }

  isSkillLine(line) {
    // Skip separator lines and headers
    if (line.includes('---') || line.includes('===') || line.length === 0) {
      return false;
    }
    
    // Skip lines that look like section headers
    if (this.looksLikeSectionHeader(line)) {
      return false;
    }
    
    // IMPORTANT: Lines starting with bullet points are likely skills in a skills section
    if (/^[•\-\*\+]/.test(line.trim())) {
      // But make sure they're not work experience bullet points
      if (this.looksLikeJobDescription(line)) {
        return false;
      }
      // If it's a bullet point but not a job description, it's likely a skill
      return true;
    }
    
    // Skip lines that contain dates (likely not skills)
    if (/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/.test(line)) {
      return false;
    }
    
    // Skip lines that contain "Present" or date ranges
    if (/\b(Present|Current)\b|\d{4}\s*[-–]\s*(\d{4}|Present|Current)/i.test(line)) {
      return false;
    }
    
    // Skip obvious job titles
    if (this.looksLikeJobTitle(line)) {
      return false;
    }
    
    // Skip obvious company names
    if (this.looksLikeCompany(line)) {
      return false;
    }
    
    return true;
  }

  extractSkillsFromLine(line) {
    const skills = [];
    
    // Remove common prefixes and clean the line
    let cleanLine = line.replace(/^[•\-\*\+\d\.]\s*/, '').trim();
    cleanLine = cleanLine.replace(/^(Skills?|Technologies?|Tools?|Software|Frameworks?|Languages?):\s*/i, '').trim();
    
    // Pattern 1: "Interior & Exterior Painting - Expert - 10 years"
    const expertisePattern = /^([A-Za-z\s\.#\+\-&]+?)\s*[-–]\s*(Expert|Advanced|Intermediate|Beginner|Proficient|Experienced?)\s*(?:[-–]\s*(\d+)\s*years?)?/gi;
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
    // Don't split compound skills connected with &
    if (line.includes('&')) {
      return false;
    }
    
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
    
    console.log('Parsing education from section with', lines.length, 'lines');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      console.log(`Processing education line: "${trimmedLine}"`);
      
      if (trimmedLine.length === 0 || trimmedLine.includes('---')) {
        console.log('Skipping empty or separator line');
        continue;
      }
      
      // Skip bullet points that look like achievements or activities
      if (trimmedLine.startsWith('•') && this.looksLikeAchievement(trimmedLine)) {
        console.log('Skipping achievement/activity line');
        continue;
      }
      
      const degreeMatch = this.extractDegreeFromLine(trimmedLine);
      if (degreeMatch) {
        console.log(`Found degree: ${degreeMatch.degree}`);
        if (currentEntry) {
          console.log(`Completing previous entry: ${currentEntry.degree}`);
          education.push(currentEntry);
        }
        currentEntry = degreeMatch;
      } else if (currentEntry) {
        // Try to extract institution or year
        const institution = this.extractInstitutionFromLine(trimmedLine);
        const year = this.extractYearFromLine(trimmedLine);
        
        if (institution && !currentEntry.institution) {
          console.log(`Adding institution: ${institution}`);
          currentEntry.institution = institution;
        }
        if (year && !currentEntry.year) {
          console.log(`Adding year: ${year}`);
          currentEntry.year = year;
        }
      } else {
        console.log('No current entry, skipping line');
      }
    }
    
    if (currentEntry) {
      console.log(`Completing final entry: ${currentEntry.degree}`);
      education.push(currentEntry);
    }
    
    console.log(`Final education entries: ${education.length}`);
    return education;
  }

  looksLikeAchievement(line) {
    // Check if this line looks like an achievement, activity, or distinction rather than education
    const achievementIndicators = [
      // Academic achievements
      /\b(distinction|honor|honours|award|prize|merit|excellence|achievement)\b/i,
      // Activities and roles
      /\b(member|president|captain|treasurer|secretary|leader|representative|participant)\b/i,
      // Sports and clubs
      /\b(team|club|society|association|sport|soccer|football|basketball|rugby|cricket|tennis)\b/i,
      // Specific achievement patterns
      /\b(first\s+team|dean'?s\s+list|magna\s+cum\s+laude|summa\s+cum\s+laude|cum\s+laude)\b/i,
      // GPA or grade indicators
      /\b(gpa|grade|score|percentage|%)\b/i
    ];
    
    return achievementIndicators.some(pattern => pattern.test(line));
  }

  extractDegreeFromLine(line) {
    const degreePatterns = [
      // Standard degrees
      /(Bachelor|B\.?A\.?|B\.?S\.?|B\.?Sc\.?|B\.?Tech\.?|B\.?E\.?|B\.?Eng\.?)\s*(?:of\s+|in\s+)?(.+)/i,
      /(Master|M\.?A\.?|M\.?S\.?|M\.?Sc\.?|M\.?Tech\.?|M\.?E\.?|M\.?Eng\.?)\s*(?:of\s+|in\s+)?(.+)/i,
      /(MBA|M\.?B\.?A\.?|Master\s+of\s+Business\s+Administration)\s*(?:in\s+)?(.+)?/i,
      /(Ph\.?D\.?|PhD|Doctorate|Doctor)\s*(?:in\s+)?(.+)?/i,
      // More specific Associate pattern - must be at start of line or after whitespace
      /^(Associate\s+Degree|Associate|A\.?A\.?|A\.?S\.?)\s*(?:of\s+|in\s+)?(.+)/i,
      // Diploma and Certificate - be more specific about structure
      /^(Diploma|Certificate)\s+(?:in\s+|of\s+)?(.+)/i,
      // High school - very specific
      /^(High\s+School\s+Diploma|Secondary\s+School|GED|Matriculation|Matric)/i
    ];
    
    console.log(`Checking line for degree patterns: "${line}"`);
    
    for (let i = 0; i < degreePatterns.length; i++) {
      const pattern = degreePatterns[i];
      const match = line.match(pattern);
      if (match) {
        const result = {
          degree: match[0].trim(),
          field: match[2] ? match[2].trim() : '',
          institution: null,
          year: null
        };
        console.log(`Pattern ${i} matched: degree="${result.degree}", field="${result.field}"`);
        return result;
      }
    }
    
    console.log('No degree pattern matched');
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
    let experiences = [];
    
    // Primary method: Find dedicated experience section
    const experienceSection = this.findSection(lines, this.getExperienceKeywords());
    
    if (experienceSection.found) {
      console.log('Found work experience section, parsing...');
      experiences = this.parseExperienceFromSection(experienceSection.content);
      console.log(`Extracted ${experiences.length} experiences from section`);
    }
    
    // Only use fallback if we found no experiences at all AND there's a clear work experience section missing
    if (experiences.length === 0 && !experienceSection.found) {
      console.log('No experience section found, trying fallback...');
      experiences = this.extractWorkExperienceFromEntireDocument(lines);
      console.log(`Extracted ${experiences.length} experiences from fallback`);
    }
    
    // Limit to reasonable number and validate
    return experiences.slice(0, 6);
  }

  getExperienceKeywords() {
    return [
      'work experience', 'professional experience', 'career history', 'employment history',
      'work history', 'employment', 'job history', 'professional background', 'career background',
      'experience' // Keep this last as it's most general
    ];
  }

  parseExperienceFromSection(lines) {
    const experiences = [];
    let currentExp = null;
    let descriptionLines = [];
    let i = 0;
    
    console.log('Parsing experience section with', lines.length, 'lines');
    
    while (i < lines.length) {
      const trimmedLine = lines[i].trim();
      
      if (trimmedLine.length === 0 || trimmedLine.includes('---') || trimmedLine.includes('===')) {
        i++;
        continue;
      }
      
      console.log(`Processing line ${i}: "${trimmedLine}"`);
      
      // Check if we've hit a new section header (this means we should stop)
      if (this.looksLikeSectionHeader(trimmedLine) && i > 0) {
        console.log('Hit section header, stopping:', trimmedLine);
        break;
      }
      
      // Try to detect a new work experience entry (but be more conservative)
      const detectedEntry = this.detectWorkExperienceEntryStrict(lines, i);
      
      if (detectedEntry.isNewEntry) {
        console.log('Detected new experience entry:', detectedEntry.title);
        
        // Save previous experience if exists
        if (currentExp) {
          currentExp.description = descriptionLines.join(' ').trim();
          experiences.push(currentExp);
        }
        
        // Start new experience
        currentExp = {
          title: detectedEntry.title || '',
          company: detectedEntry.company || null,
          start_date: detectedEntry.start_date || null,
          end_date: detectedEntry.end_date || null,
          description: ''
        };
        descriptionLines = [];
        
        // Skip the lines we've processed
        i += detectedEntry.linesProcessed;
      } else if (currentExp) {
        // Priority order: company first, then dates, then description
        
        // First priority: extract company if we don't have one
        if (!currentExp.company && this.looksLikeCompany(trimmedLine) && !this.looksLikeJobDescription(trimmedLine)) {
          currentExp.company = trimmedLine;
          console.log('Added company:', trimmedLine);
          i++;
          continue;
        }
        
        // Second priority: extract dates if we don't have them
        if (!currentExp.start_date) {
          const dates = this.extractDatesFromLine(trimmedLine);
          if (dates) {
            currentExp.start_date = dates.start;
            currentExp.end_date = dates.end;
            console.log('Added dates:', dates);
            i++;
            continue;
          }
        }
        
        // Third priority: add to description only if it clearly looks like description content
        if (this.looksLikeJobDescription(trimmedLine) && !this.looksLikeCompany(trimmedLine)) {
          descriptionLines.push(trimmedLine);
          console.log('Added to description:', trimmedLine.substring(0, 50) + '...');
        }
        
        i++;
      } else {
        // No current experience, check if this could start a new one
        if (this.looksLikeJobTitle(trimmedLine)) {
          console.log('Found potential job title without experience context:', trimmedLine);
          // Only accept if it's a very clear job title
          if (this.isVeryLikelyJobTitle(trimmedLine)) {
            currentExp = {
              title: trimmedLine,
              company: null,
              start_date: null,
              end_date: null,
              description: ''
            };
            descriptionLines = [];
          }
        }
        i++;
      }
    }
    
    // Add the last experience
    if (currentExp) {
      currentExp.description = descriptionLines.join(' ').trim();
      experiences.push(currentExp);
    }
    
    console.log('Final experiences extracted:', experiences.length);
    return this.validateAndCleanExperiences(experiences);
  }

  // More conservative detection for within sections
  detectWorkExperienceEntryStrict(lines, startIndex) {
    const line = lines[startIndex].trim();
    let result = {
      isNewEntry: false,
      title: null,
      company: null,
      start_date: null,
      end_date: null,
      linesProcessed: 1
    };
    
    // Only detect job titles that are very likely to be work experience
    if (this.isVeryLikelyJobTitle(line)) {
      result.isNewEntry = true;
      result.title = line;
      
      // Look ahead for company and dates in next few lines
      for (let i = 1; i <= 3 && (startIndex + i) < lines.length; i++) {
        const nextLine = lines[startIndex + i].trim();
        
        // Stop if we hit another section
        if (this.looksLikeSectionHeader(nextLine)) {
          break;
        }
        
        if (!result.company && this.looksLikeCompany(nextLine)) {
          result.company = nextLine;
          result.linesProcessed = Math.max(result.linesProcessed, i + 1);
        }
        
        if (!result.start_date) {
          const dates = this.extractDatesFromLine(nextLine);
          if (dates) {
            result.start_date = dates.start;
            result.end_date = dates.end;
            result.linesProcessed = Math.max(result.linesProcessed, i + 1);
          }
        }
      }
      
      return result;
    }
    
    return result;
  }

  // Very strict job title detection for work experience sections
  isVeryLikelyJobTitle(line) {
    if (!line || line.length < 3 || line.length > 100) {
      return false;
    }
    
    // Clean the line
    const cleanLine = line.replace(/^[•\-\*\+\d\.]\s*/, '').trim();
    
    // Exclude patterns that are definitely not job titles
    const excludePatterns = [
      /@/, // Email
      /http/, // URL
      /^\d+$/, // Only numbers
      /\d{4}[-\/]\d{1,2}/, // Date patterns
      /^(January|February|March|April|May|June|July|August|September|October|November|December)/i,
      /^(Education|Skills|References|Contact|Personal|Objective|Summary|About|Profile|Certifications|Languages|Awards|Interests|Hobbies)/i,
      /\b(years|months|present|current|to|from|until|since|experience|at|in|on|the|and|or|with|for|by)\b/i,
      /^(CONTACT|PROFESSIONAL|EDUCATION|SKILLS|REFERENCES|CERTIFICATIONS|LANGUAGES|AWARDS)/i,
      /Email:|Phone:|Address:|LinkedIn:/i,
      /•/, // Bullet points are usually descriptions, not titles
      /\b(Managed|Developed|Implemented|Created|Designed|Led|Supervised|Coordinated|Executed|Performed|Achieved|Completed|Handled|Maintained|Operated|Assisted|Supported|Improved|Optimized|Responsible)\b/i
    ];
    
    if (excludePatterns.some(pattern => pattern.test(cleanLine))) {
      return false;
    }
    
    // Very specific job title patterns that we're confident about
    const veryLikelyJobTitlePatterns = [
      // Specific painter job titles
      /^(Lead|Senior|Master|Chief|Head|Principal)\s+(Painter)$/i,
      /^(Painter)$/i,
      /^(Apprentice|Junior|Assistant)\s+(Painter)$/i,
      /^(Professional|Commercial|Residential|Industrial)\s+(Painter)$/i,
      
      // Other clear job patterns
      /^(Senior|Lead|Principal|Junior|Assistant|Deputy|Chief|Head|Vice|Executive)\s+[A-Z][a-z]+$/i,
      /^[A-Z][a-z]+\s+(Manager|Director|Supervisor|Coordinator|Specialist|Analyst|Engineer|Developer|Designer|Consultant|Administrator|Representative|Officer|Technician|Lead|Leader)$/i,
      /^(Project|Team|Operations|Sales|Account|Business|Technical)\s+(Manager|Lead|Leader|Coordinator)$/i,
      
      // Simple professional titles
      /^[A-Z][a-z]{2,15}(\s+[A-Z][a-z]{2,15}){0,2}$/  // 1-3 capitalized words, reasonable length
    ];
    
    return veryLikelyJobTitlePatterns.some(pattern => pattern.test(cleanLine));
  }

  detectWorkExperienceEntry(lines, startIndex) {
    const line = lines[startIndex].trim();
    let result = {
      isNewEntry: false,
      title: null,
      company: null,
      start_date: null,
      end_date: null,
      linesProcessed: 1
    };
    
    // Method 1: Check if line looks like a job title
    if (this.looksLikeJobTitle(line)) {
      result.isNewEntry = true;
      result.title = line;
      
      // Look ahead for company and dates in next few lines
      for (let i = 1; i <= 3 && (startIndex + i) < lines.length; i++) {
        const nextLine = lines[startIndex + i].trim();
        
        if (!result.company && this.looksLikeCompany(nextLine)) {
          result.company = nextLine;
          result.linesProcessed = Math.max(result.linesProcessed, i + 1);
        }
        
        if (!result.start_date) {
          const dates = this.extractDatesFromLine(nextLine);
          if (dates) {
            result.start_date = dates.start;
            result.end_date = dates.end;
            result.linesProcessed = Math.max(result.linesProcessed, i + 1);
          }
        }
      }
      
      return result;
    }
    
    // Method 2: Check for combined title and company in one line
    const titleCompanyMatch = this.extractTitleAndCompanyFromLine(line);
    if (titleCompanyMatch) {
      result.isNewEntry = true;
      result.title = titleCompanyMatch.title;
      result.company = titleCompanyMatch.company;
      
      // Look for dates in next lines
      for (let i = 1; i <= 2 && (startIndex + i) < lines.length; i++) {
        const nextLine = lines[startIndex + i].trim();
        const dates = this.extractDatesFromLine(nextLine);
        if (dates) {
          result.start_date = dates.start;
          result.end_date = dates.end;
          result.linesProcessed = i + 1;
          break;
        }
      }
      
      return result;
    }
    
    // Method 3: Check for patterns like "Job Title at Company"
    const atPattern = /^(.+?)\s+at\s+(.+)$/i;
    const atMatch = line.match(atPattern);
    if (atMatch && this.looksLikeJobTitle(atMatch[1]) && this.looksLikeCompany(atMatch[2])) {
      result.isNewEntry = true;
      result.title = atMatch[1].trim();
      result.company = atMatch[2].trim();
      return result;
    }
    
    return result;
  }

  // New flexible method to detect job titles
  looksLikeJobTitle(line) {
    if (!line || line.length < 3 || line.length > 100) {
      return false;
    }
    
    // Clean the line
    const cleanLine = line.replace(/^[•\-\*\+\d\.]\s*/, '').trim();
    
    // Check for obvious non-job title patterns
    const excludePatterns = [
      /@/, // Email
      /http/, // URL
      /^\d+$/, // Only numbers
      /\d{4}[-\/]\d{1,2}/, // Date patterns
      /^(January|February|March|April|May|June|July|August|September|October|November|December)/i,
      /^(Education|Skills|References|Contact|Personal|Objective|Summary)/i,
      /\b(years|months|present|current|to|from|until|since)\b/i
    ];
    
    if (excludePatterns.some(pattern => pattern.test(cleanLine))) {
      return false;
    }
    
    // Positive indicators for job titles
    const jobTitlePatterns = [
      // Standard job title patterns
      /^(Senior|Lead|Principal|Junior|Assistant|Deputy|Chief|Head|Vice|Executive)\s+/i,
      /\s+(Manager|Director|Supervisor|Coordinator|Specialist|Analyst|Engineer|Developer|Designer|Consultant|Administrator|Representative|Officer|Technician|Lead|Leader)$/i,
      /^(Software|Web|Data|Product|Project|Marketing|Sales|HR|Finance|Operations|Business|Technical|System|Network|Database|Security|Quality|Customer|Account)\s+/i,
      
      // Trade and service job patterns
      /^(Lead|Senior|Master|Journeyman|Apprentice)?\s*(Painter|Carpenter|Plumber|Electrician|Mechanic|Technician|Operator|Driver|Worker|Helper|Laborer)/i,
      /\s+(Painter|Carpenter|Plumber|Electrician|Mechanic|Technician|Operator|Driver|Worker|Helper|Laborer)$/i,
      
      // Professional titles
      /^(Professional|Certified|Licensed|Registered)\s+/i,
      /^(Project|Team|Operations|Sales|Account|Business|Technical)\s+(Manager|Lead|Leader|Coordinator)/i,
      
      // Generic patterns
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/, // Capitalized words
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(I{1,3}|1|2|3)$/ // With level indicators
    ];
    
    // Check if it matches any job title pattern
    return jobTitlePatterns.some(pattern => pattern.test(cleanLine));
  }

  looksLikeCompany(line) {
    if (!line || line.length < 2 || line.length > 150) {
      return false;
    }
    
    // Clean the line
    const cleanLine = line.replace(/^[•\-\*\+\d\.]\s*/, '').trim();
    
    // Exclude obvious non-company patterns
    const excludePatterns = [
      /@/, // Email
      /http/, // URL
      /^\d+$/, // Only numbers
      /\d{4}[-\/]\d{1,2}/, // Date patterns but allow company names with locations
      /^(January|February|March|April|May|June|July|August|September|October|November|December)/i,
      /\b(years|months|present|current|to|from|until|since)\b/i,
      /^[•\-\*\+]/, // Bullet points (likely job descriptions)
      /^(Responsibilities|Duties|Achievements|Tasks|Managed|Led|Developed|Implemented|Created|Designed|Supervised|Coordinated|Executed|Performed|Achieved|Completed|Handled|Maintained|Operated|Assisted|Supported|Improved|Optimized)/i
    ];
    
    if (excludePatterns.some(pattern => pattern.test(cleanLine))) {
      return false;
    }
    
    // Positive indicators for companies
    const companyPatterns = [
      // Company suffixes
      /\b(Inc|LLC|Corp|Ltd|Company|Group|Solutions|Technologies|Systems|Services|Studios|Consulting|Partners|Associates|Enterprises|Industries|Foundation|Organization|Institute|Agency|Firm|Office)\b\.?$/i,
      
      // Company names with locations in parentheses (very common format)
      /^[A-Z][A-Za-z\s&,.-]+\s*\([A-Za-z\s,.-]+\)$/,
      
      // Specific business types
      /\b(Painting|Construction|Contracting|Maintenance|Services|Solutions|Coatings|Decorators|Contractors|Builders|Designs|Works|Trading|Engineering|Consulting)\b/i,
      
      // Generic capitalized text (potential company name) - but be more selective
      /^[A-Z][A-Za-z]+(\s+[A-Z][A-Za-z]+)*(\s+\([A-Za-z\s,.-]+\))?$/,
      
      // Two or more capitalized words (typical company format)
      /^[A-Z][a-z]+\s+[A-Z][a-z]+/
    ];
    
    const isCompanyPattern = companyPatterns.some(pattern => pattern.test(cleanLine));
    
    // Additional validation: if it contains typical job action words, it's probably not a company
    const jobActionWords = /\b(managed|led|developed|implemented|created|designed|supervised|coordinated|executed|performed|achieved|completed|handled|maintained|operated|assisted|supported|improved|optimized|specialized|provided|reduced|trained|gained|learned|introduced|ensured)\b/i;
    
    if (jobActionWords.test(cleanLine)) {
      return false;
    }
    
    return isCompanyPattern;
  }

  extractTitleAndCompanyFromLine(line) {
    // Patterns for combined title and company
    const patterns = [
      // "Job Title | Company Name"
      /^(.+?)\s*[\|\-–]\s*(.+)$/,
      // "Job Title, Company Name"
      /^(.+?),\s*(.+)$/,
      // "Job Title - Company Name"
      /^(.+?)\s*[-–]\s*(.+)$/
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        const potentialTitle = match[1].trim();
        const potentialCompany = match[2].trim();
        
        if (this.looksLikeJobTitle(potentialTitle) && this.looksLikeCompany(potentialCompany)) {
          return {
            title: potentialTitle,
            company: potentialCompany
          };
        }
      }
    }
    
    return null;
  }

  looksLikeJobDescription(line) {
    if (!line || line.length < 10) {
      return false;
    }
    
    // Original line for bullet point detection
    const originalLine = line.trim();
    
    // Clean the line for content analysis
    const cleanLine = line.replace(/^[•\-\*\+\d\.]\s*/, '').trim();
    
    // SPECIAL CASE: If line contains skill proficiency indicators, it's NOT a job description
    // Format: "• Skill Name – Level – X years"
    if (/^[•\-\*\+]\s*[A-Za-z\s&]+\s*[–\-]\s*(Expert|Advanced|Intermediate|Beginner|Proficient)\s*[–\-]\s*\d+\s*years?/i.test(originalLine)) {
      return false;
    }
    
    // Strong indicators this is a job description
    const strongDescriptionIndicators = [
      // Starts with action verbs (past tense or present tense) - but not skill-related verbs
      /^(Managed|Led|Developed|Implemented|Created|Designed|Supervised|Coordinated|Executed|Performed|Achieved|Completed|Handled|Maintained|Operated|Assisted|Supported|Improved|Optimized|Specialized|Provided|Reduced|Trained|Gained|Learned|Introduced|Ensured)/i,
      
      // Contains percentage or numbers with specific contexts (not skill years)
      /\d+%|\d+\s*(people|team|projects?|clients?|employees|staff|budget|cost|revenue|sales)/i,
      
      // Multiple sentences (descriptions tend to be longer)
      /\.\s+[A-Z]/, // Period followed by capital letter
      
      // Contains typical job description phrases
      /\b(responsible for|in charge of|worked with|collaborated with|ensured that|resulted in|leading to|managing|overseeing)\b/i
    ];
    
    // Check against clean line (without bullet points)
    if (strongDescriptionIndicators.some(pattern => pattern.test(cleanLine))) {
      return true;
    }
    
    // Additional check for work-related content
    const workRelatedPatterns = [
      /\b(customers|clients|team|staff|projects|systems|processes|procedures|standards|requirements|goals|objectives|quality|efficiency|satisfaction|revenue|budget|sales|management)\b/i
    ];
    
    return workRelatedPatterns.some(pattern => pattern.test(cleanLine));
  }

  validateAndCleanExperiences(experiences) {
    return experiences.filter(exp => {
      // Must have at least a title
      if (!exp.title || exp.title.trim().length < 2) {
        return false;
      }
      
      // Clean up the experience
      exp.title = exp.title.trim();
      if (exp.company) {
        exp.company = exp.company.trim();
      }
      if (exp.description) {
        exp.description = exp.description.trim();
      }
      
      return true;
    });
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

  // Conservative fallback that only looks for very clear work experience patterns
  extractWorkExperienceFromEntireDocument(lines) {
    const experiences = [];
    
    console.log('Using fallback extraction (no clear work experience section found)');
    
    // Only look for very obvious work experience patterns when no section is found
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip if we're clearly in another section
      if (this.isDefinitelyNotWorkExperienceSection(line, lines, i)) {
        continue;
      }
      
      // Only accept very obvious job titles
      if (this.isVeryLikelyJobTitle(line)) {
        console.log('Found potential job title in fallback:', line);
        
        const experience = {
          title: line,
          company: null,
          start_date: null,
          end_date: null,
          description: ''
        };
        
        // Look for company and dates in next few lines only
        for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
          const nextLine = lines[j].trim();
          
          if (!experience.company && this.looksLikeCompany(nextLine)) {
            experience.company = nextLine;
          }
          
          if (!experience.start_date) {
            const dates = this.extractDatesFromLine(nextLine);
            if (dates) {
              experience.start_date = dates.start;
              experience.end_date = dates.end;
            }
          }
        }
        
        // Only add if we found at least a company or dates (to validate it's real work experience)
        if (experience.company || experience.start_date) {
          experiences.push(experience);
          console.log('Added fallback experience:', experience.title);
        }
      }
    }
    
    return this.validateAndCleanExperiences(experiences);
  }

  isDefinitelyNotWorkExperienceSection(line, lines, index) {
    const lowerLine = line.toLowerCase().trim();
    
    // Check if we're in a clearly defined non-work section
    const nonWorkSections = [
      'education', 'academic background', 'qualifications', 'degrees',
      'skills', 'technical skills', 'core competencies', 'abilities',
      'contact information', 'personal information', 'contact details',
      'references', 'professional references',
      'certifications', 'licenses', 'awards', 'achievements',
      'languages', 'language skills',
      'interests', 'hobbies', 'personal interests',
      'objective', 'career objective', 'professional summary', 'summary', 'profile', 'about me',
      'volunteer work', 'volunteer experience', 'community service'
    ];
    
    // Check if current line or recent previous lines indicate we're in a non-work section
    for (let i = Math.max(0, index - 3); i <= index; i++) {
      const checkLine = lines[i] ? lines[i].toLowerCase().trim() : '';
      if (nonWorkSections.some(section => 
        checkLine === section || 
        checkLine === section + ':' ||
        checkLine.startsWith(section + ':')
      )) {
        return true;
      }
    }
    
    return false;
  }

  isInNonWorkSection(line) {
    const nonWorkSectionHeaders = [
      'education', 'skills', 'references', 'contact', 'personal', 'objective', 
      'summary', 'profile', 'languages', 'certifications', 'awards', 'hobbies',
      'interests', 'publications', 'volunteer'
    ];
    
    const lowerLine = line.toLowerCase().trim();
    return nonWorkSectionHeaders.some(header => 
      lowerLine === header || lowerLine.startsWith(header + ':')
    );
  }

  looksLikeSectionHeader(line) {
    if (!line || line.length < 3 || line.length > 80) {
      return false;
    }
    
    const trimmedLine = line.trim();
    
    // Check if it looks like a section header by structure
    const structuralIndicators = [
      // All uppercase (common for section headers)
      /^[A-Z\s]+$/,
      // Title Case with common section words
      /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/,
      // Contains colon (common for headers)
      /:$/,
      // Starts with capital and ends with colon
      /^[A-Z][A-Za-z\s]+:$/
    ];
    
    const hasStructuralIndicator = structuralIndicators.some(pattern => pattern.test(trimmedLine));
    
    if (!hasStructuralIndicator) {
      return false;
    }
    
    // Known section headers
    const sectionHeaders = [
      'work experience', 'experience', 'employment', 'career history', 'professional experience', 'job history',
      'education', 'academic background', 'qualifications', 'academic qualifications',
      'skills', 'technical skills', 'core competencies', 'professional skills', 'key skills', 'expertise', 'abilities',
      'references', 'contact information', 'personal information', 'contact details', 'contact',
      'objective', 'summary', 'profile', 'about me', 'professional summary', 'career objective',
      'certifications', 'licenses', 'awards', 'achievements', 'honors',
      'languages', 'language skills', 'interests', 'hobbies', 'volunteer work', 'volunteer experience',
      'projects', 'personal projects', 'side projects'
    ];
    
    const lowerLine = trimmedLine.toLowerCase().replace(/:$/, '');
    
    // Check if it matches known section headers
    const isKnownSection = sectionHeaders.some(header => 
      lowerLine === header || 
      lowerLine === header + ':' ||
      lowerLine.startsWith(header + ':') ||
      lowerLine.endsWith(header)
    );
    
    // Additional check: if it's all caps and reasonable length, it's likely a header
    const isAllCapsHeader = /^[A-Z\s]{3,40}$/.test(trimmedLine) && !trimmedLine.includes('@') && !trimmedLine.includes('http');
    
    return isKnownSection || isAllCapsHeader;
  }

  // Extract years of experience from CV text
  extractYearsOfExperienceFromText(text) {
    console.log('Extracting years of experience from CV text...');
    
    if (!text || typeof text !== 'string') {
      console.log('No text provided for years extraction');
      return null;
    }

    // Look for patterns like "X years of experience", "X+ years", etc.
    const experiencePatterns = [
      /(\d+)\+?\s*years?\s+of\s+experience/i,
      /(\d+)\+?\s*years?\s+experience/i,
      /experience\s+of\s+(\d+)\+?\s*years?/i,
      /with\s+(\d+)\+?\s*years?\s+of\s+experience/i,
      /(\d+)\+?\s*years?\s+in\s+/i,
      /over\s+(\d+)\+?\s*years?\s+/i,
      /more\s+than\s+(\d+)\+?\s*years?\s+/i
    ];

    for (const pattern of experiencePatterns) {
      const match = text.match(pattern);
      if (match) {
        const years = parseInt(match[1]);
        if (years > 0 && years <= 50) { // Reasonable range
          console.log(`Found years of experience in text: ${years} years (pattern: "${match[0]}")`);
          return years;
        }
      }
    }

    console.log('No years of experience pattern found in text');
    return null;
  }

  // Calculate years of experience (fallback method)
  calculateTotalExperience(workExperience) {
    console.log('Calculating total experience from work history...');
    
    if (!Array.isArray(workExperience) || workExperience.length === 0) {
      console.log('No work experience provided for calculation');
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
          const yearsDiff = endYear - startYear;
          console.log(`Work experience: ${exp.title} (${startYear}-${endYear}) = ${yearsDiff} years`);
          totalYears += yearsDiff;
        }
      }
    }
    
    console.log(`Total calculated experience: ${totalYears} years`);
    return Math.max(0, totalYears);
  }

  // Determine years of experience (prioritize CV text over calculation)
  determineYearsOfExperience(text, workExperience) {
    console.log('Determining years of experience...');
    
    // FIRST: Try to extract from CV text (professional summary, etc.)
    const extractedYears = this.extractYearsOfExperienceFromText(text);
    if (extractedYears !== null) {
      console.log(`Using extracted years from CV text: ${extractedYears}`);
      return extractedYears;
    }
    
    // FALLBACK: Calculate from work experience dates
    const calculatedYears = this.calculateTotalExperience(workExperience);
    console.log(`Using calculated years from work history: ${calculatedYears}`);
    return calculatedYears;
  }

  extractYearFromDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    
    const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }

  // Extract summary from CV text
  extractSummary(text) {
    console.log('Starting summary extraction...');
    
    if (!text || typeof text !== 'string') {
      console.log('No text provided for summary extraction');
      return null;
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const summaryKeywords = [
      'professional summary', 'summary', 'profile', 'objective', 'about', 'overview',
      'career objective', 'professional profile', 'professional overview'
    ];
    
    console.log('Looking for summary section with keywords:', summaryKeywords);
    const summarySection = this.findSection(lines, summaryKeywords);
    
    if (summarySection.found && summarySection.content.length > 0) {
      console.log(`Found summary section with ${summarySection.content.length} lines`);
      console.log('Summary content lines:', summarySection.content);
      
      // Join the content and clean it up
      let summaryText = summarySection.content
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' ')
        .trim();
      
      // Clean up any extra whitespace
      summaryText = summaryText.replace(/\s+/g, ' ');
      
      console.log(`Extracted summary text (${summaryText.length} chars): "${summaryText}"`);
      
      // Validate summary length and content
      if (summaryText.length > 20 && summaryText.length < 1000) {
        console.log('Summary validation passed');
        return summaryText;
      } else {
        console.log(`Summary validation failed - length: ${summaryText.length}`);
      }
    } else {
      console.log('No summary section found');
    }
    
    return null;
  }

  // Generate summary from extracted information (fallback only)
  generateSummary(text, extractedData) {
    // FIRST: Try to extract actual summary from CV
    const extractedSummary = this.extractSummary(text);
    if (extractedSummary) {
      console.log('Using extracted summary from CV');
      return extractedSummary;
    }
    
    console.log('No summary found in CV, generating fallback summary');
    
    // FALLBACK: Generate summary from extracted data
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

  // Extract professional headline/title from CV
  extractHeadline(text, workExperience) {
    console.log('Starting headline extraction...');
    
    if (!text || typeof text !== 'string') {
      console.log('No text provided for headline extraction');
      return null;
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Strategy 1: Look for professional titles near the top of CV (after name)
    const topSectionHeadline = this.extractHeadlineFromTop(lines);
    if (topSectionHeadline) {
      console.log('Found headline from top section:', topSectionHeadline);
      return topSectionHeadline;
    }
    
    // Strategy 2: Extract from professional summary/objective sections  
    const summaryHeadline = this.extractHeadlineFromSummary(lines);
    if (summaryHeadline) {
      console.log('Found headline from summary section:', summaryHeadline);
      return summaryHeadline;
    }
    
    // Strategy 3: Use most recent job title from work experience
    if (workExperience && workExperience.length > 0) {
      const recentTitle = workExperience[0].title;
      if (recentTitle && this.isValidHeadline(recentTitle)) {
        console.log('Using most recent job title as headline:', recentTitle);
        return recentTitle;
      }
    }
    
    console.log('No suitable headline found');
    return null;
  }

  // Extract headline from top section of CV (near name)
  extractHeadlineFromTop(lines) {
    // Look in first 15 lines for potential headlines
    const searchLines = lines.slice(0, Math.min(15, lines.length));
    
    for (let i = 0; i < searchLines.length; i++) {
      const line = searchLines[i].trim();
      
      // Skip obviously non-headline content
      if (this.isObviouslyNotHeadline(line)) {
        continue;
      }
      
      // Check if this line looks like a professional title
      if (this.looksLikeProfessionalHeadline(line)) {
        return this.cleanHeadline(line);
      }
    }
    
    return null;
  }

  // Extract headline from summary/objective sections
  extractHeadlineFromSummary(lines) {
    const summaryKeywords = [
      'professional summary', 'summary', 'profile', 'objective', 'about', 'overview',
      'career objective', 'professional profile', 'professional overview'
    ];
    
    const summarySection = this.findSection(lines, summaryKeywords);
    
    if (summarySection.found && summarySection.content.length > 0) {
      // Look for job titles mentioned in the summary
      for (const line of summarySection.content) {
        const headlineMatch = this.extractHeadlineFromSummaryLine(line);
        if (headlineMatch) {
          return headlineMatch;
        }
      }
    }
    
    return null;
  }

  // Extract headline from a summary line
  extractHeadlineFromSummaryLine(line) {
    // Patterns to find titles in summary text
    const patterns = [
      // "I am a Software Developer with..."
      /(?:I am|I'm)\s+(?:a|an)\s+([^,\.]+?)(?:\s+with|\s+who|\s+that|,|\.)/i,
      // "Experienced Software Developer with..."
      /^((?:Experienced|Senior|Lead|Junior|Professional|Certified|Skilled)\s+[^,\.]+?)(?:\s+with|\s+who|\s+that|,|\.)/i,
      // "Software Developer with 5 years..."
      /^([^,\.]+?)\s+with\s+\d+\s+years?/i,
      // "As a Software Developer, I..."
      /(?:As|Being)\s+(?:a|an)\s+([^,\.]+?)(?:,|\.|I)/i
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const potentialTitle = match[1].trim();
        if (this.isValidHeadline(potentialTitle)) {
          return this.cleanHeadline(potentialTitle);
        }
      }
    }
    
    return null;
  }

  // Check if line looks like a professional headline
  looksLikeProfessionalHeadline(line) {
    const cleanLine = line.replace(/^[•\-\*\+\d\.]\s*/, '').trim();
    
    // Should be reasonable length for a title
    if (cleanLine.length < 3 || cleanLine.length > 80) {
      return false;
    }
    
    // Professional title patterns
    const titlePatterns = [
      // Standard professional titles
      /^(Senior|Lead|Principal|Junior|Assistant|Chief|Head|Vice|Executive)\s+/i,
      /\s+(Developer|Engineer|Designer|Manager|Director|Analyst|Specialist|Consultant|Administrator|Coordinator|Supervisor|Technician)$/i,
      
      // Field-specific titles
      /^(Software|Web|Data|Product|Project|Marketing|Sales|HR|Finance|Operations|Business|Technical|System|Network|Database|Security|Quality|Customer|Account)\s+/i,
      
      // Trade/skilled worker titles - flexible patterns
      /^(Lead|Senior|Master|Journeyman|Apprentice)?\s*(Painter|Carpenter|Plumber|Electrician|Mechanic|Technician|Operator|Driver|Worker)$/i,
      /(Painter|Carpenter|Plumber|Electrician|Mechanic|Technician|Operator|Driver|Worker)\s+(&|and)\s+/i,
      
      // Professional designations - more flexible
      /^(Professional|Certified|Licensed|Registered)\s+(Electrician|Engineer|Developer|Designer|Manager|Specialist|Consultant|Technician|Architect|Accountant|Lawyer|Teacher|Nurse)/i,
      
      // Compound titles with & or "and"
      /(Developer|Engineer|Designer|Manager|Director|Analyst|Specialist|Consultant|Technician|Electrician|Carpenter|Plumber|Mechanic)\s+(&|and)\s+(Developer|Engineer|Designer|Manager|Director|Analyst|Specialist|Consultant|Technician|Electrician|Construction|Building)/i,
      
      // Construction and trade specific compounds
      /^(Licensed|Certified|Professional|Senior|Lead)?\s*(Electrician|Carpenter|Plumber|Mechanic|Contractor|Builder)\s+(&|and|\/)\s*(Construction|Building|Specialist|Technician|Engineer)/i,
      
      // Common standalone titles
      /^(Developer|Engineer|Designer|Manager|Director|Analyst|Consultant|Specialist|Coordinator|Supervisor|Administrator|Technician|Architect|Programmer|Writer|Editor|Artist|Photographer|Nurse|Teacher|Lawyer|Accountant|Scientist|Researcher)$/i
    ];
    
    return titlePatterns.some(pattern => pattern.test(cleanLine));
  }

  // Check if content is obviously not a headline
  isObviouslyNotHeadline(line) {
    const obviousNonHeadlines = [
      // Contact information
      /@/, /phone/i, /email/i, /address/i, /linkedin/i, /github/i,
      // Dates
      /\d{4}/, /january|february|march|april|may|june|july|august|september|october|november|december/i,
      // Section headers
      /^(education|skills|experience|work|references|contact|personal|summary|objective|profile|about)/i,
      // Too short or too long
      /^.{1,2}$/, /^.{100,}$/,
      // Numbers only
      /^\d+$/,
      // URLs
      /http/i, /www\./i,
      // Common CV elements
      /curriculum|vitae|resume|cv/i
    ];
    
    return obviousNonHeadlines.some(pattern => pattern.test(line));
  }

  // Validate if extracted text is a good headline
  isValidHeadline(headline) {
    if (!headline || typeof headline !== 'string') {
      return false;
    }
    
    const clean = headline.trim();
    
    // Length check
    if (clean.length < 3 || clean.length > 80) {
      return false;
    }
    
    // Should not contain obvious non-title content
    const invalidPatterns = [
      /@/, /http/, /www\./, /\.com/, /\.org/, /\.net/,
      /\d{4}/, // Years
      /phone/i, /email/i, /address/i,
      /years?(?:\s+of)?\s+experience/i, // "5 years experience" is not a title
      /\b(with|and|the|in|at|for|by|from|to)\b.*\b(with|and|the|in|at|for|by|from|to)\b/i // Too many prepositions
    ];
    
    return !invalidPatterns.some(pattern => pattern.test(clean));
  }

  // Clean and format headline
  cleanHeadline(headline) {
    if (!headline) return null;
    
    return headline
      .trim()
      .replace(/^[•\-\*\+\d\.]\s*/, '') // Remove bullets/numbers
      .replace(/[:\-–—]\s*$/, '') // Remove trailing colons/dashes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
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
      const totalExperience = this.determineYearsOfExperience(text, workExperience);
      
      const extractedData = {
        skills,
        work_experience: workExperience,
        years_experience: totalExperience
      };
      
      const summary = this.generateSummary(text, extractedData);
      const headline = this.extractHeadline(text, workExperience);
      
      console.log('Parsing completed successfully');
      console.log('Extracted data summary:', {
        name: `${firstName} ${lastName}`,
        email: contactInfo.email,
        phone: contactInfo.phone,
        headline: headline,
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
        address: contactInfo.address || '',
        headline: headline || '',
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