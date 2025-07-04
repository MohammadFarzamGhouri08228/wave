const fs = require('fs');
const path = require('path');

console.log('=== Chrome Profile Finder ===\n');

// Common Chrome profile locations
const possiblePaths = [
  path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data'),
  path.join(process.env.APPDATA, 'Google', 'Chrome', 'User Data'),
  path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
];

console.log('Searching for Chrome profiles...\n');

possiblePaths.forEach(basePath => {
  if (fs.existsSync(basePath)) {
    console.log(`Found Chrome User Data: ${basePath}`);
    
    const profilesDir = path.join(basePath, 'Default');
    if (fs.existsSync(profilesDir)) {
      console.log(`  ✓ Default Profile: ${profilesDir}`);
    }
    
    // Look for other profiles
    const profileDirs = fs.readdirSync(basePath).filter(dir => 
      dir.startsWith('Profile ') && fs.existsSync(path.join(basePath, dir))
    );
    
    profileDirs.forEach(profileDir => {
      const profilePath = path.join(basePath, profileDir);
      console.log(`  ✓ ${profileDir}: ${profilePath}`);
    });
    
    console.log('');
  }
});

console.log('=== Instructions ===');
console.log('1. Choose a profile where you are already logged into Wave');
console.log('2. Copy the profile path to your CONFIG.chromeProfilePath');
console.log('3. Or use the profile name (e.g., "Profile 1") in CONFIG.chromeProfileName');
console.log('\nExample:');
console.log('chromeProfilePath: "C:\\Users\\YourUsername\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1"');
console.log('chromeProfileName: "Profile 1"'); 