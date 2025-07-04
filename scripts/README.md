# Wave Invoice Scraper

This script automates the extraction of invoice data from the Wave portal and exports it to Excel format.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Update configuration:**
   Edit the `CONFIG` object in `scrape.js` to set your credentials, Chrome profile, and date range:
   ```javascript
   const CONFIG = {
     // Your Wave credentials
     email: 'your-email@example.com',
     password: 'your-password',
     
     // Chrome profile settings (to avoid OTP issues)
     // Option 1: Use profile path (recommended)
     chromeProfilePath: 'C:\\Users\\YourUsername\\AppData\\Local\\Google\\Chrome\\User Data\\Profile 1',
     // Option 2: Use profile name (if chromeProfilePath is null)
     chromeProfileName: 'Default', // or 'Profile 1', 'Profile 2', etc.
     
     // Date range for filtering invoices (YYYY-MM-DD format)
     // Set to null to use default (last 30 days)
     startDate: null, // e.g., '2024-01-01'
     endDate: null,   // e.g., '2024-12-31'
     
     // If startDate/endDate are null, use this many days back from today
     defaultDaysBack: 30
   };
   ```

## Usage

Run the scraper:
```bash
npm start
```

The script will:
1. Log into your Wave account
2. Navigate to Sales & Payments → Invoices → All Invoices
3. Set up date range filtering (configurable)
4. Extract invoice data from the filtered results
5. Export results to an Excel file named `wave_invoices_YYYY-MM-DD.xlsx`

## Current Features

- **Chrome profile support** to use existing login sessions (avoids OTP issues)
- **Automatic login** to Wave portal (if not already logged in)
- **Smart navigation** through Sales & Payments → Invoices → All Invoices
- **Configurable date filtering** with fallback to last 30 days
- **Flexible selectors** that try multiple DOM patterns to find invoice data
- **Excel export** with timestamped filename
- **Error handling** and logging
- **Visual debugging** (browser opens so you can see what's happening)

## Next Steps for Enhancement

1. **Refine selectors** - After running, check the console output to see which selectors work
2. **Add more fields** - Once basic extraction works, add specific fields like:
   - Invoice date
   - Amount
   - Client name
   - Status
   - Due date
3. **Pagination** - Handle multiple pages of invoices
4. **Filtering** - Add date range filters
5. **Scheduling** - Run automatically on a schedule

## Troubleshooting

- **OTP Issues**: Use a Chrome profile where you're already logged into Wave to avoid OTP authentication
- **Profile Setup**: 
  - Find your Chrome profile path: `chrome://version/` in Chrome, look for "Profile Path"
  - Or use profile name: `chrome://settings/` → People → Manage other people
- **No Data Found**: The script will show sample text content to help identify the correct selectors
- **Login Issues**: Check the browser console for any error messages
- **Visual Debugging**: The script runs in non-headless mode so you can see what's happening

## Security Note

- Never commit credentials to version control
- Consider using environment variables for sensitive data
- The script includes your credentials - make sure to secure this file 