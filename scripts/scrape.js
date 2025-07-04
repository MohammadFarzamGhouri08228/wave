const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const path = require('path');

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
  // Set to false to disable profile usage (useful if profile causes issues)
  useChromeProfile: true,
  
  // Date range for filtering invoices (YYYY-MM-DD format)
  // Set to null to use default (last 30 days)
  startDate: null, // e.g., '2024-01-01'
  endDate: null,   // e.g., '2024-12-31'
  
  // If startDate/endDate are null, use this many days back from today
  defaultDaysBack: 30
};

(async () => {
  let browser;
  
  try {
    // First, try to launch with profile
    if (CONFIG.useChromeProfile) {
      console.log(`Attempting to launch Chrome with profile: ${CONFIG.chromeProfileName}`);
      console.log(`Profile path: ${CONFIG.chromeProfilePath}`);
      
      try {
        // Close any existing Chrome processes that might be using the profile
        // This is a common cause of the launch error
        
        const launchArgs = [
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--remote-debugging-port=9222',
          `--user-data-dir=${CONFIG.chromeProfilePath}`,
          `--profile-directory=${CONFIG.chromeProfileName}`
        ];

        browser = await puppeteer.launch({ 
          headless: false, // Set to true for production
          defaultViewport: null,
          args: launchArgs,
          ignoreDefaultArgs: ['--disable-extensions'], // Allow extensions in profile
          timeout: 30000 // Increase timeout
        });
        
        console.log('Successfully launched Chrome with profile!');
        
      } catch (profileError) {
        console.log('Failed to launch with profile, error:', profileError.message);
        console.log('Trying without profile...');
        
        // Fallback: launch without profile
        browser = await puppeteer.launch({ 
          headless: false,
          defaultViewport: null,
          args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ],
          timeout: 30000
        });
        
        console.log('Launched Chrome without profile');
      }
    } else {
      // Launch without profile
      browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: [
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        timeout: 30000
      });
      
      console.log('Launched Chrome without profile (disabled in config)');
    }
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
      console.log('Navigating to Wave login page...');
      
      // Navigate directly to login page
      await page.goto('https://waveapps.com/login', { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });
      
      await page.waitForTimeout(3000);
      
      // Check if we're already logged in by looking for dashboard elements
      const isLoggedIn = await page.evaluate(() => {
        const dashboardSelectors = [
          '.dashboard',
          '[data-testid*="dashboard"]',
          '.main-content',
          '.app-content',
          'nav',
          '.sidebar',
          '.user-menu',
          '.account-menu'
        ];
        
        return dashboardSelectors.some(selector => document.querySelector(selector));
      });
      
      if (isLoggedIn) {
        console.log('Already logged in! Proceeding to invoices...');
      } else {
        console.log('Not logged in, attempting login...');
        
        // Wait for login form to load
        await page.waitForTimeout(3000);
        
        // Try multiple selectors for email field
        const emailSelectors = [
          '#email',
          'input[name="email"]',
          'input[type="email"]',
          'input[placeholder*="email" i]',
          'input[placeholder*="Email"]',
          '[data-testid*="email"]',
          '.email-input input',
          'input[autocomplete="email"]',
          'input[autocomplete="username"]'
        ];
        
        let emailField = null;
        for (const selector of emailSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 2000 });
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
          console.log('Available input fields on page:');
          const inputs = await page.evaluate(() => {
            const inputElements = document.querySelectorAll('input');
            return Array.from(inputElements).map(input => ({
              type: input.type,
              name: input.name,
              id: input.id,
              placeholder: input.placeholder,
              className: input.className
            }));
          });
          console.log(inputs);
          throw new Error('Could not find email input field. Check if login page loaded correctly.');
        }
        
        // Try multiple selectors for password field
        const passwordSelectors = [
          '#password',
          'input[name="password"]',
          'input[type="password"]',
          'input[placeholder*="password" i]',
          'input[placeholder*="Password"]',
          '[data-testid*="password"]',
          '.password-input input',
          'input[autocomplete="current-password"]',
          'input[autocomplete="password"]'
        ];
        
        let passwordField = null;
        for (const selector of passwordSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 2000 });
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
        
        // Clear fields first
        await emailField.click({ clickCount: 3 });
        await emailField.press('Backspace');
        await passwordField.click({ clickCount: 3 });
        await passwordField.press('Backspace');
        
        // Fill in credentials
        console.log('Filling in email...');
        await emailField.type(CONFIG.email, { delay: 100 });
        
        console.log('Filling in password...');
        await passwordField.type(CONFIG.password, { delay: 100 });
        
        // Wait a moment before submitting
        await page.waitForTimeout(1000);
        
        // Try to find and click submit button
        const submitSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Login")',
          'button:has-text("Sign In")',
          'button:has-text("Log In")',
          '[data-testid*="submit"]',
          '[data-testid*="login"]',
          '.login-button',
          '.submit-button',
          'form button',
          'button[form]'
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
          // Try to find any button in the form
          submitButton = await page.$('form button, .login-form button');
          if (submitButton) {
            console.log('Found submit button using fallback selector');
          }
        }
        
        if (!submitButton) {
          throw new Error('Could not find submit button.');
        }
        
        console.log('Clicking submit button...');
        await submitButton.click();
        
        // Wait for login to complete
        try {
          await page.waitForNavigation({ 
            waitUntil: 'networkidle2', 
            timeout: 30000 
          });
          console.log('Login successful!');
        } catch (navError) {
          console.log('Navigation timeout, but may still be logged in. Checking...');
          await page.waitForTimeout(5000);
        }
      }

      // Navigate to Sales & Payments → Invoices → All Invoices
      console.log('Navigating to invoices...');
      
      // Try multiple possible URLs for the invoices page
      const invoiceUrls = [
        'https://next.waveapps.com/invoices',
        'https://next.waveapps.com/sales/invoices',
        'https://next.waveapps.com/business/invoices',
        'https://app.waveapps.com/invoices',
        'https://waveapps.com/invoices'
      ];

      let invoicePageLoaded = false;
      for (const url of invoiceUrls) {
        try {
          console.log(`Trying URL: ${url}`);
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
          
          // Check if we're on an invoice-related page
          const isInvoicePage = await page.evaluate(() => {
            const pageText = document.body.textContent.toLowerCase();
            return pageText.includes('invoice') || pageText.includes('sales') || 
                   document.querySelector('.invoice') || document.querySelector('[data-testid*="invoice"]');
          });
          
          if (isInvoicePage) {
            invoicePageLoaded = true;
            console.log(`Successfully loaded invoice page: ${url}`);
            break;
          }
        } catch (e) {
          console.log(`Failed to load: ${url} - ${e.message}`);
          continue;
        }
      }

      if (!invoicePageLoaded) {
        console.log('Could not load invoices page directly, trying to navigate via dashboard...');
        
        // Go to main dashboard and try to find navigation
        await page.goto('https://waveapps.com/dashboard', { waitUntil: 'networkidle2', timeout: 15000 });
        await page.waitForTimeout(3000);
        
        // Try to find navigation links
        const navSelectors = [
          'a[href*="invoice"]',
          'a[href*="sales"]',
          'a:has-text("Invoices")',
          'a:has-text("Sales")',
          '[data-testid*="invoice"]',
          '[data-testid*="sales"]',
          '.nav-item a[href*="invoice"]',
          '.nav-item a[href*="sales"]'
        ];

        let navLink = null;
        for (const selector of navSelectors) {
          try {
            navLink = await page.$(selector);
            if (navLink) {
              console.log(`Found navigation link using selector: ${selector}`);
              await navLink.click();
              await page.waitForTimeout(3000);
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
      }
      
      // Wait for the page to load
      await page.waitForTimeout(3000);

      // Look for "All Invoices" or similar filter option
      console.log('Looking for invoice filters...');
      const allInvoicesSelectors = [
        'button:has-text("All Invoices")',
        'a:has-text("All Invoices")',
        '[data-testid*="all-invoices"]',
        '.filter-option:has-text("All")',
        'select option:has-text("All")',
        '.status-filter option:has-text("All")',
        'button:has-text("All")',
        '.filter-all'
      ];

      for (const selector of allInvoicesSelectors) {
        try {
          const allInvoicesElement = await page.$(selector);
          if (allInvoicesElement) {
            console.log(`Found All Invoices filter using selector: ${selector}`);
            await allInvoicesElement.click();
            await page.waitForTimeout(2000);
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
        'input[placeholder*="date" i]',
        'input[placeholder*="Date"]',
        'input[name*="date"]',
        'input[id*="date"]'
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
          } else if (dateInputs.length === 1) {
            console.log(`Found single date input using selector: ${selector}`);
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

        try {
          await startDateInput.click();
          await startDateInput.press('Backspace');
          await startDateInput.type(startDateStr);
          
          await endDateInput.click();
          await endDateInput.press('Backspace');
          await endDateInput.type(endDateStr);

          // Look for apply filter button
          const applySelectors = [
            'button:has-text("Apply")',
            'button:has-text("Filter")',
            'button:has-text("Search")',
            '[data-testid*="apply"]',
            '[data-testid*="filter"]',
            '.filter-apply',
            '.apply-button'
          ];

          for (const selector of applySelectors) {
            try {
              const applyButton = await page.$(selector);
              if (applyButton) {
                console.log(`Found apply button using selector: ${selector}`);
                await applyButton.click();
                await page.waitForTimeout(3000);
                break;
              }
            } catch (e) {
              // Continue to next selector
            }
          }
        } catch (dateError) {
          console.log('Error setting date range:', dateError.message);
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
          'tr[data-testid*="invoice"]',
          '.invoice-row',
          '.invoice-item',
          '[data-testid*="invoice"]',
          '.invoice',
          'tr[data-invoice]',
          '.invoice-list-item',
          'tbody tr', // General table rows
          '.list-item',
          '[role="row"]',
          '.row-item',
          '.item',
          'tr'
        ];

        let rows = [];
        let usedSelector = '';
        
        for (const selector of selectors) {
          rows = document.querySelectorAll(selector);
          if (rows.length > 0) {
            // Filter out header rows and empty rows
            const filteredRows = Array.from(rows).filter(row => {
              const text = row.textContent.trim();
              return text.length > 10 && 
                     !text.toLowerCase().includes('invoice number') &&
                     !text.toLowerCase().includes('amount') &&
                     !text.toLowerCase().includes('customer');
            });
            
            if (filteredRows.length > 0) {
              console.log(`Found ${filteredRows.length} invoice rows using selector: ${selector}`);
              rows = filteredRows;
              usedSelector = selector;
              break;
            }
          }
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
              '[data-testid*="id"]',
              'td:nth-child(1)',
              'td:nth-child(2)'
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
              const numberMatches = [
                /(?:INV|Invoice|#)\s*([A-Z0-9-]+)/i,
                /^([A-Z0-9-]{3,})/,
                /([0-9]{3,})/
              ];
              
              for (const pattern of numberMatches) {
                const match = textContent.match(pattern);
                if (match) {
                  invoiceNumber = match[1] || match[0];
                  break;
                }
              }
              
              if (!invoiceNumber) {
                invoiceNumber = `Row-${index + 1}`;
              }
            }

            // Try to extract more fields
            let amount = '';
            let date = '';
            let client = '';
            let status = '';

            // Look for amount patterns (various currencies)
            const amountPatterns = [
              /\$[\d,]+\.?\d*/,
              /€[\d,]+\.?\d*/,
              /£[\d,]+\.?\d*/,
              /[\d,]+\.?\d*\s*(?:USD|EUR|GBP|CAD)/i,
              /[\d,]+\.?\d*/
            ];
            
            for (const pattern of amountPatterns) {
              const match = textContent.match(pattern);
              if (match) {
                amount = match[0];
                break;
              }
            }

            // Look for date patterns
            const datePatterns = [
              /\d{1,2}\/\d{1,2}\/\d{2,4}/,
              /\d{4}-\d{2}-\d{2}/,
              /\d{1,2}-\d{1,2}-\d{2,4}/,
              /\w{3}\s+\d{1,2},?\s+\d{4}/i
            ];
            
            for (const pattern of datePatterns) {
              const match = textContent.match(pattern);
              if (match) {
                date = match[0];
                break;
              }
            }

            // Look for status patterns
            const statusPatterns = [
              /(?:Paid|Unpaid|Draft|Sent|Overdue|Outstanding|Pending)/i
            ];
            
            for (const pattern of statusPatterns) {
              const match = textContent.match(pattern);
              if (match) {
                status = match[0];
                break;
              }
            }

            // Try to extract client name (usually after invoice number)
            const clientMatch = textContent.replace(invoiceNumber, '').match(/([A-Za-z\s]{3,})/);
            if (clientMatch) {
              client = clientMatch[1].trim();
            }

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
          totalElements: rows.length,
          pageUrl: window.location.href,
          pageTitle: document.title
        };
      });

      console.log(`\n=== EXTRACTION RESULTS ===`);
      console.log(`Page URL: ${invoiceData.pageUrl}`);
      console.log(`Page Title: ${invoiceData.pageTitle}`);
      console.log(`Used selector: ${invoiceData.usedSelector}`);
      console.log(`Total elements found: ${invoiceData.totalElements}`);
      console.log(`\n=== INVOICE DATA ===\n`);

      // Display each invoice with detailed information
      invoiceData.rows.forEach((invoice, index) => {
        console.log(`INVOICE ${index + 1}:`);
        console.log(`  Invoice Number: ${invoice.invoiceNumber}`);
        console.log(`  Amount: ${invoice.amount || 'Not found'}`);
        console.log(`  Date: ${invoice.date || 'Not found'}`);
        console.log(`  Client: ${invoice.client || 'Not found'}`);
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
        console.log('No invoice data found. The page might be different from expected.');
        console.log('Consider updating the selectors based on the actual page structure.');
      }

    } catch (error) {
      console.error('Error during scraping:', error);
      
      // Take a screenshot for debugging
      try {
        await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });
        console.log('Debug screenshot saved as debug_screenshot.png');
      } catch (screenshotError) {
        console.log('Could not take screenshot:', screenshotError.message);
      }
    } finally {
      // Keep browser open for debugging (comment out for production)
      console.log('Browser will remain open for debugging. Close manually when done.');
      // await browser.close();
    }
    
  } catch (launchError) {
    console.error('Failed to launch browser:', launchError);
    console.log('\nTROUBLESHOOTING TIPS:');
    console.log('1. Close all Chrome instances and try again');
    console.log('2. Try running with useChromeProfile: false in CONFIG');
    console.log('3. Check if the Chrome profile path is correct');
    console.log('4. Try running as administrator');
    console.log('5. Make sure Chrome is installed and accessible');
  }
})();