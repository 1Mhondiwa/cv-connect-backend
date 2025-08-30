// test-skills-extraction.js
const cvParser = require('./services/cvParser');

// Test the improved skills extraction
async function testSkillsExtraction() {
  console.log('🧪 Testing improved skills extraction...\n');
  
  // Test text that should contain skills
  const testText = `
SKILLS
JavaScript, React, Node.js, Python, SQL
Project Management, Team Leadership, Communication
Microsoft Office Suite, Adobe Creative Suite
Customer Service, Problem Solving, Critical Thinking

TECHNICAL SKILLS
• Frontend: HTML, CSS, JavaScript, React, Angular
• Backend: Node.js, Python, Java, C#
• Database: MySQL, PostgreSQL, MongoDB
• Tools: Git, Docker, AWS, Jenkins

CORE COMPETENCIES
Strategic Planning, Budget Management, Process Improvement
Data Analysis, Business Intelligence, Risk Management
`;

  console.log('📝 Test text:');
  console.log(testText);
  console.log('\n🔍 Extracting skills...');
  
  try {
    const skills = await cvParser.extractSkills(testText);
    console.log('\n✅ Extracted skills:');
    console.log(JSON.stringify(skills, null, 2));
    console.log(`\n📊 Total skills found: ${skills.length}`);
  } catch (error) {
    console.error('❌ Error extracting skills:', error);
  }
}

testSkillsExtraction();
