from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import time
import os

# Credentials
WAVE_EMAIL = "amirali@cctvinhouston.com"
WAVE_PASSWORD = "Fzed3w9m"

# Set up Chrome options to use a dedicated Selenium profile
selenium_profile_path = r'C:\Users\PC\AppData\Local\Google\Chrome\SeleniumProfile'
if not os.path.exists(selenium_profile_path):
    os.makedirs(selenium_profile_path)
options = Options()
options.add_argument(f'user-data-dir={selenium_profile_path}')
# Do NOT add --profile-directory for a dedicated Selenium profile

driver = webdriver.Chrome(options=options)

print("Chrome launched")

def is_logged_in(driver):
    try:
        # Check for an element only visible when logged in (e.g., sidebar or dashboard)
        driver.find_element(By.CSS_SELECTOR, 'nav, .sidebar, [data-testid*="dashboard"]')
        return True
    except NoSuchElementException:
        return False

def login_if_needed(driver):
    if not is_logged_in(driver):
        try:
            # Wait for the email input to appear and be visible
            email_input = WebDriverWait(driver, 20).until(
                EC.visibility_of_element_located((By.NAME, 'email'))
            )
            password_input = driver.find_element(By.NAME, 'password')
            login_button = driver.find_element(By.CSS_SELECTOR, 'button[type=\"submit\"]')
            
            # Scroll email input into view (helps if popups are present)
            driver.execute_script("arguments[0].scrollIntoView();", email_input)
            time.sleep(1)
            
            email_input.clear()
            email_input.send_keys(WAVE_EMAIL)
            password_input.clear()
            password_input.send_keys(WAVE_PASSWORD)
            login_button.click()
            print('If prompted for OTP/2FA, complete it in the browser window.')
            input('After completing login and OTP (if needed), press Enter here to continue...')
            time.sleep(2)
        except Exception as e:
            print(f'Login form not found or another error occurred: {e}')
            driver.quit()
            exit(1)
        # Wait for login to complete
        for _ in range(10):
            if is_logged_in(driver):
                break
            time.sleep(1)
        else:
            print('Login failed. Please check your credentials.')
            driver.quit()
            exit(1)

# Go to the Wave login page
login_url = 'https://my.waveapps.com/login/'
print("Navigated to login page")
driver.get(login_url)
login_if_needed(driver)
print("Login checked")

# Go to the invoices page
invoices_url = 'https://next.waveapps.com/abd4b40f-518b-42a8-bfb1-7aff65f8078b/invoices'
print("Navigated to invoices page")
driver.get(invoices_url)
time.sleep(5)  # Wait for page to load

# Scrape the table
rows = driver.find_elements(By.CSS_SELECTOR, 'table tbody tr')
print(f"Found {len(rows)} rows in the invoice table")
data = []
for row in rows:
    cols = row.find_elements(By.TAG_NAME, 'td')
    if len(cols) >= 6:
        data.append({
            'Status': cols[0].text,
            'Due': cols[1].text,
            'Date': cols[2].text,
            'Number': cols[3].text,
            'Customer': cols[4].text,
            'Amount due': cols[5].text,
        })

# Export to Excel
df = pd.DataFrame(data)
df.to_excel('wave_invoices.xlsx', index=False)
print('Exported to wave_invoices.xlsx')

driver.quit() 