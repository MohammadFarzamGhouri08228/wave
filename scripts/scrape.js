const puppeteer = require('puppeteer');
const XLSX = require('xlsx');

// Configuration - Update these values as needed
const CONFIG = {
  // Your Wave credentials
  email: 'amirali@cctvinhouston.com',
  password: 'Fzed3w9m',
  
  // Chrome profile settings
  // Set this to your Chrome user data directory (parent of all profiles)
  // Windows: 'C:/Users/PC/AppData/Local/Google/Chrome/User Data'
  chromeProfilePath: 'C:/Users/PC/AppData/Local/Google/Chrome/User Data',
  // Set this to your profile name (e.g., 'Profile 13', 'Default', etc.)
  chromeProfileName: 'Profile 13',
  
  // Date range for filtering invoices (YYYY-MM-DD format)
  // Set to null to use default (last 30 days)
  startDate: null, // e.g., '2024-01-01'
  endDate: null,   // e.g., '2024-12-31'
  
  // If startDate/endDate are null, use this many days back from today
  defaultDaysBack: 30
};

(async () => {
  // Prepare Chrome launch arguments
  const launchArgs = [
    '--start-maximized',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ];

  // Add user data directory and profile directory
  launchArgs.push(`--user-data-dir=${CONFIG.chromeProfilePath}`);
  launchArgs.push(`--profile-directory=${CONFIG.chromeProfileName}`);
  console.log(`Using Chrome user data dir: ${CONFIG.chromeProfilePath}`);
  console.log(`Using Chrome profile: ${CONFIG.chromeProfileName}`);

  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for production
    defaultViewport: null,
    args: launchArgs,
    executablePath: process.platform === 'win32' 
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome'
  });
  
  const page = await browser.newPage();

  try {
    console.log('Navigating to Wave...');
    
    // First try to go to the main Wave page to see if already logged in
    await page.goto('https://waveapps.com', { waitUntil: 'networkidle2' });
    await page.waitForTimeout(3000);
    
    // Check if we're already logged in by looking for dashboard elements
    const isLoggedIn = await page.evaluate(() => {
      const dashboardSelectors = [
        '.dashboard',
        '[data-testid*="dashboard"]',
        '.main-content',
        '.app-content',
        'nav',
        '.sidebar'
      ];
      
      return dashboardSelectors.some(selector => document.querySelector(selector));
    });
    
    if (isLoggedIn) {
      console.log('Already logged in! Proceeding to invoices...');
    } else {
      console.log('Not logged in, attempting login...');
      await page.goto('https://waveapps.com/login', { waitUntil: 'networkidle2' });

      // Fill login with multiple selector attempts
      console.log('Logging in...');
      
      // Wait for login form to load
      await page.waitForTimeout(2000);
      
      // Try multiple selectors for email field
      const emailSelectors = [
        '#email',
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="email"]',
        'input[placeholder*="Email"]',
        '[data-testid*="email"]',
        '.email-input input'
      ];
      
      let emailField = null;
      for (const selector of emailSelectors) {
        try {
          emailField = await page.$(selector);
          if (emailField) {
            console.log(`Found email field using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!emailField) {
        throw new Error('Could not find email input field. Check if login page loaded correctly.');
      }
      
      // Try multiple selectors for password field
      const passwordSelectors = [
        '#password',
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="password"]',
        'input[placeholder*="Password"]',
        '[data-testid*="password"]',
        '.password-input input'
      ];
      
      let passwordField = null;
      for (const selector of passwordSelectors) {
        try {
          passwordField = await page.$(selector);
          if (passwordField) {
            console.log(`Found password field using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!passwordField) {
        throw new Error('Could not find password input field.');
      }
      
      // Fill in credentials
      await emailField.click();
      await emailField.type(CONFIG.email);
      await passwordField.click();
      await passwordField.type(CONFIG.password);
      
      // Try to find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Login")',
        'button:contains("Sign In")',
        'button:contains("Log In")',
        '[data-testid*="submit"]',
        '.login-button',
        '.submit-button'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          submitButton = await page.$(selector);
          if (submitButton) {
            console.log(`Found submit button using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!submitButton) {
        throw new Error('Could not find submit button.');
      }
      
      await submitButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }

    // Navigate to Sales & Payments → Invoices → All Invoices
    console.log('Navigating to Sales & Payments...');
    
    // First, try to find and click on "Sales & Payments" in the main menu
    await page.waitForTimeout(2000); // Wait for dashboard to load
    
    // Try multiple selectors for the Sales & Payments menu item
    const salesSelectors = [
      'a[href*="sales"]',
      'a[href*="invoices"]',
      '[data-testid*="sales"]',
      '[data-testid*="invoices"]',
      'a:contains("Sales")',
      'a:contains("Invoices")',
      '.nav-item a[href*="sales"]',
      '.nav-item a[href*="invoices"]',
      'nav a[href*="sales"]',
      'nav a[href*="invoices"]'
    ];

    let salesLink = null;
    for (const selector of salesSelectors) {
      try {
        salesLink = await page.$(selector);
        if (salesLink) {
          console.log(`Found Sales link using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (salesLink) {
      await salesLink.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('Could not find Sales & Payments link, trying direct navigation...');
    }

    // Try to navigate directly to invoices page
    console.log('Navigating to invoices page...');
    
    // Try multiple possible URLs for the invoices page
    const invoiceUrls = [
      'https://next.waveapps.com/invoices',
      'https://next.waveapps.com/sales/invoices',
      'https://next.waveapps.com/business/invoices',
      'https://app.waveapps.com/invoices'
    ];

    let invoicePageLoaded = false;
    for (const url of invoiceUrls) {
      try {
        console.log(`Trying URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
        invoicePageLoaded = true;
        console.log(`Successfully loaded: ${url}`);
        break;
      } catch (e) {
        console.log(`Failed to load: ${url}`);
        continue;
      }
    }

    if (!invoicePageLoaded) {
      console.log('Could not load invoices page, trying to navigate via menu...');
      // Fallback: try to find and click menu items
      await page.goto('https://next.waveapps.com', { waitUntil: 'networkidle2' });
    }
    
    // Wait for the page to load
    await page.waitForTimeout(3000);

    // Look for "All Invoices" or similar filter option
    console.log('Looking for All Invoices filter...');
    const allInvoicesSelectors = [
      'button:contains("All Invoices")',
      'a:contains("All Invoices")',
      '[data-testid*="all-invoices"]',
      '.filter-option:contains("All")',
      'select option:contains("All")',
      '.status-filter option:contains("All")'
    ];

    for (const selector of allInvoicesSelectors) {
      try {
        const allInvoicesElement = await page.$(selector);
        if (allInvoicesElement) {
          console.log(`Found All Invoices filter using selector: ${selector}`);
          await allInvoicesElement.click();
          await page.waitForTimeout(1000);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Set up date range filtering
    console.log('Setting up date range filter...');
    
    // Look for date picker elements
    const dateSelectors = [
      'input[type="date"]',
      '.date-picker input',
      '[data-testid*="date"]',
      '.filter-date input',
      'input[placeholder*="date"]',
      'input[placeholder*="Date"]'
    ];

    let startDateInput = null;
    let endDateInput = null;

    // Try to find date inputs
    for (const selector of dateSelectors) {
      try {
        const dateInputs = await page.$$(selector);
        if (dateInputs.length >= 2) {
          startDateInput = dateInputs[0];
          endDateInput = dateInputs[1];
          console.log(`Found date inputs using selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Set date range based on configuration
    if (startDateInput && endDateInput) {
      let startDate, endDate;
      
      if (CONFIG.startDate && CONFIG.endDate) {
        // Use configured dates
        startDate = new Date(CONFIG.startDate);
        endDate = new Date(CONFIG.endDate);
      } else {
        // Use default (last N days)
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - CONFIG.defaultDaysBack);
      }

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log(`Setting date range: ${startDateStr} to ${endDateStr}`);

      await startDateInput.click();
      await startDateInput.type(startDateStr);
      await endDateInput.click();
      await endDateInput.type(endDateStr);

      // Look for apply filter button
      const applySelectors = [
        'button:contains("Apply")',
        'button:contains("Filter")',
        'button:contains("Search")',
        '[data-testid*="apply"]',
        '.filter-apply'
      ];

      for (const selector of applySelectors) {
        try {
          const applyButton = await page.$(selector);
          if (applyButton) {
            console.log(`Found apply button using selector: ${selector}`);
            await applyButton.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
    } else {
      console.log('Could not find date inputs, proceeding without date filter...');
    }

    // Wait for filtered results to load
    await page.waitForTimeout(3000);

    // Scrape data with multiple selector attempts
    console.log('\n=== STARTING DATA EXTRACTION ===\n');
    
    const invoiceData = await page.evaluate(() => {
      // Try multiple possible selectors for invoice rows
      const selectors = [
        '.invoice-row',
        '.invoice-item',
        '[data-testid*="invoice"]',
        '.invoice',
        'tr[data-invoice]',
        '.invoice-list-item',
        'tr', // General table rows
        '.list-item',
        '[role="row"]',
        '.row',
        '.item'
      ];

      let rows = [];
      let usedSelector = '';
      
      for (const selector of selectors) {
        rows = document.querySelectorAll(selector);
        if (rows.length > 0) {
          console.log(`Found ${rows.length} elements using selector: ${selector}`);
          usedSelector = selector;
          break;
        }
      }

      // If no specific invoice rows found, try to find any table rows or list items
      if (rows.length === 0) {
        rows = document.querySelectorAll('*');
        console.log(`No specific selectors found, examining all elements`);
      }

      return {
        rows: Array.from(rows).map((el, index) => {
          // Extract text content from various possible elements
          const textContent = el.innerText || el.textContent || '';
          
          // Try to find invoice number in various ways
          let invoiceNumber = '';
          const numberSelectors = [
            '.invoice-number',
            '[data-testid*="number"]',
            '.number',
            'td:first-child',
            '.invoice-id',
            '.id',
            '[data-testid*="id"]'
          ];
          
          for (const selector of numberSelectors) {
            const numberEl = el.querySelector(selector);
            if (numberEl) {
              invoiceNumber = numberEl.innerText.trim();
              break;
            }
          }

          // If no specific number found, try to extract from text content
          if (!invoiceNumber) {
            const numberMatch = textContent.match(/(?:INV|Invoice|#)\s*([A-Z0-9-]+)/i);
            invoiceNumber = numberMatch ? numberMatch[1] : `Row-${index + 1}`;
          }

          // Try to extract more fields
          let amount = '';
          let date = '';
          let client = '';
          let status = '';

          // Look for amount patterns
          const amountMatch = textContent.match(/\$[\d,]+\.?\d*/);
          if (amountMatch) amount = amountMatch[0];

          // Look for date patterns
          const dateMatch = textContent.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/);
          if (dateMatch) date = dateMatch[0];

          // Look for status patterns
          const statusMatch = textContent.match(/(?:Paid|Unpaid|Draft|Sent|Overdue)/i);
          if (statusMatch) status = statusMatch[0];

          return {
            invoiceNumber: invoiceNumber,
            amount: amount,
            date: date,
            client: client,
            status: status,
            fullText: textContent.substring(0, 300), // First 300 chars for debugging
            rowIndex: index + 1,
            elementTag: el.tagName,
            elementClasses: el.className
          };
        }),
        usedSelector: usedSelector,
        totalElements: rows.length
      };
    });

    console.log(`\n=== EXTRACTION RESULTS ===`);
    console.log(`Used selector: ${invoiceData.usedSelector}`);
    console.log(`Total elements found: ${invoiceData.totalElements}`);
    console.log(`\n=== INVOICE DATA ===\n`);

    // Display each invoice with detailed information
    invoiceData.rows.forEach((invoice, index) => {
      console.log(`INVOICE ${index + 1}:`);
      console.log(`  Invoice Number: ${invoice.invoiceNumber}`);
      console.log(`  Amount: ${invoice.amount || 'Not found'}`);
      console.log(`  Date: ${invoice.date || 'Not found'}`);
      console.log(`  Status: ${invoice.status || 'Not found'}`);
      console.log(`  Element Type: ${invoice.elementTag}`);
      console.log(`  Element Classes: ${invoice.elementClasses}`);
      console.log(`  Full Text (first 300 chars):`);
      console.log(`    ${invoice.fullText}`);
      console.log(`\n${'*'.repeat(80)}\n`);
    });

    console.log(`\n=== SUMMARY ===`);
    console.log(`Processed ${invoiceData.rows.length} potential invoice entries`);
    console.log(`\n=== END OF DATA EXTRACTION ===\n`);

    // Export to Excel
    if (invoiceData.rows.length > 0) {
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(invoiceData.rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Wave Invoices');
      
      const filename = `wave_invoices_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      console.log(`\n=== EXCEL EXPORT ===`);
      console.log(`Data exported to ${filename}`);
      console.log(`Exported ${invoiceData.rows.length} invoice records`);
    } else {
      console.log('\n=== EXCEL EXPORT ===');
      console.log('No invoice data found. Check the selectors.');
    }

  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
})();
