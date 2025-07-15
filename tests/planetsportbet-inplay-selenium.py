from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
import time

# Update this path to your local chromedriver if needed
CHROMEDRIVER_PATH = 'chromedriver'  # or specify full path if not in PATH

# Set up Chrome options if you want to run headless or with custom flags
options = webdriver.ChromeOptions()
# options.add_argument('--headless')  # Uncomment to run headless

# Start the WebDriver
service = Service(CHROMEDRIVER_PATH)
driver = webdriver.Chrome(service=service, options=options)
driver.maximize_window()

def log(msg):
    print(f"[LOG] {msg}")

try:
    # 1️⃣ Go to homepage
    driver.get('https://planetsportbet.com/')
    log('Navigated to homepage')
    time.sleep(2)

    # 2️⃣ Accept cookies / pop-ups
    try:
        allow_all = driver.find_element(By.ID, 'CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll')
        if allow_all.is_displayed():
            allow_all.click()
            log('Clicked Allow All')
            time.sleep(1)
    except Exception:
        pass
    try:
        customize = driver.find_element(By.ID, 'CybotCookiebotDialogBodyLevelButtonCustomize')
        if customize.is_displayed():
            customize.click()
            log('Clicked Customize')
            time.sleep(1)
    except Exception:
        pass
    try:
        accept = driver.find_element(By.XPATH, '//button[contains(text(), "Accept")]')
        if accept.is_displayed():
            accept.click()
            log('Clicked Accept')
            time.sleep(1)
    except Exception:
        pass

    # 3️⃣ Dismiss any sign-up overlay (close icon)
    try:
        close_btn = driver.find_element(By.CSS_SELECTOR, '.css-7o8a95-SvgElement-CloseButton')
        if close_btn.is_displayed():
            close_btn.click()
            log('Closed sign-up banner')
            time.sleep(1)
    except Exception:
        pass

    # 4️⃣ Click the IN PLAY tab
    inplay_tab = driver.find_element(By.CSS_SELECTOR, 'a[href="/inplay"]')
    inplay_tab.click()
    log('Clicked IN PLAY tab')
    time.sleep(3)

    # 5️⃣ Wait for In Play heading
    heading = driver.find_element(By.CSS_SELECTOR, 'h2.css-1ffzfd-TitleStyle')
    assert 'In Play' in heading.text
    log('In Play heading detected')

    # 6️⃣ Wait for at least one live event row
    event_rows = driver.find_elements(By.CSS_SELECTOR, '[data-test="event-row"]')
    assert len(event_rows) > 0
    first_row = event_rows[0]
    driver.execute_script("arguments[0].scrollIntoView(true);", first_row)
    log('Found first live event')
    time.sleep(1)

    # 7️⃣ Click the event’s name link
    event_link = first_row.find_element(By.CSS_SELECTOR, 'a[data-test="EventRowNameLink-link"]')
    event_link.click()
    log('Clicked event link')
    time.sleep(3)

    # 8️⃣ Verify live animation is present
    animation = driver.find_elements(By.CSS_SELECTOR, '.swiper-wrapper, .swiper-slide-active, .animate-svg')
    assert any(a.is_displayed() for a in animation)
    log('Live animation detected')

except Exception as e:
    log(f'ERROR: {e}')
finally:
    driver.quit()
