import os
from playwright.sync_api import sync_playwright, expect, Page

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Get the absolute path to the index.html file
        # The script is in jules-scratch/verification, so we need to go up two levels
        base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        file_path = os.path.join(base_path, 'index.html')

        # Go to the local file
        page.goto(f"file://{file_path}")

        # Find the product grid
        product_grid = page.locator("#product-grid")

        # Find the specific card for "Pisos de Madera Sintética"
        # We can find it by looking for the link that goes to the 'pisos/' directory
        pisos_card = product_grid.locator('a[href="pisos/"]')

        # Wait for the card to be visible
        expect(pisos_card).to_be_visible(timeout=10000)

        # Add a delay to allow the video to load before taking the screenshot
        page.wait_for_timeout(2000) # 2 seconds delay

        # Take a screenshot of just the card
        screenshot_path = os.path.join(os.path.dirname(__file__), "verification.png")
        pisos_card.screenshot(path=screenshot_path)

        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    run_verification()
