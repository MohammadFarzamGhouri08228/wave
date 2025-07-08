const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Configuration
const LOUISIANA_URL = 'https://louisianalottery.com/scratch-offs/';
const BEYOND_URL = 'https://beyondlotterytv.com/login';
const EMAIL = 'superadmin2@tv-app.com';
const PASSWORD = 'superadmin2@tv-app.com';

async function main() {
    const browser = await puppeteer.launch({
        headless: false, // Set to true for production
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page = await browser.newPage();
        
        // --- STEP 1: SCRAPE TICKET DETAILS ---
        console.log('Scraping ticket details...');
        await page.goto(LOUISIANA_URL, { waitUntil: 'networkidle2' });
        
        // Wait for scratch-off items to load
        await page.waitForSelector('.scratch-off-list .scratch-off-item');
        
        // Click first ticket and wait for new page
        const [newPage] = await Promise.all([
            browser.waitForTarget(target => target.opener() === page.target()),
            page.click('.scratch-off-list .scratch-off-item a')
        ]);
        
        const ticketPage = await newPage.page();
        await ticketPage.waitForSelector('.game-details');
        
        // Extract ticket details
        const ticketData = await ticketPage.evaluate(() => {
            const gameNoElement = document.querySelector('div:contains("Game No")') || 
                                document.evaluate('//div[contains(text(),"Game No")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            const gameNameElement = document.querySelector('.game-title');
            const gameValueElement = document.querySelector('div:contains("Ticket Price")') ||
                                   document.evaluate('//div[contains(text(),"Ticket Price")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            const packSizeElement = document.querySelector('div:contains("Pack Size")') ||
                                  document.evaluate('//div[contains(text(),"Pack Size")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            
            return {
                gameNo: gameNoElement ? gameNoElement.textContent.split(':')[1]?.trim() : '',
                gameName: gameNameElement ? gameNameElement.textContent.trim() : '',
                gameValue: gameValueElement ? gameValueElement.textContent.split(':')[1]?.trim() : '',
                packSize: packSizeElement ? packSizeElement.textContent.split(':')[1]?.trim() : ''
            };
        });
        
        console.log('Ticket Data:', ticketData);
        
        // --- STEP 2: SCREENSHOT TICKET IMAGE ---
        console.log('Taking screenshot of ticket image...');
        const ticketImageElement = await ticketPage.$('.game-image img');
        
        if (ticketImageElement) {
            // Scroll to image
            await ticketImageElement.scrollIntoView();
            await page.waitForTimeout(1000);
            
            // Take screenshot of the image element
            const ticketImgPath = path.join(__dirname, 'ticket_image.png');
            await ticketImageElement.screenshot({
                path: ticketImgPath,
                type: 'png'
            });
            
            console.log('Ticket image saved to:', ticketImgPath);
        }
        
        await ticketPage.close();
        
        // --- STEP 3: LOGIN TO BEYONDLOTTERYTV ---
        console.log('Logging into BeyondLotteryTV...');
        await page.goto(BEYOND_URL, { waitUntil: 'networkidle2' });
        
        await page.waitForSelector('input[name="email"]');
        await page.type('input[name="email"]', EMAIL);
        await page.type('input[name="password"]', PASSWORD);
        await page.click('button[type="submit"]');
        
        // Wait for login to complete
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // --- STEP 4: NAVIGATE TO GAMES SECTION ---
        console.log('Navigating to Games section...');
        await page.waitForSelector('.taskbar');
        await page.click('a[href*="games"], .taskbar a:contains("Games")');
        await page.waitForSelector('.games-list');
        
        // --- STEP 5: CHECK IF GAME EXISTS ---
        console.log('Checking if game exists...');
        const searchBox = await page.$('.games-list input[type="search"]');
        if (searchBox) {
            await searchBox.click({ clickCount: 3 }); // Select all
            await searchBox.type(ticketData.gameNo);
            await page.waitForTimeout(2000);
        }
        
        // Check if game exists
        const gameRows = await page.$$('.games-list .game-row');
        let gameExists = false;
        let countryMatches = false;
        
        for (const row of gameRows) {
            const rowText = await row.evaluate(el => el.textContent);
            if (rowText.includes(ticketData.gameNo)) {
                gameExists = true;
                
                // Click edit button
                const editBtn = await row.$('.edit-icon, .pencil-icon');
                if (editBtn) {
                    await editBtn.click();
                    await page.waitForSelector('input[name="country"]');
                    
                    const countryValue = await page.$eval('input[name="country"]', el => el.value);
                    countryMatches = countryValue.toLowerCase() === 'louisiana';
                    
                    if (countryMatches) {
                        console.log('ENJOY');
                        return;
                    }
                }
                break;
            }
        }
        
        // --- STEP 6: TASK A - CREATE NEW GAME ---
        if (!gameExists || !countryMatches) {
            console.log('Creating new game...');
            await page.click('.create-new-game-btn, button:contains("Create New Game")');
            await page.waitForSelector('input[name="game_no"]');
            
            // Fill form
            await page.type('input[name="game_no"]', ticketData.gameNo);
            await page.type('input[name="game_value"]', ticketData.gameValue);
            await page.type('input[name="pack_size"]', 'NA'); // Louisiana specific
            
            // Handle the "deatils" field (typo on website)
            const detailsField = await page.$('input[name="deatils"], textarea[name="deatils"]');
            if (detailsField) {
                await detailsField.type(ticketData.gameName);
            }
            
            // Select Louisiana region
            await page.select('select[name="region"]', 'louisiana');
            
            // --- STEP 7: TASK C - UPLOAD IMAGE ---
            const fileInput = await page.$('.thumbnail-upload input[type="file"], input[type="file"]');
            if (fileInput && ticketImgPath) {
                await fileInput.uploadFile(ticketImgPath);
                console.log('Image uploaded successfully');
            }
            
            // Save the game
            await page.click('.save-game-btn, button:contains("Save")');
            await page.waitForTimeout(2000);
            
            console.log('Game created and image uploaded successfully!');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

// Run the script
main().catch(console.error);