const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'client/src/pages');
const filesToUpdate = [
  'StudentRegistrations.jsx',
  'StudentOrgEvents.jsx',
  'Profile.jsx',
  'Contact.jsx',
  'AdminUsers.jsx',
  'AdminRegistrations.jsx',
  'AdminEvents.jsx',
  'About.jsx',
  'FacultyOrgEvents.jsx'
];

filesToUpdate.forEach(file => {
  const filePath = path.join(dir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace text-white with text-text-primary inside heading tags
    content = content.replace(/(<h[1-6][^>]*?)text-white([^>]*?>)/g, '$1text-text-primary$2');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated headings in ${file}`);
  }
});
